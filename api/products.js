// ============================================================
// GET  /api/products            -> list all active products
// GET  /api/products/:id        -> single product
// ============================================================

const express = require('express');
const { supabase } = require('../lib/supabaseClient');

const router = express.Router();

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ products: data });
});

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', req.params.id)
    .eq('is_active', true)
    .single();

  if (error) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: data });
});

module.exports = router;
