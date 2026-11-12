import { MARKETS } from './markets.js';
import { demoItems, demoOffer } from './demo.js';

export const ebaySearchUrl = (m, q) => `https://www.ebay.${m.tld}/sch/i.html?_nkw=${encodeURIComponent(q)}`;

// eBay sans clés d'API : produits et prix de démonstration.
export const ebayDemo = {
  id: 'ebay',
  name: 'eBay',
  live: false,
  markets: MARKETS.map((m) => ({ id: m.id, domain: `ebay.${m.tld}`, currency: m.currency })),
  resolve: () => null,
  search: async (query) => demoItems(query),
  offer: async (id, market) => demoOffer(id, market, ebaySearchUrl, 'ebay') ?? { status: 'error' },
};
