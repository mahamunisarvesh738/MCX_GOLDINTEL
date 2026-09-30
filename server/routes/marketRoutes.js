const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { CONTRACT_SPECS, getNormalizationMultiplier } = require('../config/contracts');

// Get all contract specs
router.get('/contracts', (req, res) => {
  const specs = Object.values(CONTRACT_SPECS).map(spec => ({
    ...spec,
    normalizationMultiplier: getNormalizationMultiplier(spec.symbol)
  }));
  res.json({ success: true, contracts: specs });
});

// Get latest market snapshot across all active contracts
router.get('/latest', async (req, res) => {
  try {
    const latestDateRes = await db.query(
      `SELECT MAX(trade_date) as max_date FROM normalized_derivatives`
    );
    const latestDate = latestDateRes.rows?.[0]?.max_date;
    if (!latestDate) {
      return res.json({ success: true, date: null, contracts: [] });
    }

    const rowsRes = await db.query(
      `SELECT * FROM normalized_derivatives WHERE trade_date = $1 ORDER BY symbol, expiry_date ASC`,
      [latestDate]
    );

    res.json({
      success: true,
      tradeDate: latestDate,
      contracts: rowsRes.rows || []
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get contract price history
router.get('/history/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const limit = parseInt(req.query.limit, 10) || 120;
    const rowsRes = await db.query(
      `SELECT * FROM normalized_derivatives WHERE symbol = $1 ORDER BY trade_date DESC LIMIT $2`,
      [symbol, limit]
    );
    res.json({
      success: true,
      symbol,
      history: (rowsRes.rows || []).reverse()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
