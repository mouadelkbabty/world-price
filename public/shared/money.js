// Taux de secours vers l'euro, utilisé tant que le taux du jour n'est pas connu.
export const FALLBACK_RATES = { EUR: 1, GBP: 1.15 };

export function toEur(amount, currency, rates = FALLBACK_RATES) {
  const rate = rates[currency];
  if (!rate || !Number.isFinite(amount)) return null;
  return Math.round(amount * rate * 100) / 100;
}
