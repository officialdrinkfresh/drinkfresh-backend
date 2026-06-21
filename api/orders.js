// ============================================================
// POST /api/orders/create-razorpay-order
//   body: { items, address, slotDate, slotWindow, instructions, userId? }
//   Recomputes price server-side, creates a 'pending' order row,
//   creates a matching Razorpay order, returns razorpayOrderId +
//   amount + key_id so the frontend can open Razorpay Checkout.
//
// POST /api/orders/confirm-cod
//   body: same as above but payment_method = 'cod'
//   Creates the order directly as confirmed (no online payment step).
//
// GET  /api/orders/:orderNumber
//   Returns order + items (for the order-success / tracking page).
// ============================================================

const express = require('express');
const { supabase } = require('../lib/supabaseClient');
const { razorpay } = require('../lib/razorpayClient');
const { priceCart } = require('../lib/pricing');

const router = express.Router();

function validateAddress(address) {
  const required = ['name', 'phone', 'line1', 'state', 'city', 'pincode'];
  for (const field of required) {
    if (!address || !address[field]) {
      throw new Error('Missing address field: ' + field);
    }
  }
}

async function checkServiceableOrThrow(pincode) {
  const { data, error } = await supabase
    .from('delivery_pincodes')
    .select('delivery_zones(is_active)')
    .eq('pincode', pincode)
    .maybeSingle();

  if (error) throw new Error('Serviceability check failed');
  if (!data || !data.delivery_zones || !data.delivery_zones.is_active) {
    throw new Error('NOT_SERVICEABLE');
  }
}

async function buildOrderRow(opts) {
  const { items, address, slotDate, slotWindow, instructions, userId, paymentMethod } = opts;
  const priced = await priceCart(items);

  const orderRow = {
    user_id: userId || null,
    delivery_name: address.name,
    delivery_phone: address.phone,
    delivery_line1: address.line1,
    delivery_line2: address.line2 || null,
    delivery_state: address.state,
    delivery_city: address.city,
    delivery_pincode: address.pincode,
    status: 'confirmed',
    slot_date: slotDate,
    slot_window: slotWindow,
    delivery_instructions: instructions || null,
    subtotal_paise: priced.subtotalPaise,
    delivery_fee_paise: priced.deliveryFeePaise,
    discount_paise: 0,
    loyalty_redeemed_paise: 0,
    total_paise: priced.totalPaise,
    payment_method: paymentMethod,
    payment_status: 'pending',
  };

  return { orderRow, priced };
}

// ---------- Razorpay flow (UPI / Card) ----------
router.post('/create-razorpay-order', async (req, res) => {
  const { items, address, slotDate, slotWindow, instructions, userId } = req.body;

  try {
    validateAddress(address);
    await checkServiceableOrThrow(address.pincode);

    const { orderRow, priced } = await buildOrderRow({
      items, address, slotDate, slotWindow, instructions, userId, paymentMethod: 'razorpay',
    });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderRow)
      .select()
      .single();
    if (orderError) throw orderError;

    const itemRows = priced.lineItems.map((li) => ({
      order_id: order.id,
      product_id: li.productId,
      product_name: li.productName,
      unit_price_paise: li.unitPricePaise,
      quantity: li.quantity,
      line_total_paise: li.lineTotalPaise,
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(itemRows);
    if (itemsError) throw itemsError;

    const rzpOrder = await razorpay.orders.create({
      amount: priced.totalPaise,
      currency: 'INR',
      receipt: order.order_number,
      notes: { drinkfresh_order_id: order.id },
    });

    await supabase
      .from('orders')
      .update({ razorpay_order_id: rzpOrder.id })
      .eq('id', order.id);

    res.json({
      orderNumber: order.order_number,
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      amountPaise: priced.totalPaise,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('create-razorpay-order failed:', err);
    if (err.message === 'NOT_SERVICEABLE') {
      return res.status(422).json({ error: 'NOT_SERVICEABLE', message: 'We do not deliver to this pincode yet.' });
    }
    res.status(400).json({ error: err.message || 'Could not create order' });
  }
});

// ---------- Cash on delivery flow ----------
router.post('/confirm-cod', async (req, res) => {
  const { items, address, slotDate, slotWindow, instructions, userId } = req.body;

  try {
    validateAddress(address);
    await checkServiceableOrThrow(address.pincode);

    const { orderRow, priced } = await buildOrderRow({
      items, address, slotDate, slotWindow, instructions, userId, paymentMethod: 'cod',
    });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderRow)
      .select()
      .single();
    if (orderError) throw orderError;

    const itemRows = priced.lineItems.map((li) => ({
      order_id: order.id,
      product_id: li.productId,
      product_name: li.productName,
      unit_price_paise: li.unitPricePaise,
      quantity: li.quantity,
      line_total_paise: li.lineTotalPaise,
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(itemRows);
    if (itemsError) throw itemsError;

    // TODO: fire order_confirmed WhatsApp template here via Wati.io

    res.json({ orderNumber: order.order_number, orderId: order.id, totalPaise: priced.totalPaise });
  } catch (err) {
    console.error('confirm-cod failed:', err);
    if (err.message === 'NOT_SERVICEABLE') {
      return res.status(422).json({ error: 'NOT_SERVICEABLE', message: 'We do not deliver to this pincode yet.' });
    }
    res.status(400).json({ error: err.message || 'Could not place order' });
  }
});

// ---------- Order lookup (order-success / tracking page) ----------
router.get('/:orderNumber', async (req, res) => {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('order_number', req.params.orderNumber)
    .single();

  if (error || !order) return res.status(404).json({ error: 'Order not found' });
  res.json({ order });
});

module.exports = router;
