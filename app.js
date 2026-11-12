import { STRINGS } from './i18n.js';
import { applySprings, project, rubberband } from './motion.js';

const $ = (id) => document.getElementById(id);
const FLAGS = {
  fr: '<rect width="20" height="30" fill="#0055a4"/><rect x="20" width="20" height="30" fill="#fff"/><rect x="40" width="20" height="30" fill="#ef4135"/>',
  de: '<rect width="60" height="10"/><rect y="10" width="60" height="10" fill="#d00"/><rect y="20" width="60" height="10" fill="#ffce00"/>',
  it: '<rect width="20" height="30" fill="#009246"/><rect x="20" width="20" height="30" fill="#fff"/><rect x="40" width="20" height="30" fill="#ce2b37"/>',
  es: '<rect width="60" height="30" fill="#aa151b"/><rect y="7.5" width="60" height="15" fill="#f1bf00"/>',
  uk: '<rect width="60" height="30" fill="#012169"/><path d="M0 0l60 30M60 0 0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30M60 0 0 30" stroke="#c8102e" stroke-width="2.4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/>',
};
const REGION = { fr: 'FR', de: 'DE', it: 'IT', es: 'ES', uk: 'GB' };

const store = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* stockage indisponible */ } },
};

const state = {
  lang: store.get('lang') ?? (navigator.language?.startsWith('fr') ? 'fr' : 'en'),
  config: null,
  provider: null,
  items: [],
  query: '',
  compare: null, // { item, offers: Map<marketId, offer | null> }
};

