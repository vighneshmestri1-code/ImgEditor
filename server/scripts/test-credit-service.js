require('dotenv').config();

const mongoose = require('mongoose');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');

const {
  deductCredits,
  grantCredits,
} = require('../services/creditService');

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from server .env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  let testUser;

  try {
    const testId = crypto.randomUUID();

    // Use a disposable account; never use your real account.
    testUser = await User.create({
      name: 'Phase 5 Credit Test',
      email: `phase5-credit-${testId}@example.invalid`,
      password: crypto.randomBytes(32).toString('hex'),
      role: 'user',
      credits: 10,
    });

    console.log('Temporary test user created.');
    console.log('Starting balance:', testUser.credits);

    // Test 1: Deduct one credit.
    const deductionArgs = {
      userId: testUser._id,
      amount: 1,
      description: 'Phase 5 automated test',
      idempotencyKey: `phase5-deduct-${testId}`,
    };

    const first = await deductCredits(deductionArgs);

    assert.equal(first.balance, 9);
    assert.equal(first.transaction.amount, -1);

    console.log('PASS: One credit deducted and recorded.');

    // Test 2: Repeat the identical operation.
    const duplicate = await deductCredits(deductionArgs);

    assert.equal(duplicate.duplicate, true);

    let user = await User.findById(testUser._id);

    assert.equal(user.credits, 9);

    let ledger = await CreditTransaction.find({
      user: testUser._id,
    }).lean();

    assert.equal(ledger.length, 1);

    console.log('PASS: Duplicate request did not deduct twice.');

    // Test 3: Restore the test credit.
    const refund = await grantCredits({
      userId: testUser._id,
      amount: 1,
      type: 'refund',
      description: 'Phase 5 automated test restoration',
      idempotencyKey: `phase5-refund-${testId}`,
      referenceId: String(first.transaction._id),
    });

    assert.equal(refund.balance, 10);

    console.log('PASS: Credit restoration recorded.');

    // Test 4: Attempt to deduct more credits than available.
    let insufficientCreditsRejected = false;

    try {
      await deductCredits({
        userId: testUser._id,
        amount: 11,
        description: 'Expected insufficient-credit test',
        idempotencyKey: `phase5-overdraft-${testId}`,
      });
    } catch (error) {
      insufficientCreditsRejected =
        error.code === 'INSUFFICIENT_CREDITS';
    }

    assert.equal(insufficientCreditsRejected, true);

    user = await User.findById(testUser._id);

    assert.equal(user.credits, 10);

    ledger = await CreditTransaction.find({
      user: testUser._id,
    }).lean();

    assert.equal(ledger.length, 2);

    console.log('PASS: Insufficient-credit request was rejected.');
    console.log('PASS: Failed deduction left no ledger entry.');
    console.log('All credit-service tests passed.');
  } finally {
    // Remove only this script's temporary account and test records.
    if (testUser) {
      await CreditTransaction.deleteMany({
        user: testUser._id,
      });

      await User.deleteOne({
        _id: testUser._id,
      });

      console.log('Temporary test account and ledger cleaned up.');
    }

    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Credit-service test failed:', error);
  process.exitCode = 1;
});