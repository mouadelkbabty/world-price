// Les cinq marchés comparés. `tld` sert à construire les domaines de chaque enseigne.
export const MARKETS = [
  { id: 'fr', tld: 'fr', currency: 'EUR', ebay: 'EBAY_FR' },
  { id: 'de', tld: 'de', currency: 'EUR', ebay: 'EBAY_DE' },
  { id: 'it', tld: 'it', currency: 'EUR', ebay: 'EBAY_IT' },
  { id: 'es', tld: 'es', currency: 'EUR', ebay: 'EBAY_ES' },
  { id: 'uk', tld: 'co.uk', currency: 'GBP', ebay: 'EBAY_GB' },
];

export const marketById = (id) => MARKETS.find((m) => m.id === id);
