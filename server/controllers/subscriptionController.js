const crypto = require('node:crypto');
const Razorpay = require('razorpay');

const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const { grantCredits } = require('../services/creditService');

const BILLING_CYCLES = 1200; // Maximum 100 years for monthly billing.

const PLAN_DEFINITIONS = {
  pro: {
    name: 'ImgEditor Pro',
    priceInr: 299,
    creditsPerCycle: 100,
    planEnvKey: 'RAZORPAY_PRO_PLAN_ID',
    description: '100 AI image credits per monthly billing period',
  },
  premium: {
    name: 'ImgEditor Premium',
    priceInr: 599,
    creditsPerCycle: 300,
    planEnvKey: 'RAZORPAY_PREMIUM_PLAN_ID',
    description: '300 AI image credits per monthly billing period',
  },
};

const SUBSCRIPTION_STATUSES = new Set([
  'created',
  'authenticated',
  'active',
  'pending',
  'halted',
  'cancelled',
  'completed',
  'expired',
]);

function getPlan(planKey) {
  const definition = PLAN_DEFINITIONS[planKey];

  if (!definition) return null;

  return {
    ...definition,
    planId: process.env[definition.planEnvKey],
  };
}

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_CONFIG_MISSING');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function publicPlan(planKey) {
  const plan = getPlan(planKey);

  return {
    key: planKey,
    name: plan.name,
    priceInr: plan.priceInr,
    creditsPerCycle: plan.creditsPerCycle,
    billingPeriod: 'monthly',
    description: plan.description,
    available: Boolean(plan.planId),
  };
}

function unixDate(value) {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  return new Date(seconds * 1000);
}

