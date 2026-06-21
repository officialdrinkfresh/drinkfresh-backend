// ============================================================
// Razorpay client for the BACKEND only.
// Never expose RAZORPAY_KEY_SECRET to the frontend - only
// RAZORPAY_KEY_ID is safe to send to the browser (to open the
// Razorpay checkout widget).
// ============================================================

const Razorpay = require('razorpay');

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn(
    '\n[drinkfresh] Razorpay keys not set. Payment endpoints will fail until ' +
    'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in .env\n'
  );
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = { razorpay };
