const express = require('express');
const supabase = require('../config/supabaseClient');
const authClient = supabase.authClient;
const router = express.Router();

// SIGNUP
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  // 1. Create auth user
  const { data, error } = await authClient.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });

  const userId = data.user.id;

  // 2. Create matching profile row
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: userId, name, role: 'customer' });

  if (profileError) return res.status(500).json({ error: profileError.message });

  res.status(201).json({
    message: 'Signup successful. Check email for verification.',
    user: { id: userId, email, name }
  });
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  res.json({
    message: 'Login successful',
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user
  });
});

// LOGOUT (optional — mostly a frontend concern: just discard the token)
router.post('/logout', async (req, res) => {
  res.json({ message: 'Logged out. Discard your token client-side.' });
});

module.exports = router;