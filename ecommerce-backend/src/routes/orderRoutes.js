const express = require('express');
const supabase = require('../config/supabaseClient');
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

  res.status(201).json({ message: 'Order placed', order_id: data[0].order_id });
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