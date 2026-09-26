const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;