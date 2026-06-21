// ============================================================
// POST /api/webhooks/razorpay
//
// Razorpay calls this URL directly (server-to-server) when a
// payment succeeds or fails. This is the SOURCE OF TRUTH for
// payment status - never mark an order "paid" based on what the
// browser tells you, always wait for this webhook.
//
// Setup: Razorpay Dashboard -> Settings -> Webhooks -> Add new webhook
//   URL: https://your-backend-domain.com/api/webhooks/razorpay
//   Secret: generate one, put it in RAZORPAY_WEBHOOK_SECRET in .env
//   Events to enable: payment.captured, payment.failed
// ============================================================

const express = require('express');
const crypto = require('crypto');
const { supabase } = require('../lib/supabaseClient');

const router = express.Router();

// IMPORTANT: this route needs the RAW request body to verify the
// signature, so server.js mounts this with express.raw() instead
// of express.json(). See server.js for the special handling.

function verifySignature(rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
}

router.post('/razorpay', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET not set - rejecting webhook for safety');
    return res.status(500).send('Webhook secret not configured');
  }

  const rawBody = req.body; // Buffer, because of express.raw() in server.js

  if (!signature || !verifySignature(rawBody, signature, secret)) {
    console.warn('Razorpay webhook signature mismatch - possible spoofed request');
    return res.status(400).send('Invalid signature');
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }

  try {
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;

      const { data: order } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('razorpay_order_id', razorpayOrderId)
        .single();

      if (order) {
        await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            razorpay_payment_id: payment.id,
            status: 'confirmed',
          })
          .eq('id', order.id);

        console.log('Payment captured for order ' + order.order_number);

        // TODO: fire order_confirmed WhatsApp template + award loyalty
        // points here (1 point per Rs 10 spent, insert into loyalty_transactions)
      } else {
        console.warn('Webhook for unknown razorpay_order_id: ' + razorpayOrderId);
      }
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity;
      const razorpayOrderId = payment.order_id;

      const { data: order } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('razorpay_order_id', razorpayOrderId)
        .single();

      if (order) {
        await supabase
          .from('orders')
          .update({ payment_status: 'failed' })
          .eq('id', order.id);
        console.log('Payment failed for order ' + order.order_number);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error processing Razorpay webhook:', err);
    // Still return 200 so Razorpay doesn't endlessly retry a request we
    // can't process. Catch errors via server logs/alerts instead.
    res.status(200).json({ received: true, processedWithError: true });
  }
});

module.exports = router;
