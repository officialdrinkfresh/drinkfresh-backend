-- ============================================================
-- DRINKFRESH — Supabase Database Schema
-- Run this entire file in: Supabase Dashboard -> SQL Editor -> New Query
-- Safe to run once on a fresh project.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. PRODUCTS
-- ============================================================
create table if not exists products (
  id              text primary key,
  name            text not null,
  pack_label      text not null,
  price_paise     integer not null,
  mrp_paise       integer not null,
  size_ml         integer not null,
  category        text not null default 'bottle',
  badge           text,
  is_active       boolean not null default true,
  is_subscribable boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

comment on table products is 'Catalog of all sellable SKUs. Seeded once via 02_seed.sql.';

-- ============================================================
-- 2. PROFILES (extends auth.users)
-- ============================================================
create table if not exists profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  full_name               text,
  phone                   text unique,
  email                   text,
  role                    text not null default 'customer',
  referral_code           text unique,
  referred_by             uuid references profiles(id),
  loyalty_points          integer not null default 0,
  loyalty_tier            text not null default 'drop',
  lifetime_points_earned  integer not null default 0,
  marketing_opt_in        boolean not null default false,
  created_at              timestamptz not null default now()
);

comment on table profiles is 'One row per signed-up user. Created automatically by trigger on auth.users insert.';

