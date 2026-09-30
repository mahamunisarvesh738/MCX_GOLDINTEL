const express = require('express');
const router = express.Router();
const { runWalkForwardBacktest } = require('../services/walkForwardEngine');

// Run a customized walk-forward simulation
router.post('/run', async (req, res) => {
  try {
    const {
      pairName,
      startDate,
      endDate,
      zEntryThreshold,
      zExitThreshold,
      stopLossZ,
      frictionMultiplier,
      initialCapital,
      minVolumeFilter10g
    } = req.body;

    const result = await runWalkForwardBacktest({
      pairName: pairName || 'GOLDM - GOLDPETAL',
      startDate: startDate || '2024-01-01',
      endDate: endDate || '2026-09-30',
      zEntryThreshold: parseFloat(zEntryThreshold) || 2.0,
      zExitThreshold: parseFloat(zExitThreshold) || 0.5,
      stopLossZ: parseFloat(stopLossZ) || 3.5,
      frictionMultiplier: parseFloat(frictionMultiplier) !== undefined ? parseFloat(frictionMultiplier) : 1.0,
      initialCapital: parseFloat(initialCapital) || 1000000,
      minVolumeFilter10g: parseInt(minVolumeFilter10g, 10) || 30
    });

    if (result.error) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, backtest: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Run cost sensitivity analysis across varying friction multiples (0x to 2x)
router.post('/cost-sensitivity', async (req, res) => {
  try {
    const { pairName, startDate, endDate, zEntryThreshold, zExitThreshold } = req.body;
    const multiples = [0.0, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const curve = [];

    for (const mult of multiples) {
      const run = await runWalkForwardBacktest({
        pairName: pairName || 'GOLDM - GOLDPETAL',
        startDate: startDate || '2024-01-01',
        endDate: endDate || '2026-09-30',
        zEntryThreshold: parseFloat(zEntryThreshold) || 2.0,
        zExitThreshold: parseFloat(zExitThreshold) || 0.5,
        frictionMultiplier: mult,
        initialCapital: 1000000
      });

      if (!run.error) {
        curve.push({
          frictionMultiplier: mult,
          label: mult === 0 ? 'Zero Friction (Gross)' : mult === 1.0 ? '100% Statutory MCX' : `${mult * 100}% Costs`,
          grossPnl: run.grossPnl,
          frictionPaid: run.totalFriction,
          netPnl: run.netPnl,
          sharpeRatio: run.sharpeRatio,
          winRate: run.winRate,
          edgeSurvives: run.netPnl > 0
        });
      }
    }

    res.json({ success: true, sensitivityCurve: curve });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
