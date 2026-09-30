const express = require('express');
const router = express.Router();
const { getTermStructure, getRollDownDecomposition } = require('../services/carryAnalyticsService');

// Get futures term structure curves on a specific date
router.get('/term-structure', async (req, res) => {
  try {
    const tradeDate = req.query.date;
    const result = await getTermStructure(tradeDate);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get roll-down vs curve shift decomposition
router.get('/roll-down', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'GOLDM').toUpperCase();
    const windowDays = parseInt(req.query.window, 10) || 15;
    const series = await getRollDownDecomposition(symbol, windowDays);
    res.json({ success: true, symbol, series });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
