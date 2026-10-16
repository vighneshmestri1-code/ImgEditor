
const mongoose = require('mongoose');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');

const ALLOWED_TYPES = [
  'signup_bonus',
  'tool_usage',
  'admin_adjustment',
  'subscription_credit',
  'refund',
];

const ALLOWED_GRANT_TYPES = [
  'signup_bonus',
  'admin_adjustment',
  'subscription_credit',
  'refund',
];

class CreditServiceError extends Error {
  constructor(message, statusCode = 500, code = 'CREDIT_ERROR') {
    super(message);
    this.name = 'CreditServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Ensure an idempotency key is not reused for a different operation.
 */
function validateExistingTransaction(
  transaction,
  { userId, amount, type }
) {
  const sameOperation =
    String(transaction.user) === String(userId) &&
    transaction.amount === amount &&
    transaction.type === type;

  if (!sameOperation) {
    throw new CreditServiceError(
      'Idempotency key has already been used for another operation',
      409,
      'IDEMPOTENCY_KEY_CONFLICT'
    );
  }

  return transaction;
}

/**
 * Update a credit balance and record the change atomically.
 *
 * Positive amount = grant credits.
 * Negative amount = deduct credits.
 *
 * Requires MongoDB transaction support.
 */
async function changeCredits({
  userId,
  amount,
  type,
  description = '',
  createdBy,
  referenceId,
  idempotencyKey,
  metadata,
}) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new CreditServiceError(
      'A valid user ID is required',
      400,
      'INVALID_USER_ID'
    );
  }

  if (!Number.isSafeInteger(amount) || amount === 0) {
    throw new CreditServiceError(
      'Credit amount must be a non-zero safe integer',
      400,
      'INVALID_CREDIT_AMOUNT'
    );
  }

  if (!ALLOWED_TYPES.includes(type)) {
    throw new CreditServiceError(
      'Invalid credit transaction type',
      400,
      'INVALID_TRANSACTION_TYPE'
    );
  }

  if (
    idempotencyKey !== undefined &&
    (
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.trim().length === 0 ||
      idempotencyKey.length > 200
    )
  ) {
    throw new CreditServiceError(
      'Invalid idempotency key',
      400,
      'INVALID_IDEMPOTENCY_KEY'
    );
  }

  const session = await mongoose.startSession();
  let outcome;

  try {
    await session.withTransaction(async () => {
      // Return an existing result instead of applying the same
      // credit change twice.
      if (idempotencyKey) {
        const existing = await CreditTransaction.findOne({
          idempotencyKey,
        })
          .session(session)
          .lean();

        if (existing) {
          validateExistingTransaction(existing, {
            userId,
            amount,
            type,
          });

          const currentUser = await User.findById(userId)
            .select('credits')
            .session(session)
            .lean();

          if (!currentUser) {
            throw new CreditServiceError(
              'User not found',
              404,
              'USER_NOT_FOUND'
            );
          }

          outcome = {
            transaction: existing,
            balance: currentUser.credits ?? existing.balanceAfter,
            duplicate: true,
          };

          return;
        }
      }

      const userExists = await User.exists({
        _id: userId,
      }).session(session);

      if (!userExists) {
        throw new CreditServiceError(
          'User not found',
          404,
          'USER_NOT_FOUND'
        );
      }

      // Preserve the existing fallback for legacy records
      // that have no credits field.
      await User.updateOne(
        {
          _id: userId,
          credits: { $exists: false },
        },
        {
          $set: { credits: 5 },
        },
        { session }
      );

      let updatedUser;

      if (amount < 0) {
        const deductionAmount = Math.abs(amount);

        // Atomic deduction prevents concurrent requests from
        // reducing the user's balance below zero.
        updatedUser = await User.findOneAndUpdate(
          {
            _id: userId,
            credits: { $gte: deductionAmount },
          },
          {
            $inc: { credits: amount },
          },
          {
            returnDocument: 'after',
            session,
            runValidators: true,
          }
        ).select('credits');

        if (!updatedUser) {
          throw new CreditServiceError(
            'You have run out of credits',
            403,
            'INSUFFICIENT_CREDITS'
          );
        }
      } else {
        updatedUser = await User.findOneAndUpdate(
          { _id: userId },
          {
            $inc: { credits: amount },
          },
          {
            returnDocument: 'after',
            session,
            runValidators: true,
          }
        ).select('credits');
      }

      if (!updatedUser) {
        throw new CreditServiceError(
          'User no longer exists',
          404,
          'USER_NOT_FOUND'
        );
      }

      const balanceAfter = updatedUser.credits;
      const balanceBefore = balanceAfter - amount;

      const [transaction] = await CreditTransaction.create(
        [
          {
            user: userId,
            type,
            amount,
            balanceBefore,
            balanceAfter,
            description,
            createdBy,
            referenceId,
            idempotencyKey,
            metadata,
          },
        ],
        { session }
      );

      outcome = {
        transaction: transaction.toObject(),
        balance: balanceAfter,
        duplicate: false,
      };
    });

    if (!outcome) {
      throw new CreditServiceError(
        'Credit transaction did not complete',
        500,
        'TRANSACTION_INCOMPLETE'
      );
    }

    return outcome;
  } catch (error) {
    // Handle a concurrent request using the same unique key.
    if (idempotencyKey && error.code === 11000) {
      const existing = await CreditTransaction.findOne({
        idempotencyKey,
      }).lean();

      if (existing) {
        validateExistingTransaction(existing, {
          userId,
          amount,
          type,
        });

        const currentUser = await User.findById(userId)
          .select('credits')
          .lean();

        if (!currentUser) {
          throw new CreditServiceError(
            'User not found',
            404,
            'USER_NOT_FOUND'
          );
        }

        return {
          transaction: existing,
          balance: currentUser.credits ?? existing.balanceAfter,
          duplicate: true,
        };
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Deduct credits for an image tool.
 * The caller passes a positive amount.
 */
async function deductCredits({
  userId,
  amount = 1,
  description = 'Image tool usage',
  referenceId,
  idempotencyKey,
  metadata,
}) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new CreditServiceError(
      'Deduction amount must be a positive safe integer',
      400,
      'INVALID_CREDIT_AMOUNT'
    );
  }

  return changeCredits({
    userId,
    amount: -amount,
    type: 'tool_usage',
    description,
    referenceId,
    idempotencyKey,
    metadata,
  });
}

/**
 * Grant credits for signup bonuses, admin adjustments,
 * subscriptions, or refunds.
 */
async function grantCredits({
  userId,
  amount,
  type,
  description = '',
  createdBy,
  referenceId,
  idempotencyKey,
  metadata,
}) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new CreditServiceError(
      'Grant amount must be a positive safe integer',
      400,
      'INVALID_CREDIT_AMOUNT'
    );
  }

  if (!ALLOWED_GRANT_TYPES.includes(type)) {
    throw new CreditServiceError(
      'Invalid credit grant type',
      400,
      'INVALID_TRANSACTION_TYPE'
    );
  }

  return changeCredits({
    userId,
    amount,
    type,
    description,
    createdBy,
    referenceId,
    idempotencyKey,
    metadata,
  });
}

module.exports = {
  changeCredits,
  deductCredits,
  grantCredits,
  CreditServiceError,
};
