const axios = require('axios');
const { parse } = require('date-fns');
const db = require('../config/db');
const { CONTRACT_SPECS, normalizePrice, normalizeVolumeTo10gUnits, normalizeOpenInterestTo10gUnits, getLotValue } = require('../config/contracts');

// Month mapping for compact MCX expiry dates like '04SEP2026' or '27FEB2025'
const MONTH_MAP = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
};

/**
 * Normalizes MCX Expiry string (e.g. '04SEP2026' or '04-SEP-2026') to ISO 'YYYY-MM-DD'
 */
function parseMCXExpiryDate(rawExpiry) {
  if (!rawExpiry) return null;
  const cleaned = rawExpiry.toString().trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  const match = cleaned.match(/^(\d{2})([A-Z]{3})(\d{4})$/);
  if (!match) return null;
  const day = match[1];
  const monthStr = match[2];
  const year = match[3];
  const month = MONTH_MAP[monthStr];
  if (!month) return null;
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes MCX Response Date (which uses MM/DD/YYYY or DD-MM-YYYY) to ISO 'YYYY-MM-DD'
 */
function parseMCXResponseDate(rawDate) {
  if (!rawDate) return null;
  const str = rawDate.toString().trim();
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // MCX response often uses MM/DD/YYYY
  const partsSlash = str.split('/');
  if (partsSlash.length === 3) {
    let [p1, p2, p3] = partsSlash;
    if (p3.length === 4) {
      // Check if p1 is month (<= 12)
      const m = parseInt(p1, 10);
      const d = parseInt(p2, 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${p3}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  // Fallback for DD-MM-YYYY
  const partsHyphen = str.split('-');
  if (partsHyphen.length === 3) {
    if (partsHyphen[2].length === 4) {
      return `${partsHyphen[2]}-${partsHyphen[1].padStart(2, '0')}-${partsHyphen[0].padStart(2, '0')}`;
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

/**
 * Parses raw text/CSV bhavcopy data from MCX or uploaded file
 */
function parseBhavcopyText(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim().toUpperCase());

  const records = [];
  const symbolIdx = headers.findIndex(h => h.includes('SYMBOL') || h.includes('COMMODITY'));
  const dateIdx = headers.findIndex(h => h === 'DATE' || h.includes('TRADE_DATE') || h.includes('TRADEDATE'));
  const expiryIdx = headers.findIndex(h => h.includes('EXPIRY'));
  const openIdx = headers.findIndex(h => h === 'OPEN' || h.includes('OPEN_PRICE'));
  const highIdx = headers.findIndex(h => h === 'HIGH' || h.includes('HIGH_PRICE'));
  const lowIdx = headers.findIndex(h => h === 'LOW' || h.includes('LOW_PRICE'));
  const closeIdx = headers.findIndex(h => h === 'CLOSE' || h.includes('CLOSE_PRICE') || h.includes('SETTLEMENT'));
  const volIdx = headers.findIndex(h => h.includes('VOLUME') || h.includes('VOL') || h.includes('QTY'));
  const oiIdx = headers.findIndex(h => h.includes('OPEN_INTEREST') || h === 'OI');

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 4) continue;

    const rawSymbol = cols[symbolIdx] || '';
    const cleanSymbol = rawSymbol.trim().toUpperCase();

    // Only process Bullion Gold contracts
    if (!CONTRACT_SPECS[cleanSymbol]) continue;

    const rawDate = cols[dateIdx];
    const tradeDate = parseMCXResponseDate(rawDate);
    const rawExpiry = cols[expiryIdx];
    const expiryDate = parseMCXExpiryDate(rawExpiry);

    if (!tradeDate || !expiryDate) continue;

    // GOLDTEN listing validation: Available only from 2025 onwards
    if (cleanSymbol === 'GOLDTEN' && tradeDate < '2025-01-01') {
      continue;
    }

    const open = parseFloat(cols[openIdx]) || null;
    const high = parseFloat(cols[highIdx]) || null;
    const low = parseFloat(cols[lowIdx]) || null;
    const close = parseFloat(cols[closeIdx]) || 0;
    const volume = parseInt(cols[volIdx], 10) || 0;
    const openInterest = parseInt(cols[oiIdx], 10) || 0;

    records.push({
      symbol: cleanSymbol,
      tradeDate,
      expiryDate,
      open,
      high,
      low,
      close,
      volume,
      openInterest
    });
  }

  return records;
}

/**
 * Validates requested date against returned date.
 * Crucial MCX requirement: "Validate the returned Date against the requested date.
 * MCX may return the most recent available trading day for an unrecognized, holiday, malformed, or future date."
 */
function validateRequestedVsReturnedDate(requestedDateStr, records) {
  if (!records || records.length === 0) {
    return {
      isValid: false,
      reason: 'No records found for the requested query.'
    };
  }

  const returnedDate = records[0].tradeDate;
  if (requestedDateStr !== returnedDate) {
    return {
      isValid: false,
      isHolidayOrRollover: true,
      requestedDate: requestedDateStr,
      returnedDate,
      reason: `MCX Rollover Warning: Requested date ${requestedDateStr} is a non-trading day/holiday. MCX returned fallback prior trading day ${returnedDate}.`
    };
  }

  return {
    isValid: true,
    tradeDate: returnedDate
  };
}

/**
 * Calculates days to expiry and checks if within tender period (5 trading days prior)
 */
function calculateContractLifecycleState(tradeDateStr, expiryDateStr) {
  const tDate = new Date(tradeDateStr);
  const eDate = new Date(expiryDateStr);
  const diffTime = eDate.getTime() - tDate.getTime();
  const daysToExpiry = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  
  // In MCX, tender period starts 5 trading days (~7 calendar days) before expiry
  const isTenderPeriod = daysToExpiry <= 7 && daysToExpiry > 0;
  return { daysToExpiry, isTenderPeriod };
}

/**
 * Ingest records into database (raw + normalized)
 */
async function ingestRecords(records) {
  const { computeAllPairAnalytics } = require('./relativeValueService');
  const inserted = [];
  for (const r of records) {
    const rawRes = await db.query(
      `INSERT INTO bhavcopy_raw (symbol, trade_date, expiry_date, open, high, low, close, volume, open_interest, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (symbol, trade_date, expiry_date) DO UPDATE SET
         open = EXCLUDED.open,
         high = EXCLUDED.high,
         low = EXCLUDED.low,
         close = EXCLUDED.close,
         volume = EXCLUDED.volume,
         open_interest = EXCLUDED.open_interest,
         source = EXCLUDED.source
       RETURNING id`,
      [r.symbol, r.tradeDate, r.expiryDate, r.open, r.high, r.low, r.close, r.volume, r.openInterest, 'MCX_BHAVCOPY']
    );

    const rawId = rawRes.rows && rawRes.rows[0] ? rawRes.rows[0].id : null;
    const { daysToExpiry, isTenderPeriod } = calculateContractLifecycleState(r.tradeDate, r.expiryDate);
    const priceNorm = normalizePrice(r.symbol, r.close);
    const normVol = normalizeVolumeTo10gUnits(r.symbol, r.volume);
    const normOI = normalizeOpenInterestTo10gUnits(r.symbol, r.openInterest);
    const lotValue = getLotValue(r.symbol, r.close);

    await db.query(
      `INSERT INTO normalized_derivatives 
       (raw_id, symbol, trade_date, expiry_date, days_to_expiry, is_tender_period, raw_close, price_norm_10g_999, norm_volume_10g, norm_oi_10g, lot_value_inr)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (symbol, trade_date, expiry_date) DO UPDATE SET
         raw_id = EXCLUDED.raw_id,
         days_to_expiry = EXCLUDED.days_to_expiry,
         is_tender_period = EXCLUDED.is_tender_period,
         raw_close = EXCLUDED.raw_close,
         price_norm_10g_999 = EXCLUDED.price_norm_10g_999,
         norm_volume_10g = EXCLUDED.norm_volume_10g,
         norm_oi_10g = EXCLUDED.norm_oi_10g,
         lot_value_inr = EXCLUDED.lot_value_inr`,
      [rawId, r.symbol, r.tradeDate, r.expiryDate, daysToExpiry, isTenderPeriod, r.close, priceNorm, normVol, normOI, lotValue]
    );

    inserted.push({
      ...r,
      daysToExpiry,
      isTenderPeriod,
      priceNorm,
      normVol,
      normOI,
      lotValue
    });
  }

  // Re-calculate analytics & rolling metrics after ingestion
  try {
    await computeAllPairAnalytics();
  } catch (e) {
    console.warn('Post-ingestion pair analytics re-computation warning:', e.message);
  }

  return inserted;
}

module.exports = {
  parseMCXExpiryDate,
  parseMCXResponseDate,
  parseBhavcopyText,
  validateRequestedVsReturnedDate,
  calculateContractLifecycleState,
  ingestRecords
};
