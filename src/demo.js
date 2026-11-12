// Catalogue de démonstration : produits génériques et prix fictifs, utilisés
// tant qu'aucune clé d'API officielle n'est configurée. Rien ici ne reflète un
// prix réel — l'interface l'indique clairement.
export const DEMO_PRODUCTS = [
  { id: 'DEMO000001', icon: '🎧', hue: 212, eur: 249, title: { fr: 'Écouteurs sans fil à réduction de bruit', en: 'Wireless noise-cancelling earbuds' } },
  { id: 'DEMO000002', icon: '🖥️', hue: 262, eur: 429, title: { fr: 'Écran 27 pouces 4K USB-C', en: '27-inch 4K USB-C monitor' } },
  { id: 'DEMO000003', icon: '☕', hue: 28, eur: 329, title: { fr: 'Machine à expresso automatique', en: 'Automatic espresso machine' } },
  { id: 'DEMO000004', icon: '⌨️', hue: 190, eur: 119, title: { fr: 'Clavier mécanique sans fil', en: 'Wireless mechanical keyboard' } },
  { id: 'DEMO000005', icon: '🤖', hue: 150, eur: 499, title: { fr: 'Aspirateur robot avec station de vidage', en: 'Robot vacuum with self-empty station' } },
  { id: 'DEMO000006', icon: '📖', hue: 45, eur: 149, title: { fr: 'Liseuse 7 pouces étanche', en: '7-inch waterproof e-reader' } },
  { id: 'DEMO000007', icon: '💾', hue: 340, eur: 99, title: { fr: 'SSD portable 1 To', en: '1 TB portable SSD' } },
  { id: 'DEMO000008', icon: '⌚', hue: 0, eur: 279, title: { fr: 'Montre connectée GPS', en: 'GPS smartwatch' } },
];

const MARKET_IDS = ['fr', 'de', 'it', 'es', 'uk'];
const GBP_PER_EUR = 0.87;

// Petit hash déterministe : les mêmes prix à chaque lancement.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  // Brassage final, sinon deux chaînes voisines donnent des valeurs voisines.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function demoSearch(query) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return DEMO_PRODUCTS;
  const hits = DEMO_PRODUCTS.filter((p) => {
    const hay = norm(`${p.title.fr} ${p.title.en} ${p.id}`);
    return words.every((w) => hay.includes(w));
  });
  return hits;
}

export const demoProduct = (id) => DEMO_PRODUCTS.find((p) => p.id === id) ?? null;

/** Prix fictif d'un produit de démo sur un marché, ou null s'il y est "indisponible". */
export function demoPrice(product, marketId, salt = '') {
  const r = hash(`${salt}${product.id}:${marketId}`);
  // Un marché par produit environ est "indisponible", pour montrer cet état.
  const missing = MARKET_IDS[Math.floor(hash(`${salt}${product.id}:gap`) * 9)];
  if (missing === marketId) return null;
  const eur = product.eur * (0.86 + r * 0.24);
  if (marketId === 'uk') return { amount: Math.round(eur * GBP_PER_EUR) - 0.01, currency: 'GBP' };
  return { amount: Math.round(eur) - 0.01, currency: 'EUR' };
}
