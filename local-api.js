// Version sans serveur (hébergement statique) : mêmes routes, données de démo.
import { createApi } from './shared/api.js';
import { amazon } from './shared/amazon.js';
import { ebayDemo } from './shared/ebay-demo.js';
import { FALLBACK_RATES, toEur } from './shared/money.js';

const routes = createApi(
  { amazon, ebay: ebayDemo },
  { getFx: () => ({ rates: FALLBACK_RATES, approx: true, date: null }), toEur },
);

export const localApi = (name, params) => routes[name](new URLSearchParams(params));
