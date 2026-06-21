// ============================================================
// POST /api/serviceability/check    body: { state, city, pincode? }
//      Returns whether we currently deliver there.
// POST /api/serviceability/waitlist body: { state, city, pincode?, email, phone }
//      Saves a waitlist signup for an unserviced area.
// ============================================================

const express = require('express');
const { supabase } = require('../lib/supabaseClient');

const router = express.Router();

router.post('/check', async (req, res) => {
  const { pincode, city } = req.body;

  try {
    if (pincode) {
      const { data, error } = await supabase
        .from('delivery_pincodes')
        .select('pincode, area_name, delivery_zones(display_name, is_active, slot_capacity)')
        .eq('pincode', pincode)
        .maybeSingle();

      if (error) throw error;

      if (data && data.delivery_zones && data.delivery_zones.is_active) {
        return res.json({
          serviceable: true,
          zone: data.delivery_zones.display_name,
          areaName: data.area_name,
          slotCapacity: data.delivery_zones.slot_capacity,
        });
      }
      return res.json({ serviceable: false, reason: data ? 'zone_inactive' : 'pincode_not_found' });
    }

    if (city) {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('display_name, is_active')
        .eq('city', city)
        .eq('is_active', true)
        .limit(1);

      if (error) throw error;
      return res.json({ serviceable: data.length > 0, reason: data.length > 0 ? null : 'city_not_active' });
    }

    return res.status(400).json({ error: 'Provide pincode or city' });
  } catch (err) {
    console.error('Serviceability check failed:', err);
    res.status(500).json({ error: 'Could not check serviceability' });
  }
});

router.post('/waitlist', async (req, res) => {
  const { state, city, pincode, email, phone } = req.body;

  if (!email && !phone) {
    return res.status(400).json({ error: 'Provide email or phone' });
  }

  const { error } = await supabase.from('waitlist_signups').insert({
    state: state || null,
    city: city || null,
    pincode: pincode || null,
    email: email || null,
    phone: phone || null,
  });

  if (error) {
    console.error('Waitlist insert failed:', error);
    return res.status(500).json({ error: 'Could not save your details, please try again' });
  }

  res.json({ success: true, message: "You're on the list! We'll notify you when we launch in your area." });
});

module.exports = router;
