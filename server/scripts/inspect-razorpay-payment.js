
const path = require('node:path');
const Razorpay = require('razorpay');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

// Existing captured Test Mode payment and invoice.
const paymentId = 'pay_TpeoTofWeoDlVh';
const knownInvoiceId = 'inv_TpeoS1lVJwwXF9';

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error(
      'Razorpay credentials are missing from server/.env'
    );
  }

  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  console.log('Fetching Razorpay payment details...');

  const payment = await razorpay.payments.fetch(paymentId);

  let invoice = null;
  const invoiceId = payment.invoice_id || knownInvoiceId;

  try {
    invoice = await razorpay.invoices.fetch(invoiceId);
  } catch (error) {
    console.error(
      'Invoice lookup failed:',
      error.error?.description || error.message
    );
  }

  // Print only the fields needed for troubleshooting.
  // Never print API keys, secrets, or card details.
  const result = {
    payment: {
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      invoice_id: payment.invoice_id || null,
      order_id: payment.order_id || null,
      subscription_id: payment.subscription_id || null,
      created_at: payment.created_at || null,
      error_code: payment.error_code || null,
      error_description: payment.error_description || null,
    },
    invoice: invoice
      ? {
          id: invoice.id,
          status: invoice.status,
          amount: invoice.amount,
          amount_paid: invoice.amount_paid,
          amount_due: invoice.amount_due,
          currency: invoice.currency,
          payment_id: invoice.payment_id || null,
          order_id: invoice.order_id || null,
          subscription_id: invoice.subscription_id || null,
          paid_at: invoice.paid_at || null,
        }
      : null,
  };

  console.log('\nRazorpay diagnostic result:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(
    '\nPayment inspection failed:',
    error.error?.description || error.message
  );

  process.exitCode = 1;
});
