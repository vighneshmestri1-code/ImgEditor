const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const subscriptionController = require('../controllers/subscriptionController');

// Public plan catalogue.
router.get('/plans', subscriptionController.getPlans);

// Authenticated subscription operations.
router.post(
  '/create',
  protect,
  subscriptionController.createSubscription
);

router.get(
  '/current',
  protect,
  subscriptionController.getCurrentSubscription
);

router.post(
  '/verify',
  protect,
  subscriptionController.verifyCheckout
);

// Publicly reachable, but secured by the Razorpay webhook signature.
router.post('/webhook', subscriptionController.handleWebhook);

module.exports = router;