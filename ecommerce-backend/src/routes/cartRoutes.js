const express = require('express');
const supabase = require('../config/supabaseClient');
const { authenticate } = require('../middleware/authMiddleware');
const router = express.Router();

// Helper: get or create a cart for the logged-in user
async function getOrCreateCart(userId) {
  let { data: cart } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (!cart) {
    const { data: newCart, error } = await supabase
      .from('carts')
      .insert({ user_id: userId })
      .select('id')
      .single();
    if (error) throw error;
    cart = newCart;
  }

  return cart.id;
}

// GET current user's cart with product details
router.get('/', authenticate, async (req, res) => {
  try {
    const cartId = await getOrCreateCart(req.user.id);

    const { data, error } = await supabase
      .from('cart_items')
      .select('id, quantity, product_id, products(name, price, stock, product_images(url))')
      .eq('cart_id', cartId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ cart_id: cartId, items: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADD item to cart
router.post('/items', authenticate, async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id is required' });

  try {
    const cartId = await getOrCreateCart(req.user.id);

    // Check stock
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', product_id)
      .single();

    if (productError || !product) return res.status(404).json({ error: 'Product not found' });
    if (product.stock < quantity) {
      return res.status(400).json({ error: `Only ${product.stock} in stock` });
    }

    // Check if item already in cart
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cartId)
      .eq('product_id', product_id)
      .single();

    let result;
    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > product.stock) {
        return res.status(400).json({ error: `Only ${product.stock} in stock` });
      }
      const { data, error } = await supabase
        .from('cart_items')
        .update({ quantity: newQty })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('cart_items')
        .insert({ cart_id: cartId, product_id, quantity })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE item quantity
router.put('/items/:itemId', authenticate, async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be at least 1' });
  }

  // Verify item belongs to this user's cart + check stock
  const { data: item, error: itemError } = await supabase
    .from('cart_items')
    .select('id, cart_id, product_id, carts(user_id), products(stock)')
    .eq('id', itemId)
    .single();

  if (itemError || !item) return res.status(404).json({ error: 'Cart item not found' });
  if (item.carts.user_id !== req.user.id) return res.status(403).json({ error: 'Not your cart' });
  if (quantity > item.products.stock) {
    return res.status(400).json({ error: `Only ${item.products.stock} in stock` });
  }

  const { data, error } = await supabase
    .from('cart_items')
    .update({ quantity })
    .eq('id', itemId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// REMOVE item from cart
router.delete('/items/:itemId', authenticate, async (req, res) => {
  const { itemId } = req.params;

  const { data: item } = await supabase
    .from('cart_items')
    .select('id, carts(user_id)')
    .eq('id', itemId)
    .single();

  if (!item) return res.status(404).json({ error: 'Cart item not found' });
  if (item.carts.user_id !== req.user.id) return res.status(403).json({ error: 'Not your cart' });

  const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ message: 'Item removed from cart' });
});

module.exports = router;