function verifyHmac(value, signature, secret) {
  if (
    typeof signature !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(value)
    .digest();

  const actual = Buffer.from(signature, 'hex');

  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

function getSubscriptionDateUpdates(remote) {
  const updates = {};

  const currentPeriodStart = unixDate(remote.current_start);
  const currentPeriodEnd = unixDate(remote.current_end);
  const nextBillingAt = unixDate(remote.charge_at);
  const cancelledAt = unixDate(remote.ended_at);

  if (currentPeriodStart) {
    updates.currentPeriodStart = currentPeriodStart;
  }

  if (currentPeriodEnd) {
    updates.currentPeriodEnd = currentPeriodEnd;
  }

  if (nextBillingAt) {
    updates.nextBillingAt = nextBillingAt;
  }

  if (cancelledAt) {
    updates.cancelledAt = cancelledAt;
  }

  return updates;
}

// GET /api/subscriptions/plans
exports.getPlans = async (req, res) => {
  return res.status(200).json({
    plans: [
      {
        key: 'free',
        name: 'ImgEditor Free',
        priceInr: 0,
        creditsPerCycle: 10,
        billingPeriod: 'signup',
        description: '10 free signup credits',
        available: true,
      },
      publicPlan('pro'),
      publicPlan('premium'),
    ],
  });
};

// POST /api/subscriptions/create
exports.createSubscription = async (req, res) => {
  try {
    const planKey = String(req.body?.planKey || '').toLowerCase();
    const plan = getPlan(planKey);

    if (!plan) {
      return res.status(400).json({
        error: 'Choose a valid subscription plan',
      });
    }

    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET
    ) {
      return res.status(503).json({
        error: 'Razorpay is not configured on the server',
      });
    }

    if (!/^plan_[a-zA-Z0-9]{14}$/.test(plan.planId || '')) {
      return res.status(503).json({
        error: 'The selected Razorpay plan is not configured correctly',
      });
    }

    // Avoid accidentally creating overlapping subscriptions.
    const existing = await Subscription.findOne({
      user: req.user._id,
      status: {
        $in: [
          'created',
          'authenticated',
          'active',
          'pending',
          'halted',
        ],
      },
    }).sort({ createdAt: -1 });

    if (existing) {
      if (
        existing.planKey === planKey &&
        ['created', 'authenticated'].includes(existing.status) &&
        existing.razorpaySubscriptionId
      ) {
        // Let the user resume the same unfinished checkout.
        return res.status(200).json({
          subscriptionId: existing.razorpaySubscriptionId,
          keyId: process.env.RAZORPAY_KEY_ID,
          status: existing.status,
          existing: true,
          plan: publicPlan(planKey),
        });
      }

      return res.status(409).json({
        error:
          'An existing subscription needs to be resolved before creating another one',
        status: existing.status,
        planKey: existing.planKey,
      });
    }

    const razorpay = getRazorpayClient();

    let remoteSubscription;

    try {
      remoteSubscription = await razorpay.subscriptions.create({
        plan_id: plan.planId,
        total_count: BILLING_CYCLES,
        quantity: 1,
        customer_notify: true,
        notes: {
          app: 'ImgEditor',
          user_id: String(req.user._id),
          plan_key: planKey,
        },
      });
    } catch (gatewayError) {
      console.error(
        'Razorpay subscription creation failed:',
        gatewayError.error?.description || gatewayError.message
      );

      return res.status(502).json({
        error:
          'Razorpay could not create the subscription. Check Test Mode credentials, plan IDs, and subscription activation.',
      });
    }

    const status = SUBSCRIPTION_STATUSES.has(
      remoteSubscription.status
    )
      ? remoteSubscription.status
      : 'created';

    try {
      await Subscription.create({
        user: req.user._id,
        planKey,
        provider: 'razorpay',
        razorpayPlanId: plan.planId,
        razorpaySubscriptionId: remoteSubscription.id,
        status,
        priceInr: plan.priceInr,
        creditsPerCycle: plan.creditsPerCycle,
        currentPeriodStart: unixDate(remoteSubscription.current_start),
        currentPeriodEnd: unixDate(remoteSubscription.current_end),
        nextBillingAt: unixDate(remoteSubscription.charge_at),
      });
    } catch (databaseError) {
      console.error(
        'Failed to persist local subscription:',
        databaseError.message,
        'Razorpay subscription ID:',
        remoteSubscription.id
      );

      return res.status(500).json({
        error:
          'The subscription was created at Razorpay but could not be saved locally. Please contact support before retrying.',
      });
    }

    return res.status(201).json({
      subscriptionId: remoteSubscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      status,
      existing: false,
      plan: publicPlan(planKey),
    });
  } catch (error) {
    console.error('Create subscription error:', error.message);

    return res.status(500).json({
      error: 'Failed to create subscription',
    });
  }
};

// GET /api/subscriptions/current
exports.getCurrentSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!subscription) {
      return res.status(200).json({ subscription: null });
    }

    return res.status(200).json({
      subscription: {
        id: subscription._id,
        planKey: subscription.planKey,
        status: subscription.status,
        priceInr: subscription.priceInr,
        creditsPerCycle: subscription.creditsPerCycle,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextBillingAt: subscription.nextBillingAt,
        createdAt: subscription.createdAt,
      },
    });
  } catch (error) {
    console.error('Fetch subscription error:', error.message);

    return res.status(500).json({
      error: 'Failed to fetch subscription',
    });
  }
};

