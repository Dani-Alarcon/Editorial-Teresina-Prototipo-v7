// Crea la sesión de pago de Stripe Checkout a partir de la cesta.
// Los precios se leen de Sanity en el servidor: nunca se confía en los que envía el navegador.
// Variables de entorno en Vercel (Settings → Environment Variables):
//   STRIPE_SECRET_KEY   clave secreta de Stripe (sk_live_… o sk_test_…). Obligatoria.
//   SHIPPING_RATES      opcional. JSON con las tarifas de envío, importes en céntimos. Ejemplo:
//                       [{"name":"Envío estándar (península)","amount":390,"min_days":2,"max_days":5}]
//   ALLOWED_COUNTRIES   opcional. Países de envío separados por comas (por defecto: ES).
//   SITE_URL            opcional. Dirección pública de la web (por defecto: https://editorialteresina.es).
//   STRIPE_TERMS        opcional. "1" para exigir en Stripe la aceptación de las condiciones (requiere configurar su URL en Stripe).
const PID = '1espt2y0', DS = 'production';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'metodo-no-permitido' }); }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(503).json({ error: 'pago-no-configurado' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; } }
  const raw = Array.isArray(body && body.items) ? body.items : [];
  const merged = {};
  for (const i of raw) {
    if (!i || typeof i.s !== 'string' || !/^[a-z0-9-]{1,120}$/.test(i.s)) continue;
    const q = Math.max(1, Math.min(20, parseInt(i.q, 10) || 1));
    merged[i.s] = Math.min(20, (merged[i.s] || 0) + q);
  }
  const slugs = Object.keys(merged).slice(0, 30);
  if (!slugs.length) return res.status(400).json({ error: 'cesta-vacia' });

  const query = '*[_type in ["book","libro"] && slug.current in $slugs]{title,"slug":slug.current,price,status}';
  const url = `https://${PID}.api.sanity.io/v2023-01-01/data/query/${DS}?query=${encodeURIComponent(query)}&%24slugs=${encodeURIComponent(JSON.stringify(slugs))}`;
  let books;
  try { books = (await (await fetch(url)).json()).result || []; } catch (e) { return res.status(502).json({ error: 'catalogo-no-disponible' }); }

  const site = (process.env.SITE_URL || 'https://editorialteresina.es').replace(/\/$/, '');
  const p = new URLSearchParams();
  p.append('mode', 'payment');
  p.append('locale', 'es');
  p.append('success_url', `${site}/gracias.html?pedido={CHECKOUT_SESSION_ID}`);
  p.append('cancel_url', `${site}/cesta.html`);
  p.append('phone_number_collection[enabled]', 'true');
  p.append('billing_address_collection', 'auto');
  (process.env.ALLOWED_COUNTRIES || 'ES').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    .forEach((c, i) => p.append(`shipping_address_collection[allowed_countries][${i}]`, c));
  let n = 0; const resumen = [];
  for (const s of slugs) {
    const b = books.find(x => x.slug === s);
    const price = b && typeof b.price === 'number' ? b.price : 0;
    if (!b || !(b.status === 'preventa' || b.status === 'disponible') || price <= 0) return res.status(400).json({ error: `libro-no-disponible:${s}` });
    const name = (b.title || s).trim() + (b.status === 'preventa' ? ' (preventa)' : '');
    p.append(`line_items[${n}][quantity]`, String(merged[s]));
    p.append(`line_items[${n}][price_data][currency]`, 'eur');
    p.append(`line_items[${n}][price_data][unit_amount]`, String(Math.round(price * 100)));
    p.append(`line_items[${n}][price_data][product_data][name]`, name);
    resumen.push(`${merged[s]}x ${s}`); n++;
  }
  p.append('metadata[pedido]', resumen.join(', ').slice(0, 490));
  let rates = [];
  try { rates = JSON.parse(process.env.SHIPPING_RATES || '[]'); } catch (e) { rates = []; }
  rates.slice(0, 5).forEach((r, i) => {
    const b = `shipping_options[${i}][shipping_rate_data]`;
    p.append(`${b}[type]`, 'fixed_amount');
    p.append(`${b}[display_name]`, String(r.name || 'Envío'));
    p.append(`${b}[fixed_amount][amount]`, String(parseInt(r.amount, 10) || 0));
    p.append(`${b}[fixed_amount][currency]`, 'eur');
    if (r.min_days && r.max_days) {
      p.append(`${b}[delivery_estimate][minimum][unit]`, 'business_day');
      p.append(`${b}[delivery_estimate][minimum][value]`, String(r.min_days));
      p.append(`${b}[delivery_estimate][maximum][unit]`, 'business_day');
      p.append(`${b}[delivery_estimate][maximum][value]`, String(r.max_days));
    }
  });
  if (process.env.STRIPE_TERMS === '1') p.append('consent_collection[terms_of_service]', 'required');

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: p.toString(),
    });
    const j = await r.json();
    if (!r.ok || !j.url) { console.error('Stripe:', j && j.error && j.error.message); return res.status(502).json({ error: 'stripe' }); }
    return res.status(200).json({ url: j.url });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: 'stripe' });
  }
};
