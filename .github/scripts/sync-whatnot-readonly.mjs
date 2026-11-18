const BASE = "https://api.whatnot.com/seller-api/rest/v2";
const token = process.env.WHATNOT_API_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!token) throw new Error("Missing WHATNOT_API_TOKEN GitHub Actions secret.");
if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY GitHub Actions secret. Add these only after the owner has run the private SQL setup.");
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function whatnot(path) {
  const response = await fetch(BASE + path, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });
  if (response.status === 429) {
    const retry = Number(response.headers.get("RateLimit-Reset") || 2);
    await sleep(Math.max(1000, retry * 1000));
    return whatnot(path);
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Whatnot ${path} returned HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
  return response.status === 204 ? {} : response.json();
}
async function pages(path) {
  const out = [];
  let cursor = null;
  for (let page = 0; page < 100; page++) {
    const u = new URL(BASE + path);
    u.searchParams.set("limit", "50");
    if (cursor) u.searchParams.set("cursor", cursor);
    const response = await fetch(u, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (response.status === 429) {
      await sleep(Math.max(1000, Number(response.headers.get("RateLimit-Reset") || 2) * 1000));
      page--;
      continue;
    }
    if (!response.ok) throw new Error(`Whatnot ${path} returned HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
    const body = await response.json();
    const rows = Array.isArray(body.data) ? body.data : Array.isArray(body.items) ? body.items : [];
    out.push(...rows);
    cursor = body.next_cursor || body.nextCursor || null;
    if (!cursor || rows.length === 0) break;
  }
  return out;
}
function money(v) {
  if (v && typeof v === "object") return Number(v.amount ?? v.value ?? 0) || 0;
  return Number(v ?? 0) || 0;
}
function amount(order, key) {
  return money(order?.amounts?.[key]?.amount ?? order?.amounts?.[key] ?? order?.[key]);
}
async function upsert(table, rows) {
  if (!rows.length) return;
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (!response.ok) throw new Error(`Supabase ${table} upsert failed HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
}
const started = new Date().toISOString();
const [products, orders] = await Promise.all([pages("/products"), pages("/orders")]);
const productRows = products.filter(p => p?.id != null).map(p => ({
  id: String(p.id),
  title: String(p.title || ""),
  sku: String(p.external_id || ""),
  status: String(p.status || ""),
  quantity: 0,
  price: null,
  currency: "AUD",
  raw_data: {
    category: p.category?.name || "",
    url: p.url || "",
    updated_at: p.updated_at || null,
    variant_count: Array.isArray(p.variants) ? p.variants.length : null
  },
  synced_at: new Date().toISOString()
}));
const orderRows = orders.filter(o => o?.id != null).map(o => ({
  id: String(o.id),
  order_number: String(o.order_number || o.id),
  status: String(o.status || ""),
  currency: String(o.amounts?.total?.currency || o.amounts?.subtotal?.currency || o.currency || "AUD"),
  subtotal: amount(o, "subtotal"),
  shipping: amount(o, "shipping"),
  tax: amount(o, "tax"),
  fees: amount(o, "fees"),
  total: amount(o, "total"),
  sold_at: o.created_at || o.placed_at || null,
  raw_data: {
    transaction_type: o.transaction_type || "",
    show_id: o.show_id || null,
    updated_at: o.updated_at || null
  },
  synced_at: new Date().toISOString()
}));
await upsert("whatnot_products", productRows);
await upsert("whatnot_orders", orderRows);
const run = [{
  resource: "products_and_orders",
  outcome: "success",
  records_seen: productRows.length + orderRows.length,
  message: `Synced ${productRows.length} products and ${orderRows.length} orders. Buyer details intentionally excluded.`,
  started_at: started,
  finished_at: new Date().toISOString()
}];
await upsert("whatnot_sync_runs", run);
console.log(`Whatnot read-only sync complete: ${productRows.length} products, ${orderRows.length} orders. No Whatnot records were modified.`);
