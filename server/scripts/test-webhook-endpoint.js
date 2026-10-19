require('dotenv').config();

const crypto = require('node:crypto');

async function main() {
  const webhookUrl = process.argv[2];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is missing from server/.env');
  }

  if (
    !webhookUrl ||
    !webhookUrl.startsWith('https://') ||
    !webhookUrl.endsWith('/api/subscriptions/webhook')
  ) {
    throw new Error(
      'Provide the HTTPS Render URL ending in /api/subscriptions/webhook'
    );
  }

  // A harmless event referencing a subscription that does not exist.
  const payload = {
    entity: 'event',
    account_id: 'acc_test_probe',
    event: 'subscription.activated',
    contains: ['subscription'],
    payload: {
      subscription: {
        entity: {
          id: 'sub_webhook_probe_not_real',
          status: 'active',
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };

  // Sign the exact request body using the webhook secret.
  const rawBody = JSON.stringify(payload);

  const signature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
    },
    body: rawBody,
  });

  const responseText = await response.text();

  console.log('HTTP status:', response.status);
  console.log('Response:', responseText);

  if (!response.ok) {
    throw new Error('Webhook endpoint test failed');
  }

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error('Endpoint did not return valid JSON');
  }

  if (result.received !== true || result.ignored !== true) {
    throw new Error(
      'Expected the signed dummy event to be received and safely ignored'
    );
  }

  console.log('PASS: Signature accepted and dummy event safely ignored.');
}

main().catch((error) => {
  console.error('Webhook test failed:', error.message);
  process.exitCode = 1;
});