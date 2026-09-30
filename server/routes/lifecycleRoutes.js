const express = require('express');
const router = express.Router();
const { getContractCalendar, getOiLifecycleCurve } = require('../services/lifecycleService');

// Get active contract calendar and tender period alerts
router.get('/calendar', async (req, res) => {
  try {
    const date = req.query.date;
    const data = await getContractCalendar(date);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get open interest buildup curve across lifecycle
router.get('/oi-curve', async (req, res) => {
  try {
    const symbol = (req.query.symbol || 'GOLDM').toUpperCase();
    const curve = await getOiLifecycleCurve(symbol);
    res.json({ success: true, symbol, curve });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
