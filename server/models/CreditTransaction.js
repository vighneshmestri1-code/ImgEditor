const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        'signup_bonus',
        'tool_usage',
        'admin_adjustment',
        'subscription_credit',
        'refund',
      ],
      required: true,
    },

    // Positive amount = credit granted.
    // Negative amount = credit deducted.
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (value) =>
          Number.isSafeInteger(value) && value !== 0,
        message: 'Amount must be a non-zero integer',
      },
    },

    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
    },

    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },

    referenceId: {
      type: String,
      trim: true,
    },

    // Allows the service to identify duplicate operations.
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

creditTransactionSchema.index({
  user: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  'CreditTransaction',
  creditTransactionSchema
);