// POST /api/subscriptions/verify
exports.verifyCheckout = async (req, res) => {
  try {
    const {
      razorpay_payment_id: paymentId,
      razorpay_subscription_id: subscriptionId,
      razorpay_signature: signature,
    } = req.body || {};

    if (
      typeof paymentId !== 'string' ||
      typeof subscriptionId !== 'string' ||
      !paymentId.startsWith('pay_') ||
      !subscriptionId.startsWith('sub_') ||
      typeof signature !== 'string'
    ) {
      return res.status(400).json({
        error: 'Invalid Razorpay Checkout response',
      });
    }

    const localSubscription = await Subscription.findOne({
      user: req.user._id,
      razorpaySubscriptionId: subscriptionId,
    });

    if (!localSubscription) {
      return res.status(404).json({
        error: 'Subscription not found for this account',
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      return res.status(503).json({
        error: 'Payment verification is not configured',
      });
    }

    // Razorpay Subscription Checkout signature:
    // HMAC_SHA256(payment_id + "|" + subscription_id, key_secret)
    const validSignature = verifyHmac(
      `${paymentId}|${subscriptionId}`,
      signature,
      secret
    );

    if (!validSignature) {
      return res.status(400).json({
        error: 'Razorpay signature verification failed',
      });
    }

    const razorpay = getRazorpayClient();

    let remoteSubscription;

    try {
      remoteSubscription = await razorpay.subscriptions.fetch(
        subscriptionId
      );
    } catch (gatewayError) {
      console.error(
        'Failed to fetch Razorpay subscription:',
        gatewayError.message
      );

      return res.status(502).json({
        error: 'Unable to verify subscription with Razorpay',
      });
    }

    if (
      remoteSubscription.id !== subscriptionId ||
      remoteSubscription.plan_id !== localSubscription.razorpayPlanId
    ) {
      return res.status(400).json({
        error: 'Razorpay subscription does not match the selected plan',
      });
    }

    if (
      remoteSubscription.status === 'active'
    ) {
      localSubscription.status = 'active';
    } else if (localSubscription.status === 'created') {
      localSubscription.status = 'authenticated';
    }

    await localSubscription.save();

    // Deliberately do not grant credits here. Credits are granted
    // only by a valid subscription.charged webhook.
    return res.status(200).json({
      verified: true,
      creditsGranted: false,
      message:
        'Checkout signature verified. Credit activation awaits confirmed billing.',
      subscription: {
        planKey: localSubscription.planKey,
        status: localSubscription.status,
      },
    });
  } catch (error) {
    console.error('Checkout verification error:', error.message);

    return res.status(500).json({
      error: 'Failed to verify subscription checkout',
    });
  }
};

// POST /api/subscriptions/webhook
// This endpoint is verified with RAZORPAY_WEBHOOK_SECRET,
// which is separate from RAZORPAY_KEY_SECRET.
exports.handleWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.get('x-razorpay-signature');
    const rawBody = req.rawBody;

    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET is not configured');

      return res.status(503).json({
        error: 'Webhook verification is not configured',
      });
    }

    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({
        error: 'Webhook raw body is unavailable',
      });
    }

    if (!verifyHmac(rawBody, signature, webhookSecret)) {
      return res.status(400).json({
        error: 'Invalid webhook signature',
      });
    }

    let event;

    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({
        error: 'Invalid webhook JSON',
      });
    }

    const eventName = event.event;
    const remoteSubscription = event.payload?.subscription?.entity;

    if (
      !eventName ||
      !remoteSubscription?.id ||
      !eventName.startsWith('subscription.')
    ) {
      // A validly signed event outside the subscription flow
      // does not require processing in this controller.
      return res.status(200).json({
        received: true,
        ignored: true,
      });
    }

    const localSubscription = await Subscription.findOne({
      razorpaySubscriptionId: remoteSubscription.id,
    });

    if (!localSubscription) {
      console.warn(
        'Ignoring webhook for unrecognised subscription:',
        remoteSubscription.id
      );

      // A valid event for a subscription not stored locally should
      // not be allowed to grant credits.
      return res.status(200).json({
        received: true,
        ignored: true,
      });
    }

    if (eventName === 'subscription.charged') {
      const payment = event.payload?.payment?.entity;

      if (!payment?.id) {
        return res.status(400).json({
          error: 'Subscription charge webhook lacks payment details',
        });
      }

      if (
        payment.status !== 'captured' ||
        payment.currency !== 'INR' ||
        payment.amount !== localSubscription.priceInr * 100 ||
        (
          payment.subscription_id &&
          payment.subscription_id !==
            localSubscription.razorpaySubscriptionId
        )
      ) {
        console.error(
          'Subscription charge failed validation:',
          payment.id
        );

        return res.status(400).json({
          error:
            'Subscription payment status, amount, currency, or reference does not match',
        });
      }

      const existingPayment = await Payment.findOne({
        razorpayPaymentId: payment.id,
      }).lean();

      if (
        existingPayment &&
        (
          String(existingPayment.user) !==
            String(localSubscription.user) ||
          existingPayment.planKey !== localSubscription.planKey ||
          existingPayment.amountPaise !== payment.amount
        )
      ) {
        return res.status(409).json({
          error: 'Payment ID conflicts with an existing payment record',
        });
      }

      const paidAt = unixDate(payment.created_at) || new Date();

      // The stable key protects against duplicate webhook deliveries.
      // If delivery fails after this succeeds, retrying the webhook
      // will return the existing credit transaction instead of
      // granting the same billing cycle's credits twice.
      const creditResult = await grantCredits({
        userId: localSubscription.user,
        amount: localSubscription.creditsPerCycle,
        type: 'subscription_credit',
        description:
          `${localSubscription.planKey} monthly subscription credits`,
        referenceId: payment.invoice_id || payment.id,
        idempotencyKey:
          `subscription-credit:${localSubscription.razorpaySubscriptionId}:${payment.id}`,
        metadata: {
          provider: 'razorpay',
          paymentId: payment.id,
          subscriptionId: localSubscription.razorpaySubscriptionId,
          invoiceId: payment.invoice_id || null,
        },
      });

      const paymentFields = {
        user: localSubscription.user,
        provider: 'razorpay',
        planKey: localSubscription.planKey,
        amountPaise: payment.amount,
        currency: 'INR',
        razorpayPaymentId: payment.id,
        razorpaySubscriptionId:
          localSubscription.razorpaySubscriptionId,
      };

      if (payment.invoice_id) {
        paymentFields.razorpayInvoiceId = payment.invoice_id;
      }

      // Upsert makes webhook retries safe after credit granting.
      await Payment.findOneAndUpdate(
        { razorpayPaymentId: payment.id },
        {
          $set: {
            status: 'captured',
            paidAt,
          },
          $setOnInsert: {
            ...paymentFields,
            metadata: {
              source: 'razorpay_subscription_webhook',
              creditTransactionId: String(
                creditResult.transaction._id
              ),
            },
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

      const subscriptionUpdates = {
        status: 'active',
        lastPaymentId: payment.id,
        lastCreditIssuedAt: paidAt,
        ...getSubscriptionDateUpdates(remoteSubscription),
      };

      await Subscription.updateOne(
        { _id: localSubscription._id },
        { $set: subscriptionUpdates },
        { runValidators: true }
      );

      return res.status(200).json({
        received: true,
        creditsGranted: !creditResult.duplicate,
      });
    }

    const statusForEvent = {
      'subscription.created': 'created',
      'subscription.authenticated': 'authenticated',
      'subscription.activated': 'active',
      'subscription.pending': 'pending',
      'subscription.halted': 'halted',
      'subscription.cancelled': 'cancelled',
      'subscription.completed': 'completed',
      'subscription.resumed': 'active',
    };

    let nextStatus = statusForEvent[eventName];

    if (
      eventName === 'subscription.updated' &&
      SUBSCRIPTION_STATUSES.has(remoteSubscription.status)
    ) {
      nextStatus = remoteSubscription.status;
    }

    if (!nextStatus) {
      return res.status(200).json({
        received: true,
        ignored: true,
      });
    }

    await Subscription.updateOne(
      { _id: localSubscription._id },
      {
        $set: {
          status: nextStatus,
          ...getSubscriptionDateUpdates(remoteSubscription),
        },
      },
      { runValidators: true }
    );

    return res.status(200).json({
      received: true,
      subscriptionStatus: nextStatus,
    });
  } catch (error) {
    console.error('Razorpay webhook processing failed:', error.message);

    return res.status(500).json({
      error: 'Webhook processing failed',
    });
  }
};