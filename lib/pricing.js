// ============================================================
// Server-side pricing logic.
// CRITICAL SECURITY RULE: never trust a price or total sent from
// the browser. Always recompute subtotal/delivery/total here from
// the product catalog in the database, using only product IDs and
// quantities sent by the client.
// ============================================================

const { supabase } = require('./supabaseClient');

const FREE_DELIVERY_THRESHOLD_PAISE = 25000; // Rs 250
const DELIVERY_FEE_PAISE = 4000; // Rs 40

/**
 * items: [{ productId: '500ml', quantity: 2 }, ...]
 * Returns: { lineItems, subtotalPaise, deliveryFeePaise, totalPaise }
 * Throws if any productId is invalid/inactive or quantity is not a positive integer.
 */
async function priceCart(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Cart is empty');
  }

  const productIds = items.map((i) => i.productId);
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price_paise, is_active')
    .in('id', productIds);

  if (error) throw new Error('Failed to load products: ' + error.message);

  const byId = Object.fromEntries(products.map((p) => [p.id, p]));

  let subtotalPaise = 0;
  const lineItems = items.map(({ productId, quantity }) => {
    const product = byId[productId];
    if (!product || !product.is_active) {
      throw new Error('Invalid or inactive product: ' + productId);
    }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 50) {
      throw new Error('Invalid quantity for ' + productId);
    }
    const lineTotal = product.price_paise * quantity;
    subtotalPaise += lineTotal;
    return {
      productId,
      productName: product.name,
      unitPricePaise: product.price_paise,
      quantity,
      lineTotalPaise: lineTotal,
    };
  });

  const deliveryFeePaise = subtotalPaise >= FREE_DELIVERY_THRESHOLD_PAISE ? 0 : DELIVERY_FEE_PAISE;
  const totalPaise = subtotalPaise + deliveryFeePaise;

  return { lineItems, subtotalPaise, deliveryFeePaise, totalPaise };
}

module.exports = { priceCart, FREE_DELIVERY_THRESHOLD_PAISE, DELIVERY_FEE_PAISE };
