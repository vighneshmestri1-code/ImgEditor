const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const {
  deductCredits,
  grantCredits,
  CreditServiceError,
} = require('../services/creditService');

// Authenticate the request using the current database user.
exports.protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && /^Bearer\s+/i.test(authHeader)) {
      token = authHeader.split(/\s+/)[1];
    }

    if (!token) {
      return res.status(401).json({
        error: 'Not authorized, token missing',
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured');

      return res.status(500).json({
        error: 'Server authentication is not configured',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        error: 'User no longer exists',
      });
    }

    return next();
  } catch (error) {
    console.error('Authentication error:', error.message);

    return res.status(401).json({
      error: 'Not authorized, token invalid',
    });
  }
};

// Restrict the route to administrator accounts.
exports.requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
    });
  }

  return next();
};

// Deduct one credit and record the transaction.
exports.deductCredit = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
    });
  }

  let deduction;

  try {
    const suppliedKey = req.get('Idempotency-Key');

    // Use a caller-supplied key when available. Otherwise,
    // assign a unique key to this individual tool request.
    const idempotencyKey =
      suppliedKey &&
      suppliedKey.length <= 120 &&
      /^[a-zA-Z0-9._:-]+$/.test(suppliedKey)
        ? `tool:${req.user._id}:${req.baseUrl}${req.path}:${suppliedKey}`
        : `tool:${crypto.randomUUID()}`;

    deduction = await deductCredits({
      userId: req.user._id,
      amount: 1,
      description: `Image tool usage: ${req.path}`,
      idempotencyKey,
      metadata: {
        endpoint: `${req.baseUrl}${req.path}`,
      },
    });

    req.creditTransaction = deduction.transaction;
    req.user.credits = deduction.balance;
  } catch (error) {
    console.error('Credit deduction error:', error.message);

    if (error instanceof CreditServiceError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      error: 'Failed to process user credits',
    });
  }

  // Return the deducted credit if the tool responds with an error.
  // Successful responses keep the deduction.
  const originalSend = res.send;
  let refundPromise = null;

  res.send = function (...args) {
    if (res.statusCode >= 400 && !refundPromise) {
      refundPromise = grantCredits({
        userId: req.user._id,
        amount: 1,
        type: 'refund',
        description: 'Credit returned after tool failure',
        referenceId: String(deduction.transaction._id),
        idempotencyKey: `refund:${deduction.transaction._id}`,
        metadata: {
          endpoint: `${req.baseUrl}${req.path}`,
          originalTransactionId: String(deduction.transaction._id),
          failureStatus: res.statusCode,
        },
      }).catch((error) => {
        console.error(
          'Credit refund failed; manual review may be required:',
          error.message
        );
      });
    }

    if (refundPromise) {
      return refundPromise.then(() => originalSend.apply(this, args));
    }

    return originalSend.apply(this, args);
  };

  return next();
};