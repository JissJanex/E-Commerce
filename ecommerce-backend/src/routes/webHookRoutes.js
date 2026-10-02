const express = require('express');
const crypto = require('crypto');
const supabase = require('../config/supabaseClient');
const router = express.Router();

router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  if (expectedSignature !== signature) {
    console.error('Razorpay webhook signature mismatch');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body.toString());

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;
    const orderId = payment.notes?.order_id;

    const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({ status: 'succeeded', razorpay_payment_id: payment.id })
        .eq('razorpay_order_id', payment.order_id);

    if (paymentUpdateError) {
        console.error('Failed to update payment:', paymentUpdateError.message);
    }

    // This now deducts stock AND marks the order paid, atomically
    const { error: confirmError } = await supabase.rpc('confirm_payment', {
        p_order_id: orderId
    });

    if (confirmError) {
        console.error('confirm_payment failed:', confirmError.message);
        // Stock ran out between checkout and payment — order stays 'pending'
        // You'll want to handle this case: notify admin, trigger a refund via Razorpay API, etc.
    }
  }

  if (event.event === 'payment.failed') {
    const payment = event.payload.payment.entity;
    await supabase
      .from('payments')
      .update({ status: 'failed', payment_id: payment.id })
      .eq('razorpay_order_id', payment.order_id);
  }

  res.json({ status: 'ok' });
});

module.exports = router;