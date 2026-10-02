const express = require('express');
const supabase = require('../config/supabaseClient');
const razorpay = require('../config/razorpayClient');
const { authenticate } = require('../middleware/authMiddleware');
const router = express.Router();

// CHECKOUT - convert cart into an order
router.post('/checkout', authenticate, async (req, res) => {
  const { address_id } = req.body;
  if (!address_id) return res.status(400).json({ error: 'address_id is required' });

  const { data, error } = await supabase.rpc('checkout', {
    p_user_id: req.user.id,
    p_address_id: address_id
  });

  if (error) return res.status(400).json({ error: error.message });

  const orderId = data[0].order_id;

  // fetch the order total to charge
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('id', orderId)
    .single();
  if (orderError) return res.status(500).json({ error: orderError.message });

  // create a Razorpay order for that amount
  try {
    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(order.total_amount * 100), // paise
      currency: 'INR',
      receipt: `order_${orderId}`,
      notes: { order_id: orderId.toString(), user_id: req.user.id }
    });

    // record a pending payment row
    const { error: paymentInsertError } = await supabase.from('payments').insert({
      order_id: orderId,
      provider: 'razorpay',
      razorpay_order_id: rzpOrder.id,
      status: 'pending',
      amount: order.total_amount
    });

    if (paymentInsertError) {
      console.error('Failed to insert payment row:', paymentInsertError.message);
      return res.status(500).json({ error: 'Failed to record payment' });
    }
    // send frontend what it needs to open Razorpay checkout
    res.status(201).json({
      message: 'Order placed, proceed to payment',
      order_id: orderId,
      razorpay_order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (rzpErr) {
    res.status(500).json({ error: rzpErr.message });
  }
});

// LIST current user's orders
router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(quantity, price_at_purchase, products(name))')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET single order detail
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(quantity, price_at_purchase, products(name)), addresses(*)')
    .eq('id', id)
    .eq('user_id', req.user.id) // ensures users can't view others' orders
    .single();

  if (error) return res.status(404).json({ error: 'Order not found' });
  res.json(data);
});

module.exports = router;