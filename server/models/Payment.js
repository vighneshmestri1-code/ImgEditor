const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['razorpay'],
      default: 'razorpay',
    },
    planKey: {
      type: String,
      enum: ['pro', 'premium'],
      required: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 100,
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR'],
    },
      status: {
      type: String,
      enum: [
        'created',
        'authorized',
        'captured',
        'failed',
        'refunded',
      ],
      default: 'created',
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
    },
    razorpaySubscriptionId: {
      type: String,
      index: true,
    },
    razorpayInvoiceId: {
      type: String,
      unique: true,
      sparse: true,
    },
    paidAt: {
      type: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);