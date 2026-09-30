const db = require('../config/db');
const { CONTRACT_SPECS, normalizePrice } = require('../config/contracts');

const PAIRS = [
  { name: 'GOLDM - GOLDPETAL', contractA: 'GOLDM', contractB: 'GOLDPETAL' },
  { name: 'GOLDM - GOLDGUINEA', contractA: 'GOLDM', contractB: 'GOLDGUINEA' },
  { name: 'GOLDM - GOLDTEN', contractA: 'GOLDM', contractB: 'GOLDTEN' },
  { name: 'GOLDTEN - GOLDPETAL', contractA: 'GOLDTEN', contractB: 'GOLDPETAL' },
  { name: 'GOLDTEN - GOLDGUINEA', contractA: 'GOLDTEN', contractB: 'GOLDGUINEA' },
  { name: 'GOLDPETAL - GOLDGUINEA', contractA: 'GOLDPETAL', contractB: 'GOLDGUINEA' }
];

/**
 * Calculates rolling statistics (mean, std dev, z-score) for an array of spreads
 */
function calculateRollingMetrics(spreads, currentIndex, windowSize) {
  const start = Math.max(0, currentIndex - windowSize + 1);
  const subset = spreads.slice(start, currentIndex + 1);
  if (subset.length < 3) {
    return { mean: null, std: null, zScore: null };
  }

  const sum = subset.reduce((acc, val) => acc + val, 0);
  const mean = sum / subset.length;
  const variance = subset.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / subset.length;
  const std = Math.sqrt(variance);

  const currentVal = spreads[currentIndex];
  const zScore = std > 0.001 ? (currentVal - mean) / std : 0;

  return {
    mean: Number(mean.toFixed(2)),
    std: Number(std.toFixed(2)),
    zScore: Number(zScore.toFixed(3))
  };
}

/**
 * Computes Liquidity Execution Score (0 - 100) based on volume and OI
 */
function computeLiquidityScore(vol10g, oi10g) {
  // 1000 10g units (10kg) traded is healthy liquidity
  const volScore = Math.min(60, (vol10g / 500) * 60);
  const oiScore = Math.min(40, (oi10g / 2000) * 40);
  return Number((volScore + oiScore).toFixed(1));
}

/**
 * Classifies the signal regime with strict quiet-suppression logic
 */
function classifyRegime({ zScore, spreadAbs, liqA, liqB, isTenderA, isTenderB, estimatedRoundTripFriction }) {
  if (isTenderA || isTenderB) {
    return {
      regime: 'TENDER_RISK',
      description: 'Contracts in tender delivery period. High margin spikes and delivery risk distort pricing.',
      isActionable: false
    };
  }

  if (liqA < 20 || liqB < 20) {
    return {
      regime: 'ILLIQUID_TRAP',
      description: 'Thin trading volume. Apparent settlement price spread is non-executable in the live order book.',
      isActionable: false
    };
  }

  // Cost check: does the absolute spread exceed 2x round-trip estimated friction?
  if (spreadAbs < estimatedRoundTripFriction * 1.5) {
    return {
      regime: 'COST_DOMINATED',
      description: 'Gross price difference is smaller than exchange fees, CTT, and slippage. No net edge survives.',
      isActionable: false
    };
  }

  // Statistical significance check
  if (Math.abs(zScore) >= 2.0) {
    return {
      regime: 'ACTIONABLE_EDGE',
      description: `High conviction mispricing (|Z| = ${Math.abs(zScore).toFixed(2)} > 2.0). Net edge exceeds friction.`,
      isActionable: true
    };
  }

  return {
    regime: 'NOISE_SUPPRESSED',
    description: 'Spread is within normal statistical distribution (|Z| < 2.0). Alerts suppressed.',
    isActionable: false
  };
}

/**
 * Recomputes all pair analytics across all dates
 */
