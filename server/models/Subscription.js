const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planKey: {
      type: String,
      enum: ['pro', 'premium'],
      required: true,
    },
    provider: {
      type: String,
      enum: ['razorpay'],
      default: 'razorpay',
    },
    razorpayPlanId: {
      type: String,
      required: true,
    },
    razorpaySubscriptionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: [
        'created',
        'authenticated',
        'active',
        'pending',
        'halted',
        'cancelled',
        'completed',
        'expired',
      ],
      default: 'created',
      index: true,
    },
    priceInr: {
      type: Number,
      required: true,
      min: 1,
    },
    creditsPerCycle: {
      type: Number,
      required: true,
      min: 1,
    },
    currentPeriodStart: {
      type: Date,
    },
    currentPeriodEnd: {
      type: Date,
    },
    nextBillingAt: {
      type: Date,
    },
    lastPaymentId: {
      type: String,
    },
    lastCreditIssuedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

subscriptionSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);