// ============================================================
// GET  /api/subscriptions             -> list current user's subscriptions
// POST /api/subscriptions             -> create a subscription
// PUT  /api/subscriptions/:id/pause   -> pause until a date
// PUT  /api/subscriptions/:id/resume  -> resume
// PUT  /api/subscriptions/:id/cancel  -> cancel
// Requires Authorization: Bearer <supabase-jwt> header.
// ============================================================

const express = require('express');
const { supabase } = require('../lib/supabaseClient');

const router = express.Router();

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

const DISCOUNT_BY_FREQUENCY = { daily: 8, weekly: 12, monthly: 18 };

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, subscription_items(*)')
    .eq('user_id', req.userId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ subscriptions: data });
});

router.post('/', async (req, res) => {
  const { addressId, frequency, deliveryDay, items } = req.body;

  if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
    return res.status(400).json({ error: 'Invalid frequency' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one product is required' });
  }

  try {
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: req.userId,
        address_id: addressId || null,
        frequency,
        discount_pct: DISCOUNT_BY_FREQUENCY[frequency],
        delivery_day: deliveryDay || null,
        status: 'active',
      })
      .select()
      .single();
    if (subError) throw subError;

    const itemRows = items.map((i) => ({
      subscription_id: sub.id,
      product_id: i.productId,
      quantity: i.quantity,
    }));
    const { error: itemsError } = await supabase.from('subscription_items').insert(itemRows);
    if (itemsError) throw itemsError;

    // NOTE: Actual recurring billing requires a Razorpay Subscription
    // (razorpay.subscriptions.create with a plan_id). That needs a
    // Razorpay Plan created first in the dashboard per frequency/
    // discount combination. Wire that in here once those Plan IDs
    // exist - for now this saves the subscription intent so the
    // rest of the product works end to end.

    res.json({ subscription: sub });
  } catch (err) {
    console.error('Create subscription failed:', err);
    res.status(500).json({ error: err.message || 'Could not create subscription' });
  }
});

router.put('/:id/pause', async (req, res) => {
  const { until } = req.body;
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: 'paused', paused_until: until || null })
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ subscription: data });
});

router.put('/:id/resume', async (req, res) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: 'active', paused_until: null })
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ subscription: data });
});

router.put('/:id/cancel', async (req, res) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ subscription: data });
});

module.exports = router;
