const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit
const { parseBhavcopyText, validateRequestedVsReturnedDate, ingestRecords } = require('../services/mcxIngestionService');
const { computeAllPairAnalytics } = require('../services/relativeValueService');
const { verifyToken } = require('../middleware/authMiddleware');

// Upload and ingest Bhavcopy CSV (Protected - User Login Required)
router.post('/upload-csv', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const csvContent = req.file.buffer.toString('utf8');
    const records = parseBhavcopyText(csvContent);

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid MCX Gold contracts found in the uploaded file. Check headers (SYMBOL, DATE, EXPIRY, CLOSE, VOLUME, OI).'
      });
    }

    const inserted = await ingestRecords(records);
    await computeAllPairAnalytics();

    res.json({
      success: true,
      message: `Successfully parsed and ingested ${inserted.length} contract records!`,
      recordsCount: inserted.length,
      tradeDate: records[0].tradeDate
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger date validation & sync test
router.post('/validate-date', (req, res) => {
  const { requestedDate, sampleRecords } = req.body;
  const validation = validateRequestedVsReturnedDate(requestedDate, sampleRecords || []);
  res.json({ success: true, validation });
});

module.exports = router;
