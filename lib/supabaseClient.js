// ============================================================
// Supabase client for the BACKEND only.
// Uses the SERVICE ROLE key, which bypasses Row Level Security.
// This file must never be imported into frontend code.
// ============================================================

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '\n[drinkfresh] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.\n' +
    'Copy .env.example to .env and fill in your real Supabase project values.\n'
  );
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

module.exports = { supabase };
