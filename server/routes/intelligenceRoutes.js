const express = require('express');
const router = express.Router();
const { getIntelligenceOverview } = require('../services/intelligenceService');

// Get intelligence signal dashboard with quiet alert suppression state
router.get('/overview', async (req, res) => {
  try {
    const data = await getIntelligenceOverview();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
