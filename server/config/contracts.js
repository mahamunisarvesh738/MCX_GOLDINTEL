/**
 * MCX Bullion Contract Specifications & Normalization Matrix
 * Reference: https://www.mcxindia.com/products/bullion/gold
 * 
 * Standard Normalization Benchmark:
 * Standard metric: INR per 10 grams of 999 Fine Gold (24 Karat retail standard)
 */

const CONTRACT_SPECS = {
  GOLD: {
    symbol: 'GOLD',
    name: 'Gold (1 Kg)',
    tradingUnitGrams: 1000,
    quoteUnitGrams: 10,
    purity: 995, // 99.5% pure
    purityFactor: 0.995,
    expiryWindow: '3rd-5th of delivery month',
    tenderPeriodDays: 5,
    minTick: 1,
    typicalVolumeTier: 'High (Institutional)',
    description: 'Benchmark wholesale 1kg bullion contract',
    isStandardBenchmark: true,
    availableFrom: '2003-01-01'
  },
  GOLDM: {
    symbol: 'GOLDM',
    name: 'Gold Mini (100g)',
    tradingUnitGrams: 100,
    quoteUnitGrams: 10,
    purity: 995, // 99.5% pure
    purityFactor: 0.995,
    expiryWindow: '3rd-5th of delivery month',
    tenderPeriodDays: 5,
    minTick: 1,
    typicalVolumeTier: 'High (Active Retail & Prop)',
    description: 'Active 100g mini contract quoted per 10g',
    availableFrom: '2006-01-01'
  },
  GOLDTEN: {
    symbol: 'GOLDTEN',
    name: 'Gold Ten (10g)',
    tradingUnitGrams: 10,
    quoteUnitGrams: 10,
    purity: 999, // 99.9% pure
    purityFactor: 0.999,
    expiryWindow: '27th-31st of delivery month',
    tenderPeriodDays: 5,
    minTick: 1,
    typicalVolumeTier: 'Medium (Retail/Investor)',
    description: '10g contract of 999 purity listed from 2025 onwards',
    availableFrom: '2025-01-01'
  },
  GOLDGUINEA: {
    symbol: 'GOLDGUINEA',
    name: 'Gold Guinea (8g)',
    tradingUnitGrams: 8,
    quoteUnitGrams: 8,
    purity: 999, // 99.9% pure (Sovereign/Guinea coin)
    purityFactor: 0.999,
    expiryWindow: '27th-31st of delivery month',
    tenderPeriodDays: 5,
    minTick: 1,
    typicalVolumeTier: 'Low to Medium (Retail Coin)',
    description: '8g coin contract quoted per 8g',
    availableFrom: '2008-01-01'
  },
  GOLDPETAL: {
    symbol: 'GOLDPETAL',
    name: 'Gold Petal (1g)',
    tradingUnitGrams: 1,
    quoteUnitGrams: 1,
    purity: 999, // 99.9% pure
    purityFactor: 0.999,
    expiryWindow: '27th-31st of delivery month',
    tenderPeriodDays: 5,
    minTick: 1,
    typicalVolumeTier: 'Medium (Micro Retail / SIP)',
    description: '1g micro contract quoted per 1g',
    availableFrom: '2011-01-01'
  }
};

/**
 * Calculates multiplier to convert quoted settlement price into
 * standard INR per 10 grams of 999 Fine Gold.
 *
 * Formula:
 * Price_norm = Price_raw * (10 / quoteUnitGrams) * (0.999 / (purity / 1000))
 */
function getNormalizationMultiplier(symbol) {
  const cleanSymbol = symbol.trim().toUpperCase();
  const spec = CONTRACT_SPECS[cleanSymbol];
  if (!spec) {
    throw new Error(`Unknown contract symbol: ${symbol}`);
  }
  const unitFactor = 10 / spec.quoteUnitGrams;
  const purityFactor = 0.999 / spec.purityFactor;
  return unitFactor * purityFactor;
}

/**
 * Normalizes any contract price to INR / 10g of 999 fine gold
 */
function normalizePrice(symbol, rawPrice) {
  if (rawPrice === null || rawPrice === undefined || isNaN(rawPrice)) {
    return null;
  }
  const multiplier = getNormalizationMultiplier(symbol);
  return Number((rawPrice * multiplier).toFixed(2));
}

/**
 * Normalizes volume to equivalent 10-gram units (for apples-to-apples liquidity comparison)
 */
function normalizeVolumeTo10gUnits(symbol, rawVolume) {
  const cleanSymbol = symbol.trim().toUpperCase();
  const spec = CONTRACT_SPECS[cleanSymbol];
  if (!spec || !rawVolume) return 0;
  // total grams traded = volume * tradingUnitGrams
  // equivalent 10g units = total grams / 10
  return Number(((rawVolume * spec.tradingUnitGrams) / 10).toFixed(0));
}

/**
 * Normalizes Open Interest to equivalent 10-gram units
 */
function normalizeOpenInterestTo10gUnits(symbol, rawOI) {
  const cleanSymbol = symbol.trim().toUpperCase();
  const spec = CONTRACT_SPECS[cleanSymbol];
  if (!spec || !rawOI) return 0;
  return Number(((rawOI * spec.tradingUnitGrams) / 10).toFixed(0));
}

/**
 * Total nominal value of 1 lot in INR at given price
 */
function getLotValue(symbol, rawPrice) {
  const cleanSymbol = symbol.trim().toUpperCase();
  const spec = CONTRACT_SPECS[cleanSymbol];
  if (!spec || !rawPrice) return 0;
  return Number(((rawPrice / spec.quoteUnitGrams) * spec.tradingUnitGrams).toFixed(2));
}

module.exports = {
  CONTRACT_SPECS,
  getNormalizationMultiplier,
  normalizePrice,
  normalizeVolumeTo10gUnits,
  normalizeOpenInterestTo10gUnits,
  getLotValue
};
