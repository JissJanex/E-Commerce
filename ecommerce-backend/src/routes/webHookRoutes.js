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
    await supabase
      .from('payments')
      .update({ status: 'succeeded', payment_id: payment.id })
      .eq('transaction_id', payment.order_id);

    await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', payment.notes.order_id);
  }

  if (event.event === 'payment.failed') {
    const payment = event.payload.payment.entity;
    await supabase
      .from('payments')
      .update({ status: 'failed', payment_id: payment.id })
      .eq('transaction_id', payment.order_id);
  }

  res.json({ status: 'ok' });
});

module.exports = router;