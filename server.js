// ============================================================
// DRINKFRESH BACKEND - Main server entry point
//
// Run with:  npm install   then   npm start
// (or for auto-restart on changes during development: npm run dev)
//
// Requires a .env file - copy .env.example to .env and fill in
// real Supabase + Razorpay values first.
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const productsRouter = require('./api/products');
const serviceabilityRouter = require('./api/serviceability');
const b2bRouter = require('./api/b2b');
const ordersRouter = require('./api/orders');
const webhooksRouter = require('./api/webhooks');
const accountRouter = require('./api/account');
const subscriptionsRouter = require('./api/subscriptions');

const app = express();
const PORT = process.env.PORT || 4000;

var allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8080')
  .split(',')
  .map(function (o) { return o.trim(); });

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
      console.warn('Blocked CORS request from origin: ' + origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRouter);

app.use(express.json());

app.get('/health', function (req, res) {
  res.json({ status: 'ok', service: 'drinkfresh-backend' });
});

app.use('/api/products', productsRouter);
app.use('/api/serviceability', serviceabilityRouter);
app.use('/api/b2b', b2bRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/account', accountRouter);
app.use('/api/subscriptions', subscriptionsRouter);

app.use(function (req, res) {
  res.status(404).json({ error: 'Not found' });
});

app.use(function (err, req, res, next) {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, function () {
  console.log('\n  drinkfresh-backend running on http://localhost:' + PORT);
  console.log('  Health check: http://localhost:' + PORT + '/health\n');
});
