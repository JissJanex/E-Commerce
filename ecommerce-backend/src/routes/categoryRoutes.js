const express = require('express');
const supabase = require('../config/supabaseClient');
const router = express.Router();

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('categories').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;