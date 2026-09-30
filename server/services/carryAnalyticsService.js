const db = require('../config/db');

/**
 * Retrieves the full futures term structure across all contracts for a specific trade date
 */
async function getTermStructure(tradeDate) {
  let targetDate = tradeDate;
  if (!targetDate) {
    const latestQuery = await db.query(
      `SELECT trade_date FROM normalized_derivatives ORDER BY trade_date DESC LIMIT 1`
    );
    if (!latestQuery.rows || latestQuery.rows.length === 0) return { date: null, curves: {} };
    targetDate = latestQuery.rows[0].trade_date;
  }

  const queryRes = await db.query(
    `SELECT * FROM normalized_derivatives WHERE trade_date = $1 AND days_to_expiry > 0 ORDER BY symbol, expiry_date ASC`,
    [targetDate]
  );

  const rows = queryRes.rows || [];
  const curvesBySymbol = {};

  for (const r of rows) {
    if (!curvesBySymbol[r.symbol]) {
      curvesBySymbol[r.symbol] = [];
    }
    curvesBySymbol[r.symbol].push({
      symbol: r.symbol,
      expiryDate: r.expiry_date,
      daysToExpiry: r.days_to_expiry,
      rawClose: parseFloat(r.raw_close),
      priceNorm10g: parseFloat(r.price_norm_10g_999),
      normVolume10g: parseInt(r.norm_volume_10g, 10),
      normOI10g: parseInt(r.norm_oi_10g, 10),
      isTenderPeriod: r.is_tender_period
    });
  }

  // Calculate curve analytics for each contract symbol
  const summary = {};
  for (const [sym, contracts] of Object.entries(curvesBySymbol)) {
    if (contracts.length >= 2) {
      const near = contracts[0];
      const next = contracts[1];
      const dteDiff = next.daysToExpiry - near.daysToExpiry;

      const spread = next.priceNorm10g - near.priceNorm10g;
      const structure = spread > 0 ? 'CONTANGO' : spread < 0 ? 'BACKWARDATION' : 'FLAT';
      
      let impliedAnnualizedCarry = 0;
      if (dteDiff > 0 && near.priceNorm10g > 0) {
        impliedAnnualizedCarry = ((next.priceNorm10g / near.priceNorm10g - 1) * (365 / dteDiff)) * 100;
      }

      summary[sym] = {
        symbol: sym,
        contractsCount: contracts.length,
        structure,
        spreadNearNext: Number(spread.toFixed(2)),
        impliedAnnualizedCarryPct: Number(impliedAnnualizedCarry.toFixed(2)),
        nearExpiry: near.expiryDate,
        nextExpiry: next.expiryDate,
        nearDte: near.daysToExpiry,
        nextDte: next.daysToExpiry
      };
    } else if (contracts.length === 1) {
      summary[sym] = {
        symbol: sym,
        contractsCount: 1,
        structure: 'SINGLE_MONTH',
        spreadNearNext: 0,
        impliedAnnualizedCarryPct: 0,
        nearExpiry: contracts[0].expiryDate,
        nearDte: contracts[0].daysToExpiry
      };
    }
  }

  return {
    tradeDate: targetDate,
    curves: curvesBySymbol,
    summary
  };
}

/**
 * Separates mechanical roll-down toward expiry from genuine curve shifts
 * Evaluates changes over a specified window (e.g. 5, 10, or 20 days)
 */
async function getRollDownDecomposition(symbol = 'GOLDM', windowDays = 10) {
  const datesQuery = await db.query(
    `SELECT DISTINCT trade_date FROM normalized_derivatives WHERE symbol = $1 ORDER BY trade_date DESC LIMIT $2`,
    [symbol, windowDays + 5]
  );

  const dates = (datesQuery.rows || []).map(r => r.trade_date).reverse();
  if (dates.length < 2) return [];

  const decompositionSeries = [];

  for (let i = 1; i < dates.length; i++) {
    const prevDate = dates[i - 1];
    const currDate = dates[i];

    const prevRowsRes = await db.query(
      `SELECT * FROM normalized_derivatives WHERE symbol = $1 AND trade_date = $2 AND days_to_expiry > 0 ORDER BY expiry_date ASC`,
      [symbol, prevDate]
    );
    const currRowsRes = await db.query(
      `SELECT * FROM normalized_derivatives WHERE symbol = $1 AND trade_date = $2 AND days_to_expiry > 0 ORDER BY expiry_date ASC`,
      [symbol, currDate]
    );

    const prevRows = prevRowsRes.rows || [];
    const currRows = currRowsRes.rows || [];

    if (prevRows.length === 0 || currRows.length === 0) continue;

    // Use near month contract held across both days
    const nearPrev = prevRows[0];
    const nearCurr = currRows.find(r => r.expiry_date === nearPrev.expiry_date);

    if (nearCurr) {
      const dtDays = Math.max(1, (new Date(currDate) - new Date(prevDate)) / (1000 * 60 * 60 * 24));
      const pricePrev = parseFloat(nearPrev.price_norm_10g_999);
      const priceCurr = parseFloat(nearCurr.price_norm_10g_999);
      const deltaF = priceCurr - pricePrev;

      // Estimate spot using nearest expiring contract price normalized
      const spotPrev = pricePrev;
      const spotCurr = priceCurr;
      const deltaSpot = spotCurr - spotPrev;

      // Mechanical basis roll-down: as DTE decays, premium decays linearly to 0
      const basisPrev = pricePrev - (parseFloat(prevRows[0].price_norm_10g_999));
      const dtePrev = Math.max(1, nearPrev.days_to_expiry);
      const mechanicalRollDown = -((basisPrev / dtePrev) * dtDays);

      // Genuine curve shift = Total Change - Spot Move - Mechanical Roll-down
      const genuineCurveShift = deltaF - deltaSpot - mechanicalRollDown;

      decompositionSeries.push({
        tradeDate: currDate,
        prevDate,
        expiryDate: nearPrev.expiry_date,
        daysToExpiry: nearCurr.days_to_expiry,
        totalChange: Number(deltaF.toFixed(2)),
        spotMovement: Number(deltaSpot.toFixed(2)),
        mechanicalRollDown: Number(mechanicalRollDown.toFixed(2)),
        genuineCurveShift: Number(genuineCurveShift.toFixed(2)),
        priceNorm: priceCurr
      });
    }
  }

  return decompositionSeries;
}

module.exports = {
  getTermStructure,
  getRollDownDecomposition
};
