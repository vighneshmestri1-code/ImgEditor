const express = require('express');
const router = express.Router();
const { register, verifyOTP, login } = require('../controllers/authController');

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/login', login);

module.exports = router;