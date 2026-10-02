const express = require('express');
const supabase = require('../config/supabaseClient');
const { authenticate } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', authenticate, async (req, res) => {
  const { line1, city, state, zip, is_default = false } = req.body;

  const { data, error } = await supabase
    .from('addresses')
    .insert({ user_id: req.user.id, line1, city, state, zip, is_default })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;