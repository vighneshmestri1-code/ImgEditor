
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const toolsRoutes = require('./routes/toolsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');

const app = express();

// Allow requests during staging and local development.
app.use(cors());

// Preserve the exact raw request bytes needed for Razorpay
// webhook signature verification.
app.use(
  express.json({
    verify: (req, res, buffer) => {
      if (
        req.originalUrl.split('?')[0] ===
        '/api/subscriptions/webhook'
      ) {
        req.rawBody = Buffer.from(buffer);
      }
    },
  })
);

// Simple deployment health check.
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ImgEditor API',
  });
});

// API routes.
app.use('/api/auth', authRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// This Render service is API-only.
// The frontend will be deployed separately later.
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB Connected Successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`ImgEditor API running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB Connection Error:', error.message);
    process.exit(1);
  });
