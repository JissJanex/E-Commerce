const express = require('express');
const supabase = require('../config/supabaseClient');
const router = express.Router();

router.post('/cleanup-stale-orders', async (req, res) => {
  const secret = req.headers['x-cron-secret'];

  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data, error } = await supabase.rpc('cancel_stale_orders', { p_hours_old: 1 });

  if (error) {
    console.error('Cleanup failed:', error.message);
    return res.status(500).json({ error: error.message });
  }

  console.log(`Cancelled ${data} stale orders`);
  res.json({ message: 'Cleanup complete', cancelled: data });
});

module.exports = router;