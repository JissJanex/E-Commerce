const express = require('express');
const supabase = require('../config/supabaseClient');
const { authenticate } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const router = express.Router();

// CREATE product (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, description, price, stock, category_id } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  const { data, error } = await supabase
    .from('products')
    .insert({ name, description, price, stock: stock || 0, category_id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// UPLOAD image for a product (admin only)
router.post('/:id/images', authenticate, requireAdmin, upload.single('image'), async (req, res) => {
  const productId = req.params.id;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No image file provided' });

  const fileName = `${productId}-${Date.now()}-${file.originalname}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(fileName, file.buffer, { contentType: file.mimetype });

  if (uploadError) return res.status(500).json({ error: uploadError.message });

  const { data: publicUrlData } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  const { data, error } = await supabase
    .from('product_images')
    .insert({ product_id: productId, url: publicUrlData.publicUrl })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// UPDATE product (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, stock, category_id } = req.body;

  const { data, error } = await supabase
    .from('products')
    .update({ name, description, price, stock, category_id })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Product not found' });

  res.json(data);
});

// DELETE product (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ message: 'Product deleted' });
});

// LIST products (public) - supports pagination, filtering, search, sorting
router.get('/', async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category_id,
    min_price,
    max_price,
    search,
    sort = 'created_at',
    order = 'desc'
  } = req.query;

  const from = (page - 1) * limit;
  const to = from + Number(limit) - 1;

  let query = supabase
    .from('products')
    .select('*, product_images(url), categories(name)', { count: 'exact' });

  if (category_id) query = query.eq('category_id', category_id);
  if (min_price) query = query.gte('price', min_price);
  if (max_price) query = query.lte('price', max_price);
  if (search) query = query.ilike('name', `%${search}%`);

  query = query.order(sort, { ascending: order === 'asc' }).range(from, to);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({
    products: data,
    pagination: {
      total: count,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(count / limit)
    }
  });
});

// GET single product (public)
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(url), categories(name), reviews(rating, comment, user_id)')
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ error: 'Product not found' });
  res.json(data);
});

module.exports = router;