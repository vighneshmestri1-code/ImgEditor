const express = require('express');
const router = express.Router();

const {
  register,
  verifyOTP,
  login,
  getMe,
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/login', login);

// Fetch the authenticated user's latest account data.
router.get('/me', protect, getMe);

module.exports = router;