const spring = applySprings();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// ——— Petits utilitaires ———
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) el.setAttribute(k, v);
  }
  el.append(...children.filter((c) => c != null && c !== false));
  return el;
}
const t = (key, vars = {}) =>
  (STRINGS[state.lang][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
const locale = () => (state.lang === 'fr' ? 'fr-FR' : 'en-GB');
const money = (amount, currency) =>
  new Intl.NumberFormat(locale(), { style: 'currency', currency }).format(amount);
const titleOf = (item) =>
  typeof item.title === 'string' ? item.title : item.title?.[state.lang] ?? t('productRef', { id: item.id });
const countryName = (id) => new Intl.DisplayNames(locale(), { type: 'region' }).of(REGION[id]);
// On parle au serveur s'il existe ; sur un hébergement statique (pas d'API),
// on bascule une fois pour toutes sur la version locale, en mode démo.
let serverless = false;
async function api(name, params, signal) {
  if (!serverless) {
    try {
      const res = await fetch(`api/${name}?${new URLSearchParams(params)}`, { signal });
      if (res.headers.get('content-type')?.includes('json')) return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw err;
    }
    serverless = true;
  }
  return (await import('./local-api.js')).localApi(name, params);
}

function thumb(item, el = h('div', { class: 'thumb' })) {
  el.style.setProperty('--hue', item.hue ?? 212);
  el.replaceChildren(item.image ? h('img', { src: item.image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : item.icon ?? '🔗');
  return el;
}

// ——— Contrôles segmentés (enseigne, langue) ———
function moveThumb(group) {
  const active = group.querySelector('[aria-pressed="true"], [aria-selected="true"]');
  if (!active) return;
  let pill = group.querySelector('.thumb-pill');
  if (!pill) {
    pill = group.insertBefore(h('span', { class: 'thumb-pill' }), group.firstChild);
    pill.style.transition = 'none';
    requestAnimationFrame(() => (pill.style.transition = ''));
  }
  pill.style.width = `${active.offsetWidth}px`;
  pill.style.transform = `translateX(${active.offsetLeft}px)`;
}

function renderChrome() {
  document.documentElement.lang = state.lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const b of $('langs').querySelectorAll('button')) b.setAttribute('aria-pressed', b.dataset.lang === state.lang);
  moveThumb($('langs'));

  const p = state.provider;
  if (!p) return;
  for (const b of $('providers').querySelectorAll('button')) b.setAttribute('aria-selected', b.dataset.id === p.id);
  moveThumb($('providers'));
  $('q').placeholder = t(p.id === 'amazon' ? 'placeholderAmazon' : 'placeholder');
  const mode = $('mode');
  mode.hidden = false;
  mode.classList.toggle('live', p.live);
  mode.textContent = t(p.live ? 'modeLive' : 'modeDemo', { store: p.name });
}

// ——— Recherche ———
let searchAbort = null;
let searchTimer = 0;

async function search({ open = false } = {}) {
  clearTimeout(searchTimer);
  searchAbort?.abort();
  searchAbort = new AbortController();
  const query = $('q').value.trim();
  const p = state.provider;
  try {
    const data =
      !query && p.live
        ? { items: [] }
        : await api('search', { provider: p.id, q: query, market: state.lang === 'fr' ? 'fr' : 'uk' }, searchAbort.signal);
    state.query = query;
    state.items = data.direct ? [{ ...data.direct, icon: '🔗' }] : data.items ?? [];
    state.failed = Boolean(data.error);
    renderResults();
    if (open && data.direct) openCompare(state.items[0], document.activeElement);
  } catch (err) {
    if (err.name !== 'AbortError') {
      state.items = [];
      state.failed = true;
      renderResults();
    }
  }
}

function renderResults() {
  const { items, query, provider: p } = state;
  $('results-title').textContent = items.length ? t(query ? 'results' : 'examples') : '';
  $('grid').replaceChildren(
    ...items.map((item, i) =>
      h(
        'button',
        { class: 'card', type: 'button', style: `--i:${i}`, onclick: (e) => openCompare(item, e.currentTarget) },
        thumb(item),
        h('span', { class: 'title' }, titleOf(item)),
        item.price && h('span', { class: 'from' }, money(item.price.amount, item.price.currency)),
        h('span', { class: 'cta' }, `${t('compare')} ›`),
      ),
    ),
  );
  const empty = $('empty');
  empty.hidden = items.length > 0;
  if (state.failed) empty.textContent = t('searchError');
  else if (!query) empty.textContent = t('emptyLive', { store: p.name });
  else empty.textContent = t(p.id === 'amazon' && !p.live ? 'noResultsAmazonDemo' : 'noResults', { q: query });
}

// ——— Comparaison ———
const RANK = { ok: 0, pending: 1, link: 2, unavailable: 3, error: 4 };
let compareToken = 0;
let returnFocus = null;

function openCompare(item, origin) {
  const p = state.provider;
  const token = ++compareToken;
  state.compare = { item, offers: new Map(p.markets.map((m) => [m.id, null])) };
  returnFocus = origin ?? null;
  $('offers').replaceChildren();
  renderCompare();
  showSheet();
  // Un appel par pays, en parallèle : chaque prix s'affiche dès qu'il arrive.
  for (const m of p.markets) {
    api('offer', { provider: p.id, id: item.id, market: m.id })
      .catch(() => ({ status: 'error' }))
      .then((offer) => {
        if (token !== compareToken) return;
        state.compare.offers.set(m.id, offer.status ? offer : { status: 'error' });
        renderCompare();
      });
  }
}

function renderCompare() {
  if (!state.compare) return;
  const { item, offers } = state.compare;
  const p = state.provider;
  thumb(item, $('sheet-thumb'));
  $('sheet-title').textContent = titleOf(item);

  const rows = p.markets.map((m, i) => ({ m, i, o: offers.get(m.id) ?? { status: 'pending' } }));
  rows.sort((a, b) => RANK[a.o.status] - RANK[b.o.status] || (a.o.eur ?? 0) - (b.o.eur ?? 0) || a.i - b.i);
  const priced = rows.filter((r) => r.o.status === 'ok');
  const pending = rows.some((r) => r.o.status === 'pending');
  const best = priced[0];
  const worst = priced.at(-1);

  // Résumé
  const summary = $('summary');
  if (pending) summary.textContent = t('comparing');
  else if (priced.length >= 2 && worst.o.eur > best.o.eur) {
    const pct = Math.round((1 - best.o.eur / worst.o.eur) * 100);
    summary.replaceChildren(
      h('strong', {}, t('save', { amount: money(worst.o.eur - best.o.eur, 'EUR'), pct })),
      ` ${t('saveOn', { domain: best.m.domain })}`,
    );
  } else if (priced.length) summary.textContent = t('onlyOn', { domain: best.m.domain });
  else if (rows.some((r) => r.o.status === 'link')) summary.textContent = t('linksOnly', { store: p.name });
  else summary.textContent = t('nothing');

  // Lignes : mises à jour sur place, puis réordonnées avec une animation FLIP.
  const list = $('offers');
  const before = new Map([...list.children].map((li) => [li.dataset.market, li.getBoundingClientRect().top]));
  for (const { m, o } of rows) {
    const isBest = !pending && best?.m === m && priced.length > 1;
    const li = list.querySelector(`[data-market="${m.id}"]`) ?? h('li', { 'data-market': m.id });
    li.replaceChildren(offerRow(m, o, { isBest, best, pending }));
    list.append(li);
  }
  if (reducedMotion.matches) return;
  for (const li of list.children) {
    const from = before.get(li.dataset.market);
    if (from == null) continue;
    const dy = from - li.getBoundingClientRect().top;
    if (dy) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: spring.duration, easing: spring.easing });
  }
}

function offerRow(m, o, { isBest, best, pending }) {
  const where = h(
    'div',
    { class: 'where' },
    h('div', { class: 'country' }, countryName(m.id), isBest && h('span', { class: 'badge' }, t('bestPrice'))),
    h('div', { class: 'domain' }, m.domain),
  );
  let amount;
  if (o.status === 'ok') {
    const foreign = o.price.currency !== 'EUR';
    const delta = best && !pending && o.eur > best.o.eur ? `+${money(o.eur - best.o.eur, 'EUR')}` : null;
    const sub = [foreign && money(o.price.amount, o.price.currency), delta].filter(Boolean).join(' · ');
    amount = h(
      'div',
      { class: 'amount' },
      h('div', { class: 'price' }, `${foreign ? '≈ ' : ''}${money(o.eur, 'EUR')}`),
      sub && h('div', { class: 'sub' }, sub),
    );
  } else if (o.status === 'pending') amount = h('div', { class: 'amount' }, h('span', { class: 'skeleton' }));
  else if (o.status === 'link') amount = h('div', { class: 'amount link' }, t('seePrice'));
  else amount = h('div', { class: 'amount muted' }, t(o.status === 'unavailable' ? 'unavailable' : 'error'));

  const row = h(
    o.url ? 'a' : 'div',
    { class: `offer${isBest ? ' best' : ''}`, href: o.url, target: o.url && '_blank', rel: o.url && 'noopener noreferrer' },
    h('span', { html: `<svg class="flag" viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${FLAGS[m.id]}</svg>` }).firstChild,
    where,
    amount,
    o.url ? h('span', { class: 'chev', 'aria-hidden': 'true' }, '↗') : h('span'),
  );
  return row;
}

function renderNote() {
  const p = state.provider;
  const fx = state.config.fx;
  const parts = [t(p.live ? 'noteLive' : 'noteDemo', { store: p.name }), t('noteShipping')];
  if (fx?.rates?.GBP) parts.push(t(fx.approx ? 'noteFxApprox' : 'noteFx', { rate: fx.rates.GBP.toLocaleString(locale(), { minimumFractionDigits: 3, maximumFractionDigits: 3 }) }));
  $('note').textContent = parts.join(' ');
}

// ——— Feuille : ouverture, fermeture, glisser pour fermer ———
const sheet = $('sheet');
const scrim = $('scrim');
let hideTimer = 0;

function showSheet() {
  clearTimeout(hideTimer);
  renderNote();
  sheet.hidden = scrim.hidden = false;
  sheet.style.setProperty('--y', '0px');
  sheet.classList.remove('flicked', 'dragging');
  scrim.style.opacity = '';
  void sheet.offsetHeight; // fixe l'état de départ avant d'animer
  document.documentElement.classList.add('sheet-open');
  $('page').inert = true;
  $('close').focus({ preventScroll: true });
}

function hideSheet() {
  if (!document.documentElement.classList.contains('sheet-open')) return;
  compareToken++;
  sheet.classList.remove('dragging');
  scrim.style.opacity = '';
  document.documentElement.classList.remove('sheet-open');
  $('page').inert = false;
  returnFocus?.focus?.({ preventScroll: true });
  hideTimer = setTimeout(() => {
    sheet.hidden = scrim.hidden = true;
    state.compare = null;
  }, spring.duration);
}

$('close').addEventListener('click', hideSheet);
scrim.addEventListener('click', hideSheet);
addEventListener('keydown', (e) => e.key === 'Escape' && hideSheet());

{
  const head = $('sheet-head');
  let drag = null;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.close') || e.button > 0) return;
    head.setPointerCapture(e.pointerId);
    drag = { startY: e.clientY, y: 0, height: sheet.offsetHeight, samples: [{ y: e.clientY, t: e.timeStamp }] };
    sheet.classList.add('dragging');
    sheet.classList.remove('flicked');
  });
  head.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    // Vers le bas : 1:1 avec le doigt. Vers le haut : résistance élastique.
    drag.y = dy >= 0 ? dy : -rubberband(-dy, drag.height);
    sheet.style.setProperty('--y', `${drag.y}px`);
    scrim.style.opacity = String(1 - Math.max(0, drag.y) / drag.height);
    drag.samples.push({ y: e.clientY, t: e.timeStamp });
    while (drag.samples.length > 2 && e.timeStamp - drag.samples[0].t > 100) drag.samples.shift();
  });
  const end = (e) => {
    if (!drag) return;
    const first = drag.samples[0];
    const dt = e.timeStamp - first.t;
    const velocity = dt > 0 ? ((e.clientY - first.y) / dt) * 1000 : 0; // px/s
    const { y, height } = drag;
    drag = null;
    // On décide d'après l'endroit où le geste *allait* s'arrêter.
    if (e.type === 'pointerup' && y + project(velocity) > height / 2) return hideSheet();
    sheet.classList.remove('dragging');
    sheet.classList.toggle('flicked', Math.abs(velocity) > 300);
    sheet.style.setProperty('--y', '0px');
    scrim.style.opacity = '';
  };
  head.addEventListener('pointerup', end);
  head.addEventListener('pointercancel', end);
}

