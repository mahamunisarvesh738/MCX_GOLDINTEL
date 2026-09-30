const express = require('express');
const router = express.Router();
const { PAIRS, getPairHistory, getLatestPairSnapshot } = require('../services/relativeValueService');

// Get all monitored pairs
router.get('/pairs', (req, res) => {
  res.json({ success: true, pairs: PAIRS });
});

// Get current relative value snapshot for all pairs
router.get('/snapshot', async (req, res) => {
  try {
    const snapshot = await getLatestPairSnapshot();
    res.json({ success: true, snapshot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get historical spread & rolling z-scores for a specific pair
router.get('/history', async (req, res) => {
  try {
    const pairName = req.query.pair || 'GOLDM - GOLDPETAL';
    const limit = parseInt(req.query.limit, 10) || 180;
    const history = await getPairHistory(pairName, limit);
    res.json({
      success: true,
      pairName,
      history
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
