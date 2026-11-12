import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKETS, marketById } from './src/markets.js';
import { amazon } from './src/providers/amazon.js';
import { ebay } from './src/providers/ebay.js';
import { startFx, getFx, toEur } from './src/fx.js';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const PROVIDERS = { amazon, ebay };
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const routes = {
  '/api/config': () => ({
    providers: Object.values(PROVIDERS).map(({ id, name, live, markets }) => ({ id, name, live, markets })),
    fx: getFx(),
  }),

  // Recherche par mots-clés, ou résolution directe d'un identifiant / d'une URL.
  '/api/search': async (q) => {
    const provider = PROVIDERS[q.get('provider')];
    const query = (q.get('q') ?? '').slice(0, 300);
    if (!provider) return { http: 400, error: 'unknown provider' };
    const direct = provider.resolve(query);
    if (direct) return { direct, items: [] };
    const market = marketById(q.get('market')) ?? MARKETS[0];
    return { items: await provider.search(query, market) };
  },

  // Prix d'un produit sur un marché. Le client appelle cette route une fois
  // par pays, en parallèle, pour afficher chaque prix dès qu'il arrive.
  '/api/offer': async (q) => {
    const provider = PROVIDERS[q.get('provider')];
    const market = marketById(q.get('market'));
    const id = q.get('id') ?? '';
    if (!provider || !market || !id || id.length > 600) return { http: 400, error: 'bad request' };
    const offer = await provider.offer(id, market);
    if (offer.price) offer.eur = toEur(offer.price.amount, offer.price.currency);
    return { market: market.id, ...offer };
  },
};

async function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) return json(res, 403, { error: 'forbidden' });
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    json(res, 404, { error: 'not found' });
  }
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = routes[url.pathname];
  if (!route) return serveStatic(decodeURIComponent(url.pathname), res);
  try {
    const body = await route(url.searchParams);
    json(res, body.http ?? 200, body);
  } catch (err) {
    console.error(url.pathname, err.message);
    json(res, 502, { status: 'error', error: 'upstream' });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startFx();
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, () => console.log(`Prixmonde → http://localhost:${port}`));
}
