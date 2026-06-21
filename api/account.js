// ============================================================
// Routes that require a logged-in user.
// The frontend sends the Supabase session JWT in the
// "Authorization: Bearer <token>" header. We verify it here.
//
// GET    /api/account/me                 -> profile
// GET    /api/account/addresses          -> list addresses
// POST   /api/account/addresses          -> add address
// PUT    /api/account/addresses/:id      -> update address
// DELETE /api/account/addresses/:id      -> delete address
// GET    /api/account/orders             -> order history
// ============================================================

const express = require('express');
const { supabase } = require('../lib/supabaseClient');

const router = express.Router();

// Middleware: verify the Supabase JWT and attach req.userId
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired session' });

  req.userId = data.user.id;
  next();
}

router.use(requireAuth);

router.get('/me', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.userId)
    .single();

  if (error) return res.status(404).json({ error: 'Profile not found' });
  res.json({ profile: data });
});

router.get('/addresses', async (req, res) => {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', req.userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ addresses: data });
});

router.post('/addresses', async (req, res) => {
  const { label, full_name, phone, line1, line2, state, city, pincode, is_default } = req.body;

  if (!full_name || !phone || !line1 || !state || !city || !pincode) {
    return res.status(400).json({ error: 'Missing required address fields' });
  }

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: req.userId,
      label: label || 'Home',
      full_name, phone, line1, line2: line2 || null, state, city, pincode,
      is_default: !!is_default,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ address: data });
});

router.put('/addresses/:id', async (req, res) => {
  const updates = Object.assign({}, req.body);
  delete updates.user_id; // never allow reassigning ownership

  const { data, error } = await supabase
    .from('addresses')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.userId) // ensures users can only edit their own
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ address: data });
});

router.delete('/addresses/:id', async (req, res) => {
  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.get('/orders', async (req, res) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ orders: data });
});

module.exports = router;
