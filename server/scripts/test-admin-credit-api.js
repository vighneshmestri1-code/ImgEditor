require('dotenv').config();

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');

const API_URL =
  process.env.PHASE5_ADMIN_API_URL ||
  'http://127.0.0.1:5000/api/admin';

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { rawResponse: text };
  }

  return { status: response.status, data };
}

async function main() {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    throw new Error('MONGO_URI or JWT_SECRET is missing from .env');
  }

  let connected = false;
  let adminUser;
  let testUser;
  const testId = crypto.randomUUID();

  try {
    await mongoose.connect(process.env.MONGO_URI);
    connected = true;

    // Create disposable accounts exclusively for this test.
    adminUser = await User.create({
      name: 'Phase 5 Test Admin',
      email: `phase5-admin-${testId}@example.invalid`,
      password: crypto.randomBytes(32).toString('hex'),
      role: 'admin',
      credits: 10,
    });

    testUser = await User.create({
      name: 'Phase 5 Test User',
      email: `phase5-user-${testId}@example.invalid`,
      password: crypto.randomBytes(32).toString('hex'),
      role: 'user',
      credits: 10,
    });

    const adminToken = jwt.sign(
      { id: adminUser._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    const userToken = jwt.sign(
      { id: testUser._id, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    const target = `${API_URL}/users/${testUser._id}/credits`;

    console.log('Temporary test accounts created.');
    console.log('Initial user balance: 10');

    // Test 1: Grant 5 credits.
    const grantKey = `phase5-grant-${testId}`;

    const grant = await apiRequest(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': grantKey,
      },
      body: JSON.stringify({
        amount: 5,
        description: 'Phase 5 automated admin credit test',
      }),
    });

    assert.equal(
      grant.status,
      200,
      `Credit grant failed: ${JSON.stringify(grant.data)}`
    );
    assert.equal(grant.data.balance, 15);
    assert.equal(grant.data.duplicate, false);

    console.log('PASS: Admin granted 5 credits; balance is 15.');

    // Test 2: Retry the identical grant with the same key.
    const duplicate = await apiRequest(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': grantKey,
      },
      body: JSON.stringify({
        amount: 5,
        description: 'Phase 5 automated admin credit test',
      }),
    });

    assert.equal(
      duplicate.status,
      200,
      `Duplicate request failed: ${JSON.stringify(duplicate.data)}`
    );
    assert.equal(duplicate.data.duplicate, true);

    const afterDuplicate = await User.findById(testUser._id);
    assert.equal(afterDuplicate.credits, 15);

    console.log('PASS: Duplicate request did not grant credits twice.');

    // Test 3: Deduct 3 credits through the admin API.
    const deduction = await apiRequest(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `phase5-deduct-${testId}`,
      },
      body: JSON.stringify({
        amount: -3,
        description: 'Phase 5 admin deduction test',
      }),
    });

    assert.equal(
      deduction.status,
      200,
      `Credit deduction failed: ${JSON.stringify(deduction.data)}`
    );
    assert.equal(deduction.data.balance, 12);

    console.log('PASS: Admin deducted 3 credits; balance is 12.');

    // Test 4: Verify transaction history.
    const history = await apiRequest(
      `${API_URL}/users/${testUser._id}/credit-transactions`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    assert.equal(
      history.status,
      200,
      `History request failed: ${JSON.stringify(history.data)}`
    );

    assert.equal(history.data.transactions.length, 2);

    assert.deepEqual(
      history.data.transactions.map((item) => item.amount).sort((a, b) => a - b),
      [-3, 5]
    );

    console.log('PASS: Credit history contains both adjustments.');

    // Test 5: A regular user must not access the admin endpoint.
    const forbidden = await apiRequest(target, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `phase5-forbidden-${testId}`,
      },
      body: JSON.stringify({
        amount: 100,
        description: 'Must be rejected',
      }),
    });

    assert.equal(forbidden.status, 403);

    const finalUser = await User.findById(testUser._id);
    assert.equal(finalUser.credits, 12);

    console.log('PASS: Regular user was denied admin access.');
    console.log('PASS: Final balance is 12 credits.');
    console.log('ALL ADMIN CREDIT API TESTS PASSED.');
  } finally {
    if (connected) {
      try {
        const ids = [adminUser?._id, testUser?._id].filter(Boolean);

        if (ids.length) {
          await CreditTransaction.deleteMany({
            user: { $in: ids },
          });

          await User.deleteMany({
            _id: { $in: ids },
          });

          console.log('Temporary test accounts and ledger cleaned up.');
        }
      } catch (cleanupError) {
        console.error(
          'WARNING: Test cleanup failed:',
          cleanupError.message
        );
      }

      await mongoose.disconnect();
    }
  }
}

main().catch((error) => {
  console.error('ADMIN CREDIT API TEST FAILED:', error.message);
  process.exitCode = 1;
});