const express = require('express');
const supabase = require('../config/supabaseClient');
const { authenticate } = require('../middleware/authMiddleware');
const router = express.Router({ mergeParams: true }); // needed to access :productId from parent route

// CREATE a review for a product
router.post('/', authenticate, async (req, res) => {
  const { productId } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  // Verify the user actually purchased this product (in a paid order)
  const { data: purchase, error: purchaseError } = await supabase
    .from('order_items')
    .select('id, orders!inner(user_id, status)')
    .eq('product_id', productId)
    .eq('orders.user_id', req.user.id)
    .eq('orders.status', 'paid')
    .limit(1)
    .single();

  if (purchaseError || !purchase) {
    return res.status(403).json({ error: 'You can only review products you have purchased' });
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({ product_id: productId, user_id: req.user.id, rating, comment })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // unique constraint violation
      return res.status(409).json({ error: 'You already reviewed this product' });
    }
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json(data);
});

// LIST reviews for a product (public)
router.get('/', async (req, res) => {
  const { productId } = req.params;

  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, profiles(name)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;