create or replace function generate_referral_code()
returns trigger as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(substring(coalesce(new.full_name, 'USER'), 1, 4)) ||
                          lpad(floor(random() * 9000 + 1000)::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_generate_referral_code on profiles;
create trigger trg_generate_referral_code
  before insert on profiles
  for each row execute function generate_referral_code();

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.phone,
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- 3. ADDRESSES
-- ============================================================
create table if not exists addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  label       text not null default 'Home',
  full_name   text not null,
  phone       text not null,
  line1       text not null,
  line2       text,
  state       text not null,
  city        text not null,
  pincode     text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_addresses_user on addresses(user_id);
create index if not exists idx_addresses_pincode on addresses(pincode);

-- ============================================================
-- 4. DELIVERY ZONES & PINCODES
-- ============================================================
create table if not exists delivery_zones (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  display_name  text not null,
  city          text not null default 'Bengaluru',
  state         text not null default 'Karnataka',
  phase         integer not null default 1,
  is_active     boolean not null default false,
  daily_cap     integer not null default 30,
  slot_capacity jsonb not null default '{"8am-2pm":15,"2pm-8pm":15}'
);

create table if not exists delivery_pincodes (
  pincode     text primary key,
  zone_id     uuid not null references delivery_zones(id),
  area_name   text
);

create table if not exists waitlist_signups (
  id          uuid primary key default gen_random_uuid(),
  state       text,
  city        text,
  pincode     text,
  email       text,
  phone       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_waitlist_city on waitlist_signups(state, city);

-- ============================================================
-- 5. ORDERS
-- ============================================================
create table if not exists orders (
  id                      uuid primary key default gen_random_uuid(),
  order_number            text unique,
  user_id                 uuid references profiles(id),
  address_id              uuid references addresses(id),

  delivery_name           text not null,
  delivery_phone          text not null,
  delivery_line1          text not null,
  delivery_line2          text,
  delivery_state          text not null,
  delivery_city           text not null,
  delivery_pincode        text not null,

  status                  text not null default 'confirmed',
  slot_date               date not null,
  slot_window             text not null,
  delivery_instructions   text,

  subtotal_paise          integer not null,
  delivery_fee_paise      integer not null default 0,
  discount_paise          integer not null default 0,
  loyalty_redeemed_paise  integer not null default 0,
  total_paise             integer not null,

  payment_method          text not null,
  payment_status          text not null default 'pending',
  razorpay_order_id       text,
  razorpay_payment_id     text,

  is_subscription_order   boolean not null default false,
  subscription_id         uuid,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_orders_user on orders(user_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created on orders(created_at desc);

create table if not exists order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id) on delete cascade,
  product_id          text not null references products(id),
  product_name        text not null,
  unit_price_paise    integer not null,
  quantity            integer not null,
  line_total_paise    integer not null
);

create index if not exists idx_order_items_order on order_items(order_id);

create or replace function generate_order_number()
returns trigger as $$
begin
  if new.order_number is null then
    new.order_number := 'DF-' || lpad(floor(random() * 90000 + 10000)::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_generate_order_number on orders;
create trigger trg_generate_order_number
  before insert on orders
  for each row execute function generate_order_number();

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- ============================================================
-- 6. SUBSCRIPTIONS
-- ============================================================
create table if not exists subscriptions (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references profiles(id),
  address_id                  uuid references addresses(id),
  frequency                   text not null,
  discount_pct                integer not null,
  delivery_day                text,
  status                      text not null default 'active',
  paused_until                date,
  next_delivery_date          date,
  razorpay_subscription_id    text,
  created_at                  timestamptz not null default now()
);

create table if not exists subscription_items (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  product_id      text not null references products(id),
  quantity        integer not null
);

create index if not exists idx_subscriptions_user on subscriptions(user_id);
create index if not exists idx_subscriptions_next_delivery on subscriptions(next_delivery_date) where status = 'active';

-- ============================================================
-- 7. B2B LEADS
-- ============================================================
create table if not exists b2b_leads (
  id                  uuid primary key default gen_random_uuid(),
  contact_name        text not null,
  business_name       text not null,
  phone               text not null,
  business_type       text,
  state               text,
  city                text,
  estimated_volume    text,
  status              text not null default 'new',
  converted_user_id   uuid references profiles(id),
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_b2b_leads_status on b2b_leads(status);

-- ============================================================
-- 8. LOYALTY TRANSACTIONS
-- ============================================================
create table if not exists loyalty_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id),
  order_id    uuid references orders(id),
  type        text not null,
  points      integer not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_loyalty_user on loyalty_transactions(user_id);

create or replace function apply_loyalty_transaction()
returns trigger as $$
begin
  update profiles
  set loyalty_points = loyalty_points + new.points,
      lifetime_points_earned = lifetime_points_earned + (case when new.points > 0 then new.points else 0 end)
  where id = new.user_id;

  update profiles
  set loyalty_tier = case
    when lifetime_points_earned >= 2000 then 'source'
    when lifetime_points_earned >= 500 then 'stream'
    else 'drop'
  end
  where id = new.user_id;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_apply_loyalty on loyalty_transactions;
create trigger trg_apply_loyalty
  after insert on loyalty_transactions
  for each row execute function apply_loyalty_transaction();

-- ============================================================
-- 9. PROMO CODES
-- ============================================================
create table if not exists promo_codes (
  code              text primary key,
  discount_type     text not null,
  discount_value    integer not null,
  min_order_paise   integer not null default 0,
  max_uses          integer,
  used_count        integer not null default 0,
  valid_from        timestamptz not null default now(),
  valid_to          timestamptz,
  is_active         boolean not null default true
);

-- ============================================================
-- 10. ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table addresses enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table subscriptions enable row level security;
alter table subscription_items enable row level security;
alter table loyalty_transactions enable row level security;
alter table products enable row level security;
alter table delivery_zones enable row level security;
alter table delivery_pincodes enable row level security;
alter table waitlist_signups enable row level security;
alter table b2b_leads enable row level security;
alter table promo_codes enable row level security;

drop policy if exists "Public can view active products" on products;
create policy "Public can view active products" on products
  for select using (is_active = true);

drop policy if exists "Public can view delivery zones" on delivery_zones;
create policy "Public can view delivery zones" on delivery_zones for select using (true);

drop policy if exists "Public can view delivery pincodes" on delivery_pincodes;
create policy "Public can view delivery pincodes" on delivery_pincodes for select using (true);

drop policy if exists "Anyone can join waitlist" on waitlist_signups;
create policy "Anyone can join waitlist" on waitlist_signups for insert with check (true);

drop policy if exists "Anyone can submit b2b lead" on b2b_leads;
create policy "Anyone can submit b2b lead" on b2b_leads for insert with check (true);

drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

drop policy if exists "Users can view own addresses" on addresses;
create policy "Users can view own addresses" on addresses
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own addresses" on addresses;
create policy "Users can insert own addresses" on addresses
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own addresses" on addresses;
create policy "Users can update own addresses" on addresses
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own addresses" on addresses;
create policy "Users can delete own addresses" on addresses
  for delete using (auth.uid() = user_id);

drop policy if exists "Users can view own orders" on orders;
create policy "Users can view own orders" on orders
  for select using (auth.uid() = user_id);

drop policy if exists "Users can view own order items" on order_items;
create policy "Users can view own order items" on order_items
  for select using (
    exists (select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
  );

drop policy if exists "Users can view own subscriptions" on subscriptions;
create policy "Users can view own subscriptions" on subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "Users can update own subscriptions" on subscriptions;
create policy "Users can update own subscriptions" on subscriptions
  for update using (auth.uid() = user_id);

drop policy if exists "Subscription items visible to owner" on subscription_items;
create policy "Subscription items visible to owner" on subscription_items
  for select using (
    exists (select 1 from subscriptions where subscriptions.id = subscription_items.subscription_id and subscriptions.user_id = auth.uid())
  );

drop policy if exists "Users can view own loyalty transactions" on loyalty_transactions;
create policy "Users can view own loyalty transactions" on loyalty_transactions
  for select using (auth.uid() = user_id);

drop policy if exists "Public can check promo code" on promo_codes;
create policy "Public can check promo code" on promo_codes
  for select using (is_active = true);

-- ============================================================
-- Done. Next: run 02_seed.sql to populate products + Bengaluru launch zones.
-- ============================================================
