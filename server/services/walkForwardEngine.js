const db = require('../config/db');
const { CONTRACT_SPECS, getLotValue } = require('../config/contracts');
const { calculateRollingMetrics } = require('./relativeValueService');

// Indian Commodities Statutory Charges Rates
const STATUTORY_RATES = {
  MCX_TURNOVER: 0.000021,     // 0.0021% (₹210 per crore)
  CTT_SELL: 0.0001,           // 0.01% on sell side turnover
  SEBI_FEES: 0.000001,        // 0.0001% (₹10 per crore)
  STAMP_DUTY_BUY: 0.00002,    // 0.002% on buy side
  GST_RATE: 0.18,             // 18% on brokerage & exchange fees
  FLAT_BROKERAGE_PER_ORDER: 20 // ₹20 flat per executed order
};

/**
 * Calculates complete Indian commodity transaction fees + slippage for an order
 */
function calculateOrderFriction({ symbol, price, quantityLots, isSell, slippageMultiplier = 1.0, volume10g = 1000 }) {
  const spec = CONTRACT_SPECS[symbol];
  if (!spec) return { totalCost: 0, breakdown: {} };

  const turnover = (price / spec.quoteUnitGrams) * spec.tradingUnitGrams * quantityLots;
  const exchangeFee = turnover * STATUTORY_RATES.MCX_TURNOVER;
  const ctt = isSell ? turnover * STATUTORY_RATES.CTT_SELL : 0;
  const stampDuty = !isSell ? turnover * STATUTORY_RATES.STAMP_DUTY_BUY : 0;
  const sebi = turnover * STATUTORY_RATES.SEBI_FEES;
  const brokerage = STATUTORY_RATES.FLAT_BROKERAGE_PER_ORDER;
  const gst = (brokerage + exchangeFee + sebi) * STATUTORY_RATES.GST_RATE;

  // Dynamic liquidity slippage penalty
  // Base 0.02% + illiquidity penalty inversely proportional to sqrt of volume
  const volSafe = Math.max(5, volume10g || 50);
  const slippagePct = (0.0002 + (0.0015 / Math.sqrt(volSafe / 50))) * slippageMultiplier;
  const slippageCost = turnover * slippagePct;

  const totalCost = exchangeFee + ctt + stampDuty + sebi + brokerage + gst + slippageCost;

  return {
    totalCost: Number(totalCost.toFixed(2)),
    breakdown: {
      turnover: Number(turnover.toFixed(2)),
      exchangeFee: Number(exchangeFee.toFixed(2)),
      ctt: Number(ctt.toFixed(2)),
      stampDuty: Number(stampDuty.toFixed(2)),
      sebi: Number(sebi.toFixed(2)),
      brokerage: Number(brokerage.toFixed(2)),
      gst: Number(gst.toFixed(2)),
      slippageCost: Number(slippageCost.toFixed(2)),
      slippagePct: Number((slippagePct * 100).toFixed(4))
    }
  };
}

/**
 * Executes a Walk-Forward backtest for a relative value pair
 */
