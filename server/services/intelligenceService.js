const { getLatestPairSnapshot, PAIRS } = require('./relativeValueService');
const { calculateOrderFriction } = require('./walkForwardEngine');

/**
 * Evaluates intelligence signals across all contract pairs with quiet-alert suppression
 */
async function getIntelligenceOverview() {
  const snapshot = await getLatestPairSnapshot();
  
  const evaluatedPairs = [];
  let actionableCount = 0;
  let suppressedNoiseCount = 0;
  let suppressedCostCount = 0;
  let tenderRiskCount = 0;

  for (const item of snapshot) {
    const absZ = Math.abs(parseFloat(item.z_score_20d || 0));
    const spread = parseFloat(item.spread || 0);
    const absSpread = Math.abs(spread);
    const liqA = parseFloat(item.liquidity_score_a || 0);
    const liqB = parseFloat(item.liquidity_score_b || 0);

    // Round-trip estimated friction (2 legs entry + 2 legs exit = ~₹90-110 per 10g equivalent)
    const estimatedFriction = 95.0; 
    const netEdge = absSpread - estimatedFriction;

    let status = 'MUTED';
    let statusBadge = 'Noise Suppressed';
    let badgeColor = 'slate';
    let rationale = '';
    let recommendation = 'HOLD FLAT';

    if (item.regime === 'TENDER_RISK') {
      status = 'RESTRICTED';
      statusBadge = 'Tender Window Danger';
      badgeColor = 'rose';
      tenderRiskCount++;
      rationale = 'Contracts have entered or are within 5 days of delivery tender period. Staggered margin hikes and physical delivery obligations create erratic spreads. Trading strictly prohibited.';
      recommendation = 'DO NOT TRADE / SQUARE OFF';
    } else if (liqA < 20 || liqB < 20) {
      status = 'SUPPRESSED';
      statusBadge = 'Illiquid Trap';
      badgeColor = 'amber';
      suppressedCostCount++;
      rationale = `Thin trading depth (Liquidity scores: ${liqA} & ${liqB}). Settlement price is an exchange calculation and cannot be executed at quoted price in the order book.`;
      recommendation = 'AVOID (NON-EXECUTABLE)';
    } else if (netEdge <= 0) {
      status = 'SUPPRESSED';
      statusBadge = 'Cost-Barrier Muted';
      badgeColor = 'amber';
      suppressedCostCount++;
      rationale = `Apparent gross price spread of ₹${absSpread.toFixed(1)}/10g does not survive round-trip transaction costs (Exchange fee, CTT, Stamp Duty, Slippage ~ ₹${estimatedFriction}/10g). Net expected edge is negative (₹${netEdge.toFixed(1)}).`;
      recommendation = 'SUPPRESSED BY FRICTION FILTER';
    } else if (absZ >= 2.0) {
      status = 'ACTIONABLE';
      statusBadge = 'High Conviction Signal';
      badgeColor = 'emerald';
      actionableCount++;
      const dirA = spread > 0 ? 'SELL' : 'BUY';
      const dirB = spread > 0 ? 'BUY' : 'SELL';
      rationale = `Statistical dislocation confirmed (|Z| = ${absZ.toFixed(2)} >= 2.0). Net expected edge survives costs with ₹${netEdge.toFixed(1)}/10g margin. Liquidity verified.`;
      recommendation = `${dirA} ${item.contract_a} & ${dirB} ${item.contract_b}`;
    } else {
      status = 'MUTED';
      statusBadge = 'Noise Suppressed';
      badgeColor = 'slate';
      suppressedNoiseCount++;
      rationale = `Normalized spread is within 2-sigma random noise corridor (|Z| = ${absZ.toFixed(2)} < 2.0). Market is in statistical pricing equilibrium.`;
      recommendation = 'HOLD FLAT / NO ACTION';
    }

    evaluatedPairs.push({
      ...item,
      absZ,
      netEdge: Number(netEdge.toFixed(2)),
      estimatedFriction,
      status,
      statusBadge,
      badgeColor,
      rationale,
      recommendation
    });
  }

  // System-wide intelligence regime
  let systemRegime = 'EFFICIENT_EQUILIBRIUM';
  let systemMessage = 'All contracts are trading within normal arbitrage bounds. System is intentionally quiet to prevent overtrading and fee erosion.';
  let systemColor = 'slate';

  if (actionableCount > 0) {
    systemRegime = 'ACTIONABLE_DISLOCATION_DETECTED';
    systemMessage = `${actionableCount} high-conviction opportunity identified with positive net edge after full Indian statutory transaction costs and slippage.`;
    systemColor = 'emerald';
  } else if (suppressedCostCount > 0) {
    systemRegime = 'FRICTION_DOMINATED';
    systemMessage = 'Spreads observed in settlement data are completely eroded by statutory fees, CTT, and liquidity slippage. Signals suppressed to protect capital.';
    systemColor = 'amber';
  }

  return {
    timestamp: new Date().toISOString(),
    systemRegime,
    systemMessage,
    systemColor,
    metrics: {
      totalPairsTracked: PAIRS.length,
      actionableSignals: actionableCount,
      costSuppressed: suppressedCostCount,
      noiseSuppressed: suppressedNoiseCount,
      tenderRestricted: tenderRiskCount,
      suppressionRatePct: PAIRS.length > 0 ? Number((((PAIRS.length - actionableCount) / PAIRS.length) * 100).toFixed(1)) : 100
    },
    pairs: evaluatedPairs
  };
}

module.exports = {
  getIntelligenceOverview
};
