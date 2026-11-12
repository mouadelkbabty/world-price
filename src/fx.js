// Taux de change vers l'euro. On démarre sur une valeur de secours (marquée
// "approx") et on la remplace par le taux BCE dès qu'il est disponible, sans
// jamais faire attendre une requête utilisateur.
const FALLBACK = { EUR: 1, GBP: 1.15 };
const REFRESH_MS = 12 * 60 * 60 * 1000;

let state = { rates: { ...FALLBACK }, approx: true, date: null };

async function refresh() {
  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?base=GBP&symbols=EUR', {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return;
    const data = await res.json();
    const gbp = Number(data?.rates?.EUR);
    if (gbp > 0) state = { rates: { EUR: 1, GBP: gbp }, approx: false, date: data.date ?? null };
  } catch {
    // On garde le taux précédent.
  }
}

export function startFx() {
  refresh();
  setInterval(refresh, REFRESH_MS).unref();
}

export const getFx = () => state;

export function toEur(amount, currency, rates = state.rates) {
  const rate = rates[currency];
  if (!rate || !Number.isFinite(amount)) return null;
  return Math.round(amount * rate * 100) / 100;
}
