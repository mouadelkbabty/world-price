import { MARKETS, marketById } from './markets.js';

// Les trois routes de l'app, indépendantes du transport : le serveur Node les
// expose en HTTP, et la version statique (sans serveur) les appelle directement.
export function createApi(providers, { getFx, toEur }) {
  return {
    config: () => ({
      providers: Object.values(providers).map(({ id, name, live, markets }) => ({ id, name, live, markets })),
      fx: getFx(),
    }),

    // Recherche par mots-clés, ou résolution directe d'un identifiant / d'une URL.
    search: async (q) => {
      const provider = providers[q.get('provider')];
      const query = (q.get('q') ?? '').slice(0, 300);
      if (!provider) return { http: 400, error: 'unknown provider' };
      const direct = provider.resolve(query);
      if (direct) return { direct, items: [] };
      const market = marketById(q.get('market')) ?? MARKETS[0];
      return { items: await provider.search(query, market) };
    },

    // Prix d'un produit sur un marché. Le client appelle cette route une fois
    // par pays, en parallèle, pour afficher chaque prix dès qu'il arrive.
    offer: async (q) => {
      const provider = providers[q.get('provider')];
      const market = marketById(q.get('market'));
      const id = q.get('id') ?? '';
      if (!provider || !market || !id || id.length > 600) return { http: 400, error: 'bad request' };
      const offer = await provider.offer(id, market);
      if (offer.price) offer.eur = toEur(offer.price.amount, offer.price.currency);
      return { market: market.id, ...offer };
    },
  };
}