// ——— Démarrage ———
function setProvider(id) {
  state.provider = state.config.providers.find((p) => p.id === id) ?? state.config.providers[0];
  store.set('provider', state.provider.id);
  renderChrome();
  search();
}

$('search').addEventListener('submit', (e) => {
  e.preventDefault();
  search({ open: true });
});
$('q').addEventListener('input', () => {
  clearTimeout(searchTimer);
  // Démo : réponse locale instantanée. API réelle : on attend une courte pause de frappe.
  if (state.provider.live) searchTimer = setTimeout(search, 250);
  else search();
});
$('langs').addEventListener('click', (e) => {
  const lang = e.target.closest('button')?.dataset.lang;
  if (!lang || lang === state.lang) return;
  state.lang = lang;
  store.set('lang', lang);
  renderChrome();
  renderResults();
  if (state.compare) {
    renderCompare();
    renderNote();
  }
});
addEventListener('resize', () => document.querySelectorAll('.segmented').forEach(moveThumb));

renderChrome();
state.config = await api('config', {});
$('providers').replaceChildren(
  ...state.config.providers.map((p) =>
    h('button', { type: 'button', role: 'tab', 'data-id': p.id, onclick: () => setProvider(p.id) }, p.name),
  ),
);
setProvider(store.get('provider'));