async function runWalkForwardBacktest({
  pairName = 'GOLDM - GOLDPETAL',
  startDate = '2024-01-01',
  endDate = '2026-09-30',
  zEntryThreshold = 2.0,
  zExitThreshold = 0.5,
  stopLossZ = 3.5,
  frictionMultiplier = 1.0,
  initialCapital = 1000000, // ₹10,00,000
  minVolumeFilter10g = 30   // filter thin days
}) {
  // Extract contracts
  const cleanPair = pairName.replace(/\+/g, ' ');
  const [symA, symB] = cleanPair.split(' - ').map(s => s.trim());
  const specA = CONTRACT_SPECS[symA];
  const specB = CONTRACT_SPECS[symB];

  if (!specA || !specB) {
    throw new Error(`Invalid contracts for pair: ${pairName}`);
  }

  // Gram ratio for hedging (e.g. GOLDM 100g vs GOLDPETAL 1g -> 1 lot of A = 100 lots of B)
  const lotsRatioBperA = Math.max(1, Math.round(specA.tradingUnitGrams / specB.tradingUnitGrams));
  const lotA = 1;
  const lotB = lotsRatioBperA;

  // Fetch chronological normalized daily data
  const rawRowsRes = await db.query(
    `SELECT * FROM normalized_derivatives 
     WHERE (symbol = $1 OR symbol = $2) AND trade_date >= $3 AND trade_date <= $4 AND days_to_expiry > 0
     ORDER BY trade_date ASC, expiry_date ASC`,
    [symA, symB, startDate, endDate]
  );

  const rows = rawRowsRes.rows || [];
  if (rows.length === 0) {
    return { error: 'No historical contract data found in the selected date range.' };
  }

  // Group by date
  const byDate = {};
  for (const r of rows) {
    if (!byDate[r.trade_date]) byDate[r.trade_date] = {};
    if (!byDate[r.trade_date][r.symbol]) {
      byDate[r.trade_date][r.symbol] = r; // pick nearest active contract
    }
  }

  const dateList = Object.keys(byDate).sort();
  if (dateList.length < 25) {
    return { error: 'Insufficient trading history for statistical lookback window (minimum 25 days required).' };
  }

  // State variables for walk-forward execution
  let currentPosition = null; // null | { type: 'LONG_A_SHORT_B' | 'SHORT_A_LONG_B', entryDate, entryPriceA, entryPriceB, entryCosts, entryZ }
  const trades = [];
  const dailyEquityCurve = [];
  let cash = initialCapital;
  const spreadHistory = [];

  // Track gold benchmark for beta attribution
  const goldBenchmarkReturns = [];
  const strategyDailyReturns = [];
  let prevEquity = initialCapital;

  for (let i = 0; i < dateList.length; i++) {
    const date = dateList[i];
    const dataA = byDate[date][symA];
    const dataB = byDate[date][symB];

    if (!dataA || !dataB) continue;

    const normA = parseFloat(dataA.price_norm_10g_999);
    const normB = parseFloat(dataB.price_norm_10g_999);
    const rawA = parseFloat(dataA.raw_close);
    const rawB = parseFloat(dataB.raw_close);
    const volA = parseInt(dataA.norm_volume_10g, 10);
    const volB = parseInt(dataB.norm_volume_10g, 10);
    const dteA = dataA.days_to_expiry;
    const dteB = dataB.days_to_expiry;
    const isTender = dataA.is_tender_period || dataB.is_tender_period;

    const spread = normA - normB;
    spreadHistory.push(spread);

    // Calculate rolling 20-day z-score using strictly past-and-current data (no lookahead!)
    const { mean, std, zScore } = calculateRollingMetrics(spreadHistory, spreadHistory.length - 1, 20);

    // Compute Mark-to-Market equity
    let currentEquity = cash;
    if (currentPosition) {
      const pnlA = currentPosition.type === 'LONG_A_SHORT_B'
        ? (rawA - currentPosition.entryRawA) * (specA.tradingUnitGrams / specA.quoteUnitGrams) * lotA
        : (currentPosition.entryRawA - rawA) * (specA.tradingUnitGrams / specA.quoteUnitGrams) * lotA;

      const pnlB = currentPosition.type === 'LONG_A_SHORT_B'
        ? (currentPosition.entryRawB - rawB) * (specB.tradingUnitGrams / specB.quoteUnitGrams) * lotB
        : (rawB - currentPosition.entryRawB) * (specB.tradingUnitGrams / specB.quoteUnitGrams) * lotB;

      currentEquity += (pnlA + pnlB);
    }

    // Benchmark gold return for attribution
    if (i > 0 && dateList[i - 1]) {
      const prevDataA = byDate[dateList[i - 1]]?.[symA];
      if (prevDataA) {
        const goldRet = (normA - parseFloat(prevDataA.price_norm_10g_999)) / parseFloat(prevDataA.price_norm_10g_999);
        const stratRet = (currentEquity - prevEquity) / prevEquity;
        goldBenchmarkReturns.push(goldRet);
        strategyDailyReturns.push(stratRet);
      }
    }
    prevEquity = currentEquity;

    dailyEquityCurve.push({
      date,
      equity: Number(currentEquity.toFixed(2)),
      cash: Number(cash.toFixed(2)),
      spread: Number(spread.toFixed(2)),
      zScore: zScore !== null ? Number(zScore.toFixed(2)) : 0,
      inPosition: currentPosition !== null
    });

    // POSITION MANAGEMENT & EXIT CHECKS
    if (currentPosition) {
      let shouldExit = false;
      let exitReason = '';

      // Mean reversion exit: Z returned within exit threshold
      if (currentPosition.type === 'LONG_A_SHORT_B' && zScore !== null && zScore >= -zExitThreshold) {
        shouldExit = true;
        exitReason = 'MEAN_REVERSION_TARGET';
      } else if (currentPosition.type === 'SHORT_A_LONG_B' && zScore !== null && zScore <= zExitThreshold) {
        shouldExit = true;
        exitReason = 'MEAN_REVERSION_TARGET';
      }

      // Stop-loss exit
      if (Math.abs(zScore || 0) >= stopLossZ) {
        shouldExit = true;
        exitReason = 'STOP_LOSS_Z';
      }

      // Tender period force exit (Rule: never hold into physical delivery tender window!)
      if (isTender || dteA <= 6 || dteB <= 6) {
        shouldExit = true;
        exitReason = 'TENDER_EXPIRY_RISK_AVOIDANCE';
      }

      if (shouldExit) {
        // Exit trade and deduct exit friction
        const isSellA = currentPosition.type === 'LONG_A_SHORT_B';
        const isSellB = !isSellA;

        const exitFrictionA = calculateOrderFriction({
          symbol: symA,
          price: rawA,
          quantityLots: lotA,
          isSell: isSellA,
          slippageMultiplier: frictionMultiplier,
          volume10g: volA
        });

        const exitFrictionB = calculateOrderFriction({
          symbol: symB,
          price: rawB,
          quantityLots: lotB,
          isSell: isSellB,
          slippageMultiplier: frictionMultiplier,
          volume10g: volB
        });

        const grossPnlA = currentPosition.type === 'LONG_A_SHORT_B'
          ? (rawA - currentPosition.entryRawA) * (specA.tradingUnitGrams / specA.quoteUnitGrams) * lotA
          : (currentPosition.entryRawA - rawA) * (specA.tradingUnitGrams / specA.quoteUnitGrams) * lotA;

        const grossPnlB = currentPosition.type === 'LONG_A_SHORT_B'
          ? (currentPosition.entryRawB - rawB) * (specB.tradingUnitGrams / specB.quoteUnitGrams) * lotB
          : (rawB - currentPosition.entryRawB) * (specB.tradingUnitGrams / specB.quoteUnitGrams) * lotB;

        const grossPnl = grossPnlA + grossPnlB;
        const totalFriction = currentPosition.entryFriction + exitFrictionA.totalCost + exitFrictionB.totalCost;
        const netPnl = grossPnl - totalFriction;

        cash += netPnl;

        trades.push({
          tradeId: trades.length + 1,
          type: currentPosition.type,
          entryDate: currentPosition.entryDate,
          exitDate: date,
          daysHeld: Math.max(1, (new Date(date) - new Date(currentPosition.entryDate)) / (1000 * 60 * 60 * 24)),
          entryZ: currentPosition.entryZ,
          exitZ: zScore !== null ? Number(zScore.toFixed(2)) : 0,
          grossPnl: Number(grossPnl.toFixed(2)),
          frictionPaid: Number(totalFriction.toFixed(2)),
          netPnl: Number(netPnl.toFixed(2)),
          returnPct: Number(((netPnl / initialCapital) * 100).toFixed(3)),
          exitReason
        });

        currentPosition = null;
      }
    }

    // ENTRY SIGNALS (Only if currently flat and enough lookback history)
    if (!currentPosition && zScore !== null && i >= 20) {
      // Check liquidity filter
      const isLiquid = volA >= minVolumeFilter10g && volB >= minVolumeFilter10g;
      
      // Do not enter during tender periods
      if (isLiquid && !isTender && dteA > 10 && dteB > 10) {
        // Condition 1: A is significantly underpriced relative to B (Z <= -zEntryThreshold)
        // -> Buy A, Sell B
        if (zScore <= -zEntryThreshold) {
          const entryCostA = calculateOrderFriction({
            symbol: symA, price: rawA, quantityLots: lotA, isSell: false, slippageMultiplier: frictionMultiplier, volume10g: volA
          });
          const entryCostB = calculateOrderFriction({
            symbol: symB, price: rawB, quantityLots: lotB, isSell: true, slippageMultiplier: frictionMultiplier, volume10g: volB
          });

          currentPosition = {
            type: 'LONG_A_SHORT_B',
            entryDate: date,
            entryRawA: rawA,
            entryRawB: rawB,
            entryZ: Number(zScore.toFixed(2)),
            entryFriction: entryCostA.totalCost + entryCostB.totalCost
          };
        }
        // Condition 2: A is significantly overpriced relative to B (Z >= zEntryThreshold)
        // -> Sell A, Buy B
        else if (zScore >= zEntryThreshold) {
          const entryCostA = calculateOrderFriction({
            symbol: symA, price: rawA, quantityLots: lotA, isSell: true, slippageMultiplier: frictionMultiplier, volume10g: volA
          });
          const entryCostB = calculateOrderFriction({
            symbol: symB, price: rawB, quantityLots: lotB, isSell: false, slippageMultiplier: frictionMultiplier, volume10g: volB
          });

          currentPosition = {
            type: 'SHORT_A_LONG_B',
            entryDate: date,
            entryRawA: rawA,
            entryRawB: rawB,
            entryZ: Number(zScore.toFixed(2)),
            entryFriction: entryCostA.totalCost + entryCostB.totalCost
          };
        }
      }
    }
  }

  // Performance summary calculations
  const totalTrades = trades.length;
  const grossPnl = trades.reduce((acc, t) => acc + t.grossPnl, 0);
  const totalFriction = trades.reduce((acc, t) => acc + t.frictionPaid, 0);
  const netPnl = trades.reduce((acc, t) => acc + t.netPnl, 0);
  const winningTrades = trades.filter(t => t.netPnl > 0);
  const losingTrades = trades.filter(t => t.netPnl <= 0);
  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

  const totalGains = winningTrades.reduce((acc, t) => acc + t.netPnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((acc, t) => acc + t.netPnl, 0));
  const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? 99.0 : 0;

  // Max Drawdown
  let peak = initialCapital;
  let maxDd = 0;
  for (const pt of dailyEquityCurve) {
    if (pt.equity > peak) peak = pt.equity;
    const dd = (peak - pt.equity) / peak;
    if (dd > maxDd) maxDd = dd;
  }

  // Sharpe and Sortino ratio (annualized, 252 days)
  let sharpe = 0;
  let sortino = 0;
  if (strategyDailyReturns.length > 10) {
    const meanRet = strategyDailyReturns.reduce((a, b) => a + b, 0) / strategyDailyReturns.length;
    const variance = strategyDailyReturns.reduce((a, b) => a + Math.pow(b - meanRet, 2), 0) / strategyDailyReturns.length;
    const stdRet = Math.sqrt(variance);
    const downsideVar = strategyDailyReturns.filter(r => r < 0).reduce((a, b) => a + Math.pow(b, 2), 0) / strategyDailyReturns.length;
    const downsideStd = Math.sqrt(downsideVar);

    const rfDaily = 0.065 / 252; // 6.5% risk free
    if (stdRet > 0.0001) {
      sharpe = ((meanRet - rfDaily) / stdRet) * Math.sqrt(252);
    }
    if (downsideStd > 0.0001) {
      sortino = ((meanRet - rfDaily) / downsideStd) * Math.sqrt(252);
    }
  }

  // Alpha / Beta Attribution vs Outright Gold
  let beta = 0;
  let alpha = 0;
  if (goldBenchmarkReturns.length === strategyDailyReturns.length && goldBenchmarkReturns.length > 10) {
    const meanGold = goldBenchmarkReturns.reduce((a, b) => a + b, 0) / goldBenchmarkReturns.length;
    const meanStrat = strategyDailyReturns.reduce((a, b) => a + b, 0) / strategyDailyReturns.length;
    const varGold = goldBenchmarkReturns.reduce((a, b) => a + Math.pow(b - meanGold, 2), 0) / goldBenchmarkReturns.length;
    
    let cov = 0;
    for (let k = 0; k < goldBenchmarkReturns.length; k++) {
      cov += (goldBenchmarkReturns[k] - meanGold) * (strategyDailyReturns[k] - meanStrat);
    }
    cov /= goldBenchmarkReturns.length;

    if (varGold > 0.00001) {
      beta = cov / varGold;
      alpha = (meanStrat - beta * meanGold) * 252; // annualized alpha
    }
  }

  // Breakeven Analysis: Check if edge survives costs
  const costSurvived = netPnl > 0;
  const breakevenFrictionMultiple = totalFriction > 0 ? (grossPnl / totalFriction) : 0;

  return {
    pairName: cleanPair,
    contractA: symA,
    contractB: symB,
    lotSizeA: lotA,
    lotSizeB: lotB,
    startDate,
    endDate,
    initialCapital,
    finalEquity: !isNaN(netPnl) ? Number((initialCapital + netPnl).toFixed(2)) : initialCapital,
    grossPnl: !isNaN(grossPnl) ? Number(grossPnl.toFixed(2)) : 0,
    totalFriction: !isNaN(totalFriction) ? Number(totalFriction.toFixed(2)) : 0,
    netPnl: !isNaN(netPnl) ? Number(netPnl.toFixed(2)) : 0,
    returnOnCapitalPct: !isNaN(netPnl) ? Number(((netPnl / initialCapital) * 100).toFixed(2)) : 0,
    totalTrades,
    winRate: !isNaN(winRate) ? Number(winRate.toFixed(1)) : 0,
    profitFactor: !isNaN(profitFactor) ? Number(profitFactor.toFixed(2)) : 0,
    sharpeRatio: !isNaN(sharpe) ? Number(sharpe.toFixed(2)) : 0,
    sortinoRatio: !isNaN(sortino) ? Number(sortino.toFixed(2)) : 0,
    maxDrawdownPct: !isNaN(maxDd) ? Number((maxDd * 100).toFixed(2)) : 0,
    alphaAnnualized: !isNaN(alpha) ? Number(alpha.toFixed(4)) : 0,
    betaToGold: !isNaN(beta) ? Number(beta.toFixed(3)) : 0,
    costSurvived,
    breakevenFrictionMultiple: !isNaN(breakevenFrictionMultiple) ? Number(breakevenFrictionMultiple.toFixed(2)) : 0,
    frictionMultiplier,
    dailyEquityCurve: dailyEquityCurve.slice(-200), // last 200 points for chart rendering
    trades: trades.slice(-50) // last 50 trades
  };
}

module.exports = {
  STATUTORY_RATES,
  calculateOrderFriction,
  runWalkForwardBacktest
};
