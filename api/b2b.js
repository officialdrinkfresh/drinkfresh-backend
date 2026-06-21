// ============================================================
// POST /api/b2b/enquiry   body: { name, business, phone, type, state, city, volume }
// Saves a B2B lead. (TODO hook: fire WhatsApp alert to sales team
// here once Wati.io is connected.)
// ============================================================

const express = require('express');
const { supabase } = require('../lib/supabaseClient');

const router = express.Router();

router.post('/enquiry', async (req, res) => {
  const { name, business, phone, type, state, city, volume } = req.body;

  if (!name || !business || !phone) {
    return res.status(400).json({ error: 'Name, business name and phone are required' });
  }

  const { data, error } = await supabase
    .from('b2b_leads')
    .insert({
      contact_name: name,
      business_name: business,
      phone,
      business_type: type || null,
      state: state || null,
      city: city || null,
      estimated_volume: volume || null,
    })
    .select()
    .single();

  if (error) {
    console.error('B2B lead insert failed:', error);
    return res.status(500).json({ error: 'Could not submit your enquiry, please try again' });
  }

  // TODO: send WhatsApp alert to sales team via Wati.io API here.

  res.json({ success: true, leadId: data.id, message: 'Thanks! Our team will call you within 2 hours.' });
});

module.exports = router;
