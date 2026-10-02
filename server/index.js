require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./config/db');
const { seedHistoricalData } = require('./seed/historicalDataSeeder');

const marketRoutes = require('./routes/marketRoutes');
const relativeValueRoutes = require('./routes/relativeValueRoutes');
const carryRoutes = require('./routes/carryRoutes');
const backtestRoutes = require('./routes/backtestRoutes');
const intelligenceRoutes = require('./routes/intelligenceRoutes');
const lifecycleRoutes = require('./routes/lifecycleRoutes');
const ingestionRoutes = require('./routes/ingestionRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/market', marketRoutes);
app.use('/api/relative-value', relativeValueRoutes);
app.use('/api/carry', carryRoutes);
app.use('/api/backtest', backtestRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/lifecycle', lifecycleRoutes);
app.use('/api/ingestion', ingestionRoutes);

// Health check endpoint for Render / monitoring
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'GOLDINTEL Commodity Derivatives Intelligence',
    version: '1.0.0'
  });
});

// Serve frontend build in production
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
const altDistPath = path.join(__dirname, '..', 'dist');

const staticPath = require('fs').existsSync(clientDistPath) ? clientDistPath : altDistPath;

app.use(express.static(staticPath));

// Fallback for single-page app (Express 5 compatible)
app.use((req, res) => {
  const indexFile = path.join(staticPath, 'index.html');
  if (require('fs').existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.json({
      message: 'GOLDINTEL Commodity Derivatives Intelligence API Server is Running',
      apiDocs: '/api/health',
      frontend: 'Frontend build not found at static path. Run npm run build in client/'
    });
  }
});

async function startServer() {
  try {
    console.log('🚀 Starting GOLDINTEL Server...');
    await initDb();
    await seedHistoricalData();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`📡 GOLDINTEL Commodity Derivatives Intelligence Server Live on PORT ${PORT}`);
      console.log(`🌐 Local URL: http://localhost:${PORT}`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Fatal error starting server:', err);
    process.exit(1);
  }
}

startServer();
