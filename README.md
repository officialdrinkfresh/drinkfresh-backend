# Drinkfresh Backend

Node.js + Express API server. Talks to Supabase (database + auth) and
Razorpay (payments). This is what the frontend (`drinkfresh-site/`)
calls to actually place orders, check delivery availability, and
manage accounts.

This has been tested against a real PostgreSQL database (schema,
triggers, and Row Level Security policies all verified working
correctly with isolated test users) - what's left is connecting it
to your real Supabase project and Razorpay account.

## What's included

```
drinkfresh-backend/
  server.js              <- entry point, run this to start the API
  package.json
  .env.example           <- copy to .env and fill in real values
  sql/
    01_schema.sql        <- run FIRST in Supabase SQL Editor
    02_seed.sql          <- run SECOND, populates products + zones
  lib/
    supabaseClient.js
    razorpayClient.js
    pricing.js           <- server-side price calculation (never trust client prices)
  api/
    products.js          <- GET product catalog
    serviceability.js    <- pincode/city delivery checks + waitlist
    b2b.js                <- B2B enquiry form submissions
    orders.js             <- checkout: create Razorpay order / confirm COD
    webhooks.js           <- Razorpay payment webhook (signature verified)
    account.js            <- logged-in user: profile, addresses, orders
    subscriptions.js      <- logged-in user: subscription management
```

## Setup - step by step

### 1. Create the Supabase project (if not already done)

See `SUPABASE_SETUP.md` for click-by-click instructions.

### 2. Run the SQL files

In the Supabase Dashboard -> SQL Editor:
1. Open `sql/01_schema.sql`, paste the whole thing, click Run
2. Open `sql/02_seed.sql`, paste the whole thing, click Run

This creates all tables, the triggers (auto referral codes, auto
order numbers, loyalty point sync), Row Level Security policies, and
seeds the 6 products + 3 active Bengaluru launch zones (Koramangala,
Indiranagar, HSR Layout) plus 4 inactive Phase 2 zones ready to flip
on later.

### 3. Create a Razorpay account

1. Go to razorpay.com -> Sign Up -> complete KYC (needed to go live,
   but you can start testing immediately in Test Mode)
2. Dashboard -> Settings -> API Keys -> Generate Test Key
3. Copy the Key ID and Key Secret

### 4. Configure environment variables

```
cp .env.example .env
```

Open `.env` and fill in:
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (from Supabase Project Settings -> API)
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (from Razorpay Dashboard)
- `RAZORPAY_WEBHOOK_SECRET` - make up any strong random string, you'll
  enter this same value in the Razorpay webhook setup in step 6
- `ALLOWED_ORIGINS` - add your real frontend domain, e.g.
  `https://drinkfresh.in,https://www.drinkfresh.in`

### 5. Install and run

```
npm install
npm start
```

You should see:
```
  drinkfresh-backend running on http://localhost:4000
  Health check: http://localhost:4000/health
```

Visit `http://localhost:4000/health` to confirm it's alive.
Visit `http://localhost:4000/api/products` to confirm it can reach
Supabase and returns the 6 seeded products as JSON.

### 6. Set up the Razorpay webhook (critical - do not skip)

This is how the backend finds out a payment actually succeeded.
Without this, orders will be created but never marked as paid.

1. Razorpay Dashboard -> Settings -> Webhooks -> Add New Webhook
2. URL: `https://your-deployed-backend-url.com/api/webhooks/razorpay`
   (only works once deployed publicly - see deployment section;
   it will not work with `localhost`)
3. Secret: paste the same value you put in `RAZORPAY_WEBHOOK_SECRET`
4. Active Events: check `payment.captured` and `payment.failed`
5. Save

### 7. Deploy the backend somewhere

Pick one (Render and Railway both have a free tier good enough to start):

**Render.com (recommended, simplest)**
1. Push this `drinkfresh-backend` folder to a GitHub repo
2. Render Dashboard -> New -> Web Service -> connect the repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add all the same environment variables from `.env` in Render's
   Environment tab
6. Deploy - Render gives a URL like `https://drinkfresh-backend.onrender.com`

**Railway.app** - same idea via their dashboard.

**A VPS** - if you already have one, `pm2 start server.js` keeps it
running permanently, plus a reverse proxy (nginx) to your domain.

### 8. Point the frontend at the deployed backend

In `drinkfresh-site/js/api.js` there's this line near the top:

```js
var API_BASE_URL = window.DRINKFRESH_API_URL || 'http://localhost:4000';
```

Once deployed, add this single line to the `<head>` of every HTML
page in the site, BEFORE the `<script src="js/api.js">` tag:

```html
<script>window.DRINKFRESH_API_URL = 'https://your-deployed-backend-url.com';</script>
```

(Your developer can do a find-and-replace across all 13 HTML files
to add this in one go.)

## What's working right now (tested)

- Product catalog fetch
- Pincode/city serviceability check (only Bengaluru's 3 launch zones
  return `serviceable: true`, everything else triggers a waitlist signup)
- B2B enquiry form -> saves to database
- Checkout -> creates a real Razorpay order, returns the details
  needed to open the Razorpay Checkout widget
- Cash on delivery checkout -> confirms the order directly
- Razorpay webhook -> verifies the payment signature, marks the order
  paid in the database (this is the security-critical piece - payment
  status is NEVER trusted from the browser, only from this server-to-
  server webhook call)
- Account: profile, saved addresses (add/edit/delete), order history
  - all protected so a user can only ever see their own data (Row
  Level Security tested with two separate simulated users - verified
  one user cannot see another's addresses)
- Subscriptions: create, pause, resume, cancel

## What still needs wiring (marked with TODO in the code)

1. **WhatsApp notifications (Wati.io)** - order confirmations, dispatch
   alerts, OTP login messages. Hooks are left in `api/orders.js`,
   `api/webhooks.js`, and `api/b2b.js` exactly where each message
   should fire.
2. **Recurring subscription billing** - `api/subscriptions.js` saves
   the subscription intent (frequency, products, discount) but actual
   automatic recurring charges need a Razorpay Subscription Plan
   created per frequency tier in the Razorpay dashboard first, then
   `razorpay.subscriptions.create()` wired in.
3. **OTP login / signup flow** - the database is ready for it
   (`profiles` table, auto-created on signup) but the actual login UI
   on the frontend currently has no real auth screen yet. Supabase
   Phone Auth handles the OTP sending/verifying once enabled in
   Supabase Dashboard -> Authentication -> Providers -> Phone.
4. **Admin panel** - for your team to view orders, assign drivers,
   manage the product catalog day to day. Not built yet; Supabase's
   own Table Editor works as a stopgap (Dashboard -> Table Editor -
   view/edit/filter every table directly with no code).

## Security notes for whoever deploys this

- `SUPABASE_SERVICE_ROLE_KEY` and `RAZORPAY_KEY_SECRET` must NEVER be
  put in any frontend file or committed to a public GitHub repo. They
  only belong in this backend's `.env` file / hosting platform's
  environment variable settings.
- The frontend only ever needs `RAZORPAY_KEY_ID` (not the secret) -
  the backend sends this to the browser at checkout time so Razorpay's
  widget can open; this key alone cannot be used to charge anything.
- All prices are recalculated server-side from the database on every
  order - the backend never trusts a total sent from the browser.
  This prevents someone tampering with prices in browser dev tools
  before checkout.
