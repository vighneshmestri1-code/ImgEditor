const express = require('express');
const router = express.Router();

const {
  protect,
  requireAdmin,
} = require('../middleware/authMiddleware');

const adminController = require('../controllers/adminController');

// Protect every admin endpoint.
router.use(protect, requireAdmin);

// Dashboard statistics.
router.get('/stats', adminController.getAdminStats);

// User management.
router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserById);

// Credit management.
router.post(
  '/users/:id/credits',
  adminController.adjustUserCredits
);

router.get(
  '/users/:id/credit-transactions',
  adminController.getUserCreditTransactions
);

// User deletion.
router.delete('/users/:id', adminController.deleteUser);

module.exports = router;