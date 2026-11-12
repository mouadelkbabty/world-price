import { MARKETS } from '../markets.js';
import { demoSearch, demoProduct, demoPrice } from '../demo.js';

// eBay : API officielle "Browse" (clés gratuites sur developer.ebay.com).
// Avec EBAY_CLIENT_ID / EBAY_CLIENT_SECRET, les prix sont réels ; sinon, démo.
const API = 'https://api.ebay.com';
const { EBAY_CLIENT_ID: ID, EBAY_CLIENT_SECRET: SECRET } = process.env;
const live = Boolean(ID && SECRET);

const domain = (m) => `www.ebay.${m.tld}`;
const searchUrl = (m, q) => `https://${domain(m)}/sch/i.html?_nkw=${encodeURIComponent(q)}`;

let token = { value: null, expires: 0 };

async function getToken() {
  if (token.value && Date.now() < token.expires) return token.value;
  const res = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${ID}:${SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`eBay token ${res.status}`);
  const data = await res.json();
  token = { value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return token.value;
}

async function browse(market, params) {
  const qs = new URLSearchParams({ filter: 'buyingOptions:{FIXED_PRICE},conditions:{NEW}', ...params });
  const res = await fetch(`${API}/buy/browse/v1/item_summary/search?${qs}`, {
    headers: { Authorization: `Bearer ${await getToken()}`, 'X-EBAY-C-MARKETPLACE-ID': market.ebay },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`eBay search ${res.status}`);
  return (await res.json()).itemSummaries ?? [];
}

// L'identifiant d'un produit eBay encode de quoi le retrouver ailleurs :
// la référence catalogue (epid) si elle existe, sinon son titre.
const encodeId = (ref) => Buffer.from(JSON.stringify(ref)).toString('base64url');
function decodeId(id) {
  try {
    const ref = JSON.parse(Buffer.from(id, 'base64url').toString());
    return ref && (ref.epid || ref.q) ? ref : null;
  } catch {
    return null;
  }
}

export const ebay = {
  id: 'ebay',
  name: 'eBay',
  live,
  markets: MARKETS.map((m) => ({ id: m.id, domain: `ebay.${m.tld}`, currency: m.currency })),

  resolve() {
    return null;
  },

  async search(query, market) {
    if (!live) {
      return demoSearch(query).map((p) => ({ id: p.id, title: p.title, icon: p.icon, hue: p.hue, demo: true }));
    }
    const items = await browse(market, { q: query, limit: '12' });
    return items.map((it) => ({
      id: encodeId(it.epid ? { epid: it.epid, q: it.title } : { q: it.title }),
      title: it.title,
      image: it.image?.imageUrl ?? null,
      price: it.price ? { amount: Number(it.price.value), currency: it.price.currency } : null,
    }));
  },

  async offer(id, market) {
    const demo = demoProduct(id);
    if (demo) {
      const price = demoPrice(demo, market.id, 'ebay');
      const url = searchUrl(market, demo.title[market.id === 'uk' ? 'en' : 'fr']);
      return price ? { status: 'ok', price, url, demo: true } : { status: 'unavailable', url, demo: true };
    }
    const ref = decodeId(id);
    if (!live || !ref) return { status: 'error' };
    // Offre neuve à prix fixe la moins chère pour ce produit sur ce marché.
    const query = ref.epid ? { epid: ref.epid } : { q: ref.q };
    const [best] = await browse(market, { ...query, sort: 'price', limit: '1' });
    if (!best?.price) return { status: 'unavailable', url: searchUrl(market, ref.q) };
    return {
      status: 'ok',
      price: { amount: Number(best.price.value), currency: best.price.currency },
      url: best.itemWebUrl ?? searchUrl(market, ref.q),
    };
  },
};
