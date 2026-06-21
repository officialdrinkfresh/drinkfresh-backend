-- ============================================================
-- DRINKFRESH — Seed Data
-- Run this AFTER 01_schema.sql.
-- Populates: 6 products, 3 launch zones (Koramangala, Indiranagar,
-- HSR Layout), and their pincodes.
-- ============================================================

-- ============================================================
-- PRODUCTS (matches PRODUCTS object in frontend js/app.js exactly)
-- ============================================================
insert into products (id, name, pack_label, price_paise, mrp_paise, size_ml, category, badge, sort_order)
values
  ('250ml', '250ml Mini Bottle',     'Pack of 24',                 16000,  18000,   250, 'bottle', null,           1),
  ('500ml', '500ml Standard Bottle', 'Pack of 24',                 27000,  30000,   500, 'bottle', 'Best Seller',  2),
  ('1l',    '1L Family Bottle',      'Pack of 12',                 20000,  22000,  1000, 'bottle', null,           3),
  ('2l',    '2L Large Bottle',       'Pack of 6',                  18000,  20000,  2000, 'bottle', 'New',          4),
  ('5l',    '5L Bulk Bottle',        'Pack of 4',                  20000,  22000,  5000, 'bottle', 'New',          5),
  ('20l',   '20L Office Jar',        'Per Jar (+₹200 deposit)',     7000,   8000, 20000, 'jar',    null,           6)
on conflict (id) do update set
  name = excluded.name,
  pack_label = excluded.pack_label,
  price_paise = excluded.price_paise,
  mrp_paise = excluded.mrp_paise,
  badge = excluded.badge;

-- ============================================================
-- DELIVERY ZONES — Phase 1 launch (Bengaluru)
-- ============================================================
insert into delivery_zones (name, display_name, city, state, phase, is_active, daily_cap, slot_capacity)
values
  ('koramangala', 'Koramangala', 'Bengaluru', 'Karnataka', 1, true, 30, '{"8am-2pm":15,"2pm-8pm":15}'),
  ('indiranagar', 'Indiranagar', 'Bengaluru', 'Karnataka', 1, true, 30, '{"8am-2pm":15,"2pm-8pm":15}'),
  ('hsr_layout',  'HSR Layout',  'Bengaluru', 'Karnataka', 1, true, 30, '{"8am-2pm":15,"2pm-8pm":15}'),
  -- Phase 2 (inactive until you flip is_active = true when ready to expand)
  ('jayanagar',    'Jayanagar',    'Bengaluru', 'Karnataka', 2, false, 25, '{"8am-2pm":12,"2pm-8pm":13}'),
  ('btm_layout',   'BTM Layout',   'Bengaluru', 'Karnataka', 2, false, 25, '{"8am-2pm":12,"2pm-8pm":13}'),
  ('whitefield',   'Whitefield',   'Bengaluru', 'Karnataka', 2, false, 25, '{"8am-2pm":12,"2pm-8pm":13}'),
  ('marathahalli', 'Marathahalli', 'Bengaluru', 'Karnataka', 2, false, 25, '{"8am-2pm":12,"2pm-8pm":13}')
on conflict do nothing;

-- ============================================================
-- PINCODES — map each pincode to its zone
-- ============================================================
do $$
declare
  z_koramangala uuid;
  z_indiranagar uuid;
  z_hsr uuid;
  z_jayanagar uuid;
  z_btm uuid;
  z_whitefield uuid;
  z_marathahalli uuid;
begin
  select id into z_koramangala from delivery_zones where name = 'koramangala';
  select id into z_indiranagar from delivery_zones where name = 'indiranagar';
  select id into z_hsr from delivery_zones where name = 'hsr_layout';
  select id into z_jayanagar from delivery_zones where name = 'jayanagar';
  select id into z_btm from delivery_zones where name = 'btm_layout';
  select id into z_whitefield from delivery_zones where name = 'whitefield';
  select id into z_marathahalli from delivery_zones where name = 'marathahalli';

  insert into delivery_pincodes (pincode, zone_id, area_name) values
    ('560034', z_koramangala, 'Koramangala 1st-4th Block'),
    ('560095', z_koramangala, 'Koramangala 5th-8th Block'),
    ('560047', z_koramangala, 'Koramangala Industrial Area'),
    ('560030', z_koramangala, 'ST Bed, Domlur'),

    ('560038', z_indiranagar, 'Indiranagar 1st-12th Main'),
    ('560008', z_indiranagar, 'Indiranagar HAL 2nd Stage'),
    ('560071', z_indiranagar, 'Defence Colony, Indiranagar'),
    ('560017', z_indiranagar, 'Richmond Town, Ulsoor'),

    ('560102', z_hsr, 'HSR Layout Sectors 1-3'),
    ('560068', z_hsr, 'HSR Layout Sectors 4-7'),
    ('560100', z_hsr, 'Kudlu Gate, Singasandra'),

    ('560041', z_jayanagar, 'Jayanagar'),
    ('560011', z_jayanagar, 'Jayanagar 4th T Block'),
    ('560076', z_btm, 'BTM 1st and 2nd Stage'),
    ('560029', z_btm, 'Wilson Garden'),
    ('560066', z_whitefield, 'Whitefield Main'),
    ('560037', z_marathahalli, 'Marathahalli Bridge'),
    ('560103', z_marathahalli, 'Bellandur')
  on conflict (pincode) do nothing;
end $$;

-- ============================================================
-- Done. Verify with:
--   select * from products order by sort_order;
--   select dz.display_name, dz.is_active, dp.pincode, dp.area_name
--   from delivery_zones dz join delivery_pincodes dp on dp.zone_id = dz.id
--   order by dz.phase, dz.display_name;
-- ============================================================
