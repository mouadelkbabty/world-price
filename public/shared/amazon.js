import { MARKETS } from './markets.js';
import { demoItems, demoOffer, demoProduct } from './demo.js';

// Amazon : les prix réels ne peuvent venir que de l'API officielle d'Amazon
// (Creators API, réservée aux comptes Partenaires). Tant qu'elle n'est pas
// branchée ici, l'enseigne fonctionne en mode démo + liens directs : un ASIN
// est le même identifiant sur les cinq domaines, donc on peut toujours ouvrir
// la bonne fiche produit dans chaque pays.
const ASIN = /^(?:B0[A-Z0-9]{8}|\d{9}[\dX])$/;

const domain = (m) => `www.amazon.${m.tld}`;
const productUrl = (m, asin) => `https://${domain(m)}/dp/${asin}`;
const searchUrl = (m, q) => `https://${domain(m)}/s?k=${encodeURIComponent(q)}`;

/** Extrait un ASIN d'un ASIN brut ou d'une URL Amazon. */
export function parseAsin(input) {
  const text = String(input ?? '').trim();
  if (ASIN.test(text.toUpperCase())) return text.toUpperCase();
  const m = text.match(/amazon\.[a-z.]+\/(?:.*\/)?(?:dp|gp\/product|gp\/aw\/d)\/([A-Za-z0-9]{10})(?:[/?#]|$)/);
  return m ? m[1].toUpperCase() : null;
}

export const amazon = {
  id: 'amazon',
  name: 'Amazon',
  live: false,
  markets: MARKETS.map((m) => ({ id: m.id, domain: `amazon.${m.tld}`, currency: m.currency })),

  /** Une saisie qui désigne directement un produit (ASIN ou URL). */
  resolve(input) {
    const asin = parseAsin(input);
    return asin && !demoProduct(asin) ? { id: asin, title: null, direct: true } : null;
  },

  async search(query) {
    return demoItems(query);
  },

  async offer(id, market) {
    const demo = demoOffer(id, market, searchUrl);
    if (demo) return demo;
    if (ASIN.test(id)) return { status: 'link', url: productUrl(market, id) };
    return { status: 'error' };
  },
};
