# Setting up your Supabase project

Takes about 10 minutes total.

## 1. Create the project

1. Go to https://supabase.com
2. Click **Start your project** -> sign in with GitHub or email
3. Click **New Project**
4. Fill in:
   - **Name**: `drinkfresh`
   - **Database password**: click "Generate a password" and SAVE IT
     somewhere safe (a password manager, or a private note). You will
     rarely need it directly, but you cannot recover it later if lost.
   - **Region**: choose **South Asia (Mumbai)** - closest to your
     customers and lowest latency for India
   - **Pricing plan**: Free tier is fine to start
5. Click **Create new project**
6. Wait about 2 minutes while it provisions

## 2. Get your API keys

Once the project status shows "Active":

1. Click the gear icon (bottom left) -> **Project Settings**
2. Click **API** in the settings menu
3. You'll see:
   - **Project URL** - looks like `https://abcdefghijk.supabase.co`
   - **Project API keys** section, with two keys:
     - **anon / public** - starts with `eyJ...`, this is safe to use
       in frontend/browser code
     - **service_role** - also starts with `eyJ...`, marked "secret" -
       this one must NEVER appear in any frontend code, only in the
       backend's `.env` file

Copy all three values somewhere safe. The backend needs the Project
URL and the service_role key (see `.env.example` in this folder).

## 3. Run the database setup

1. In the Supabase Dashboard, click **SQL Editor** in the left sidebar
2. Click **New Query**
3. Open the file `sql/01_schema.sql` from this backend folder, copy
   its entire contents, paste into the SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned" at the bottom
6. Click **New Query** again
7. Open `sql/02_seed.sql`, copy its entire contents, paste in
8. Click **Run**
9. You should see confirmation that rows were inserted

## 4. Verify it worked

Still in the SQL Editor, run this quick check query:

```sql
select id, name, price_paise from products order by sort_order;
```

You should see 6 rows: 250ml, 500ml, 1l, 2l, 5l, 20l.

Then run:

```sql
select display_name, is_active from delivery_zones order by phase;
```

You should see 7 zones - Koramangala, Indiranagar, and HSR Layout
should show `is_active = true`, the other 4 (Jayanagar, BTM Layout,
Whitefield, Marathahalli) should show `false` (these are Phase 2,
ready to switch on later when you expand).

## 5. (Optional, later) Enable Phone OTP login

This is needed for real customer login via phone number + OTP, which
the database is already structured to support but isn't wired into
the frontend UI yet.

1. Dashboard -> **Authentication** -> **Providers**
2. Find **Phone** in the list, toggle it on
3. You'll need an SMS provider (Supabase supports Twilio, MessageBird,
   and a few others) - follow Supabase's prompts to connect one. This
   step can wait until you're ready to build the login screen.

## 6. Hand off to your developer

Once steps 1-4 are done, give your developer:
- The Project URL
- The service_role key (send this securely, e.g. via a password
  manager's sharing feature, not over plain chat/email if possible)
- This entire `drinkfresh-backend` folder

They take it from here following the main `README.md`.
