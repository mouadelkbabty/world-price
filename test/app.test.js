import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAsin, amazon } from '../public/shared/amazon.js';
import { ebay } from '../src/providers/ebay.js';
import { demoSearch, demoProduct, demoPrice } from '../public/shared/demo.js';
import { toEur } from '../src/fx.js';
import { MARKETS } from '../public/shared/markets.js';
import { server } from '../server.js';

test('parseAsin lit un ASIN brut ou une URL Amazon', () => {
  assert.equal(parseAsin('b0chx1w1xy'), 'B0CHX1W1XY');
  assert.equal(parseAsin('https://www.amazon.fr/dp/B0CHX1W1XY'), 'B0CHX1W1XY');
  assert.equal(parseAsin('https://www.amazon.de/Some-Name/dp/B0CHX1W1XY/ref=sr_1_1?th=1'), 'B0CHX1W1XY');
  assert.equal(parseAsin('https://www.amazon.co.uk/gp/product/B0CHX1W1XY?psc=1'), 'B0CHX1W1XY');
  assert.equal(parseAsin('smartwatch'), null);
  assert.equal(parseAsin('clavier mécanique'), null);
  assert.equal(parseAsin('https://example.com/dp/B0CHX1W1XY'), null);
});

test('la recherche démo ignore la casse et les accents, en français et en anglais', () => {
  assert.equal(demoSearch('ecouteurs')[0].id, 'DEMO000001');
  assert.equal(demoSearch('EARBUDS')[0].id, 'DEMO000001');
  assert.equal(demoSearch('zzz').length, 0);
  assert.equal(demoSearch('').length, 8);
});

test('les prix démo sont stables et dans la bonne devise', () => {
  const p = demoProduct('DEMO000002');
  for (const m of MARKETS) {
    const a = demoPrice(p, m.id);
    assert.deepEqual(a, demoPrice(p, m.id));
    if (a) assert.equal(a.currency, m.currency);
  }
});

test('toEur convertit et arrondit au centime', () => {
  assert.equal(toEur(100, 'GBP', { EUR: 1, GBP: 1.1567 }), 115.67);
  assert.equal(toEur(19.99, 'EUR', { EUR: 1 }), 19.99);
  assert.equal(toEur(10, 'USD', { EUR: 1 }), null);
});

test('Amazon : un ASIN inconnu donne un lien direct par pays, jamais un prix inventé', async () => {
  assert.deepEqual(amazon.resolve('B0CHX1W1XY'), { id: 'B0CHX1W1XY', title: null, direct: true });
  const offer = await amazon.offer('B0CHX1W1XY', MARKETS[4]);
  assert.deepEqual(offer, { status: 'link', url: 'https://www.amazon.co.uk/dp/B0CHX1W1XY' });
  assert.equal((await amazon.offer('nope', MARKETS[0])).status, 'error');
});

test('eBay sans clés : démo uniquement, et erreur pour un identifiant inconnu', async () => {
  assert.equal(ebay.live, false);
  assert.equal((await ebay.search('ssd', MARKETS[0]))[0].demo, true);
  assert.equal((await ebay.offer('whatever', MARKETS[0])).status, 'error');
});

test('API HTTP : config, recherche, offre, erreurs et fichiers statiques', async (t) => {
  await new Promise((r) => server.listen(0, r));
  t.after(() => server.close());
  const base = `http://localhost:${server.address().port}`;
  const get = async (p) => {
    const res = await fetch(base + p);
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  const config = await get('/api/config');
  assert.deepEqual(config.body.providers.map((p) => p.id), ['amazon', 'ebay']);
  assert.equal(config.body.providers[0].markets.length, 5);

  assert.equal((await get('/api/search?provider=amazon&q=ssd')).body.items[0].id, 'DEMO000007');
  assert.equal((await get('/api/search?provider=amazon&q=B0CHX1W1XY')).body.direct.id, 'B0CHX1W1XY');
  assert.equal((await get('/api/search?provider=nope&q=x')).status, 400);

  const offers = await Promise.all(MARKETS.map((m) => get(`/api/offer?provider=amazon&id=DEMO000001&market=${m.id}`)));
  const priced = offers.filter((o) => o.body.status === 'ok');
  assert.ok(priced.length >= 4);
  for (const o of priced) assert.ok(o.body.eur > 0 && o.body.demo === true);

  assert.equal((await get('/api/offer?provider=amazon&id=DEMO000001&market=us')).status, 400);
  assert.equal((await fetch(base + '/')).headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal((await get('/..%2Fpackage.json')).status, 403);
  assert.equal((await get('/missing.js')).status, 404);
});

test('version statique : mêmes réponses que le serveur, sans réseau', async () => {
  const { localApi } = await import('../public/local-api.js');
  assert.equal((await localApi('config', {})).providers.length, 2);
  assert.equal((await localApi('search', { provider: 'ebay', q: 'ssd' })).items[0].id, 'DEMO000007');
  const offer = await localApi('offer', { provider: 'amazon', id: 'DEMO000002', market: 'de' });
  assert.ok(offer.status === 'ok' ? offer.eur > 0 : offer.status === 'unavailable');
});
