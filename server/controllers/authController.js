const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const CreditTransaction = require('../models/CreditTransaction');
const sendEmail = require('../utils/sendEmail');

// 1. Send Google Email OTP
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Generate 6-digit OTP
    const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete existing OTP records for this email and save new OTP
    await OTP.deleteMany({ email: cleanEmail });
    await OTP.create({ email: cleanEmail, otp: generatedOTP });

    // Send verification email
    await sendEmail({
      email: cleanEmail,
      subject: 'ImgEditor - Email Verification OTP',
      text: `Your OTP for ImgEditor registration is: ${generatedOTP}. Valid for 5 minutes.`
    });

    return res.status(200).json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Registration Error:', error.message || error);
    return res.status(500).json({ error: error.message || 'Failed to send OTP' });
  }
};

// 2. Verify OTP & Finalize Registration
exports.verifyOTP = async (req, res) => {
  try {
    const { name, email, password, otp } = req.body;

    // Validate configuration before creating an account.
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return res.status(500).json({
        error: 'Server authentication is not configured',
      });
    }

    if (!email || !otp) {
      return res.status(400).json({
        error: 'Email and OTP are required',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOTP = String(otp).trim();

    const otpRecord = await OTP.findOne({
      email: cleanEmail,
      otp: cleanOTP,
    });

    if (!otpRecord) {
      return res.status(400).json({
        error: 'Invalid or expired OTP',
      });
    }

    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      if (!password || !name || !name.trim()) {
        return res.status(400).json({
          error: 'Name and password are required to create account',
        });
      }

      // Hash the password before creating the account.
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          // Recheck inside the transaction to reduce the chance
          // of creating a duplicate account during concurrent signup.
          const existingUser = await User.findOne({
            email: cleanEmail,
          }).session(session);

          if (existingUser) {
            user = existingUser;
            return;
          }

          // Preserve the existing 10 free signup credits.
          const [createdUser] = await User.create(
            [
              {
                name: name.trim(),
                email: cleanEmail,
                password: hashedPassword,
                isVerified: true,
                credits: 10,
              },
            ],
            { session }
          );

          user = createdUser;

          // Record the initial credits in the same transaction.
          await CreditTransaction.create(
            [
              {
                user: createdUser._id,
                type: 'signup_bonus',
                amount: 10,
                balanceBefore: 0,
                balanceAfter: 10,
                description: '10 free credits granted at signup',
                idempotencyKey: `signup-bonus:${createdUser._id}`,
                metadata: {
                  source: 'email_otp_signup',
                },
              },
            ],
            { session }
          );
        });
      } finally {
        await session.endSession();
      }
    }

    // Remove the OTP only after account and ledger processing succeeds.
    await OTP.deleteMany({ email: cleanEmail });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Account verified and created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        credits: user.credits,
      },
    });
  } catch (error) {
    console.error(
      'OTP Verification Error:',
      error.message || error
    );

    return res.status(500).json({
      error: error.message || 'Failed to complete signup',
    });
  }
};

// 3. Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
    const token = jwt.sign(
      { id: user._id, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        credits: user.credits
      }
    });
  } catch (error) {
    console.error('Login Error:', error.message || error);
    return res.status(500).json({ error: error.message || 'Login failed' });
  }
};