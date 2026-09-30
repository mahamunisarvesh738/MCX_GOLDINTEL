const db = require('../config/db');
const { CONTRACT_SPECS } = require('../config/contracts');

/**
 * Returns contract calendar with tender periods, days to expiry, and lifecycle phases
 */
async function getContractCalendar(currentDate) {
  let refDate = currentDate;
  if (!refDate) {
    const latestQuery = await db.query(
      `SELECT trade_date FROM normalized_derivatives ORDER BY trade_date DESC LIMIT 1`
    );
    refDate = latestQuery.rows?.[0]?.trade_date || new Date().toISOString().split('T')[0];
  }

  const contractsRes = await db.query(
    `SELECT DISTINCT symbol, expiry_date, MAX(trade_date) as last_seen_date, 
            MAX(price_norm_10g_999) as latest_norm_price,
            MAX(norm_volume_10g) as latest_vol_10g,
            MAX(norm_oi_10g) as latest_oi_10g
     FROM normalized_derivatives 
     WHERE trade_date <= $1 AND expiry_date >= $1
     GROUP BY symbol, expiry_date
     ORDER BY symbol, expiry_date ASC`,
    [refDate]
  );

  const list = contractsRes.rows || [];
  const calendarItems = [];

  for (const item of list) {
    const spec = CONTRACT_SPECS[item.symbol];
    if (!spec) continue;

    const tDate = new Date(refDate);
    const eDate = new Date(item.expiry_date);
    const diffTime = eDate.getTime() - tDate.getTime();
    const dte = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Tender period starts 5 trading days (~7 calendar days) before expiry
    const tenderStartDate = new Date(eDate);
    tenderStartDate.setDate(tenderStartDate.getDate() - 7);
    const tenderStartStr = tenderStartDate.toISOString().split('T')[0];
    const daysToTender = Math.max(0, Math.ceil((tenderStartDate.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24)));

    let phase = 'PRIME_LIQUIDITY_WINDOW';
    let phaseBadge = 'Prime Trading Window';
    let phaseColor = 'emerald';
    let rollRecommendation = 'Normal trading / hold allowed';

    if (dte <= 0) {
      phase = 'EXPIRED';
      phaseBadge = 'Expired';
      phaseColor = 'slate';
      rollRecommendation = 'Contract closed';
    } else if (dte <= 7) {
      phase = 'TENDER_DELIVERY_PERIOD';
      phaseBadge = 'Tender Period (Physical Delivery)';
      phaseColor = 'rose';
      rollRecommendation = 'CRITICAL: Position must be squared off or marked for delivery. High margin penalty.';
    } else if (dte <= 12) {
      phase = 'ROLL_RECOMMENDED';
      phaseBadge = 'Recommended Roll Window';
      phaseColor = 'amber';
      rollRecommendation = 'Ideal window to roll into next-month contract before tender margins trigger.';
    } else if (dte > 35) {
      phase = 'EARLY_ACCUMULATION';
      phaseBadge = 'Early / Far Month';
      phaseColor = 'blue';
      rollRecommendation = 'Thin liquidity. Open interest accumulating.';
    }

    calendarItems.push({
      symbol: item.symbol,
      contractName: spec.name,
      tradingUnit: `${spec.tradingUnitGrams}g`,
      purity: `${spec.purity} (${(spec.purity / 10).toFixed(1)}% fine)`,
      expiryDate: item.expiry_date,
      daysToExpiry: dte,
      tenderStartDate: tenderStartStr,
      daysToTender,
      latestNormPrice: parseFloat(item.latest_norm_price || 0),
      latestVolume10g: parseInt(item.latest_vol_10g || 0, 10),
      latestOi10g: parseInt(item.latest_oi_10g || 0, 10),
      phase,
      phaseBadge,
      phaseColor,
      rollRecommendation
    });
  }

  // Sort by days to expiry ascending
  calendarItems.sort((a, b) => a.daysToExpiry - b.daysToExpiry);

  return {
    referenceDate: refDate,
    contracts: calendarItems
  };
}

/**
 * Returns historical open interest buildup curve for a specific contract symbol across its lifecycle
 */
async function getOiLifecycleCurve(symbol = 'GOLDM') {
  const res = await db.query(
    `SELECT trade_date, expiry_date, days_to_expiry, norm_oi_10g, norm_volume_10g, price_norm_10g_999
     FROM normalized_derivatives
     WHERE symbol = $1 AND days_to_expiry >= 0 AND days_to_expiry <= 60
     ORDER BY days_to_expiry DESC LIMIT 100`,
    [symbol]
  );

  return (res.rows || []).map(r => ({
    daysToExpiry: r.days_to_expiry,
    openInterest10g: parseInt(r.norm_oi_10g, 10),
    volume10g: parseInt(r.norm_volume_10g, 10),
    priceNorm: parseFloat(r.price_norm_10g_999)
  }));
}

module.exports = {
  getContractCalendar,
  getOiLifecycleCurve
};
