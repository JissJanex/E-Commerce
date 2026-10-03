const express = require('express');
const supabase = require('../config/supabaseClient');
const { authenticate } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const router = express.Router();

// LIST all orders (any user) — with pagination and optional status filter
router.get('/orders', authenticate, requireAdmin, async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const from = (page - 1) * limit;
  const to = from + Number(limit) - 1;

  let query = supabase
    .from('orders')
    .select('*, profiles(name), order_items(quantity, price_at_purchase, products(name))', { count: 'exact' });

  if (status) query = query.eq('status', status);

  query = query.order('created_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({
    orders: data,
    pagination: { total: count, page: Number(page), limit: Number(limit), totalPages: Math.ceil(count / limit) }
  });
});

// GET single order (admin can view any user's order)
router.get('/orders/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('orders')
    .select('*, profiles(name), addresses(*), order_items(quantity, price_at_purchase, products(name)), payments(*)')
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ error: 'Order not found' });
  res.json(data);
});

// UPDATE order status (shipped, delivered, cancelled)
const VALID_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

router.put('/orders/:id/status', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Order not found' });

  res.json(data);
});

// BASIC STATS
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  const { count: totalOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });

  const { data: paidOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('status', 'paid');

  const totalRevenue = (paidOrders || []).reduce((sum, o) => sum + Number(o.total_amount), 0);

  const { data: lowStockProducts } = await supabase
    .from('products')
    .select('id, name, stock')
    .lt('stock', 10)
    .order('stock', { ascending: true });

  const { count: totalProducts } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  res.json({
    totalOrders,
    totalRevenue,
    totalProducts,
    totalUsers,
    lowStockProducts
  });
});

module.exports = router;