async function computeAllPairAnalytics() {
  const normQuery = await db.query(
    `SELECT * FROM normalized_derivatives ORDER BY trade_date ASC, expiry_date ASC`
  );
  const rows = normQuery.rows || [];
  if (rows.length === 0) return [];

  // Group by date
  const byDate = {};
  for (const r of rows) {
    if (!byDate[r.trade_date]) byDate[r.trade_date] = [];
    byDate[r.trade_date].push(r);
  }

  const sortedDates = Object.keys(byDate).sort();
  const pairSeries = {};

  // Initialize pair histories
  for (const pair of PAIRS) {
    pairSeries[pair.name] = [];
  }

  // First pass: collect raw spreads by pair for nearest active non-expired contracts
  for (const date of sortedDates) {
    const contractsOnDate = byDate[date];

    for (const pair of PAIRS) {
      // Find nearest active contract for contractA and contractB
      const activeA = contractsOnDate
        .filter(c => c.symbol === pair.contractA && c.days_to_expiry > 0)
        .sort((a, b) => a.days_to_expiry - b.days_to_expiry)[0];

      const activeB = contractsOnDate
        .filter(c => c.symbol === pair.contractB && c.days_to_expiry > 0)
        .sort((a, b) => a.days_to_expiry - b.days_to_expiry)[0];

      if (activeA && activeB) {
        const priceA = parseFloat(activeA.price_norm_10g_999);
        const priceB = parseFloat(activeB.price_norm_10g_999);
        const spread = Number((priceA - priceB).toFixed(2));
        const spreadPct = Number(((spread / priceB) * 100).toFixed(4));
        const liqA = computeLiquidityScore(activeA.norm_volume_10g, activeA.norm_oi_10g);
        const liqB = computeLiquidityScore(activeB.norm_volume_10g, activeB.norm_oi_10g);

        // Retail convenience premium (e.g. Petal or Guinea premium over Mini/Gold)
        let conveniencePremium = 0;
        if (pair.contractB === 'GOLDM' || pair.contractB === 'GOLD') {
          conveniencePremium = spread;
        } else if (pair.contractA === 'GOLDM' || pair.contractA === 'GOLD') {
          conveniencePremium = -spread;
        }

        pairSeries[pair.name].push({
          tradeDate: date,
          pairName: pair.name,
          contractA: pair.contractA,
          contractB: pair.contractB,
          priceA,
          priceB,
          spread,
          spreadPct,
          conveniencePremium,
          liqA,
          liqB,
          isTenderA: activeA.is_tender_period,
          isTenderB: activeB.is_tender_period
        });
      }
    }
  }

  // Second pass: compute rolling z-scores and regimes
  const allResults = [];
  for (const pair of PAIRS) {
    const list = pairSeries[pair.name];
    const spreadVals = list.map(item => item.spread);

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const m20 = calculateRollingMetrics(spreadVals, i, 20);
      const m60 = calculateRollingMetrics(spreadVals, i, 60);

      // Estimated round-trip friction ~ ₹80 to ₹120 per 10g equivalent (Exchange + CTT + Stamp + Slippage)
      const estimatedRoundTripFriction = 95.0;

      const regimeObj = classifyRegime({
        zScore: m20.zScore || 0,
        spreadAbs: Math.abs(item.spread),
        liqA: item.liqA,
        liqB: item.liqB,
        isTenderA: item.isTenderA,
        isTenderB: item.isTenderB,
        estimatedRoundTripFriction
      });

      const entry = {
        tradeDate: item.tradeDate,
        pairName: item.pairName,
        contractA: item.contractA,
        contractB: item.contractB,
        priceANorm: item.priceA,
        priceBNorm: item.priceB,
        spread: item.spread,
        spreadPct: item.spreadPct,
        rollingMean20d: m20.mean,
        rollingStd20d: m20.std,
        zScore20d: m20.zScore,
        rollingMean60d: m60.mean,
        rollingStd60d: m60.std,
        zScore60d: m60.zScore,
        conveniencePremium: item.conveniencePremium,
        liquidityScoreA: item.liqA,
        liquidityScoreB: item.liqB,
        isExecutableEdge: regimeObj.isActionable,
        regime: regimeObj.regime,
        regimeDescription: regimeObj.description
      };

      await db.query(
        `INSERT INTO pair_analytics 
         (trade_date, pair_name, contract_a, contract_b, price_a_norm, price_b_norm, spread, spread_pct,
          rolling_mean_20d, rolling_std_20d, z_score_20d, rolling_mean_60d, rolling_std_60d, z_score_60d,
          convenience_premium, liquidity_score_a, liquidity_score_b, is_executable_edge, regime)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
        [
          entry.tradeDate, entry.pairName, entry.contractA, entry.contractB,
          entry.priceANorm, entry.priceBNorm, entry.spread, entry.spreadPct,
          entry.rollingMean20d, entry.rollingStd20d, entry.zScore20d,
          entry.rollingMean60d, entry.rollingStd60d, entry.zScore60d,
          entry.conveniencePremium, entry.liquidityScoreA, entry.liquidityScoreB,
          entry.isExecutableEdge, entry.regime
        ]
      );

      allResults.push(entry);
    }
  }

  return allResults;
}

/**
 * Gets pair analytics history for a given pair
 */
async function getPairHistory(pairName, limit = 180) {
  const cleanPair = pairName.replace(/\+/g, ' ');
  const res = await db.query(
    `SELECT * FROM pair_analytics WHERE pair_name = $1 ORDER BY trade_date DESC LIMIT $2`,
    [cleanPair, limit]
  );
  return (res.rows || []).reverse();
}

/**
 * Returns latest snapshot for all pairs
 */
async function getLatestPairSnapshot() {
  const snapshot = [];
  for (const pair of PAIRS) {
    const res = await db.query(
      `SELECT * FROM pair_analytics WHERE pair_name = $1 ORDER BY trade_date DESC LIMIT 1`,
      [pair.name]
    );
    if (res.rows && res.rows.length > 0) {
      snapshot.push(res.rows[0]);
    }
  }
  return snapshot;
}

module.exports = {
  PAIRS,
  calculateRollingMetrics,
  computeLiquidityScore,
  classifyRegime,
  computeAllPairAnalytics,
  getPairHistory,
  getLatestPairSnapshot
};
