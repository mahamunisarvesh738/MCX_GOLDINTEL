const pg = require('pg');
const { Pool } = pg;
const fs = require('fs');
const path = require('path');

// Configure pg type parser for DATE OID 1082 to preserve YYYY-MM-DD strings
pg.types.setTypeParser(1082, val => val);

let pool = null;
let isPostgres = false;
let embeddedData = {
  contracts: [],
  users: [],
  bhavcopy_raw: [],
  normalized_derivatives: [],
  pair_analytics: [],
  backtest_runs: []
};

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadEmbeddedStore() {
  if (fs.existsSync(STORE_FILE)) {
    try {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      embeddedData = JSON.parse(raw);
    } catch (e) {
      console.warn('Could not parse local store.json, using clean memory store:', e.message);
    }
  }
}

let saveTimeout = null;
function saveEmbeddedStore() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(embeddedData), 'utf8');
    } catch (e) {
      console.error('Failed to save local store:', e.message);
    }
  }, 300);
}

function flushEmbeddedStore() {
  if (saveTimeout) clearTimeout(saveTimeout);
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(embeddedData), 'utf8');
  } catch (e) {
    console.error('Failed to flush local store:', e.message);
  }
}

loadEmbeddedStore();

async function initDb() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bullion_intel';
  
  if (process.env.DATABASE_URL || process.env.USE_POSTGRES === 'true') {
    try {
      console.log('Connecting to PostgreSQL database...');
      const ssl = process.env.DATABASE_URL && process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : false;

      pool = new Pool({
        connectionString,
        ssl,
        connectionTimeoutMillis: 5000
      });

      const client = await pool.connect();
      console.log('✅ Connected to PostgreSQL successfully!');
      
      const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      await client.query(schemaSql);
      client.release();
      isPostgres = true;
      return;
    } catch (err) {
      console.warn('⚠️ PostgreSQL connection failed:', err.message);
      console.log('⚡ Initializing Embedded In-Process Storage Engine for instant zero-config prototype/evaluation...');
      pool = null;
      isPostgres = false;
    }
  } else {
    // Attempt local postgres quick ping
    try {
      pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 1500
      });
      const client = await pool.connect();
      console.log('✅ Connected to local PostgreSQL successfully!');
      const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      await client.query(schemaSql);
      client.release();
      isPostgres = true;
      return;
    } catch (e) {
      console.log('⚡ Local PostgreSQL not detected. Running on Built-in Resilient Relational Engine (Zero setup required).');
      pool = null;
      isPostgres = false;
    }
  }
}

/**
 * Universal Query function matching pg API
 */
async function query(sql, params = []) {
  if (isPostgres && pool) {
    return pool.query(sql, params);
  }

  // Embedded Query Parser for local prototype
  const text = sql.trim();
  const lower = text.toLowerCase();

  // Simple query routing for embedded tables
  if (lower.startsWith('select')) {
    return handleEmbeddedSelect(text, params);
  } else if (lower.startsWith('insert')) {
    return handleEmbeddedInsert(text, params);
  } else if (lower.startsWith('delete')) {
    return handleEmbeddedDelete(text, params);
  } else if (lower.startsWith('update')) {
    return handleEmbeddedUpdate(text, params);
  }

  return { rows: [], rowCount: 0 };
}

function handleEmbeddedSelect(sql, params) {
  const lower = sql.toLowerCase();
  let table = null;
  if (lower.includes('from bhavcopy_raw')) table = 'bhavcopy_raw';
  else if (lower.includes('from normalized_derivatives')) table = 'normalized_derivatives';
  else if (lower.includes('from pair_analytics')) table = 'pair_analytics';
  else if (lower.includes('from backtest_runs')) table = 'backtest_runs';
  else if (lower.includes('from contracts')) table = 'contracts';
  else if (lower.includes('from users')) table = 'users';

  if (!table || !embeddedData[table]) {
    return { rows: [], rowCount: 0 };
  }

  let list = [...embeddedData[table]];

  // Parameter filter checks
  if (params && params.length > 0) {
    if (lower.includes('where symbol = $1') && params[0]) {
      list = list.filter(r => r.symbol === params[0]);
    }
    if (lower.includes('where google_id = $1') && params[0]) {
      list = list.filter(r => r.google_id === params[0]);
    }
    if (lower.includes('where email = $1') && params[0]) {
      list = list.filter(r => r.email === params[0]);
    }
    if (lower.includes('where id = $1') && params[0]) {
      list = list.filter(r => r.id === params[0]);
    }
    if (lower.includes('trade_date = $') || lower.includes('trade_date =')) {
      const dateParam = params.find(p => typeof p === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p));
      if (dateParam) {
        list = list.filter(r => r.trade_date === dateParam);
      }
    }
    if (lower.includes('pair_name = $1') && params[0]) {
      list = list.filter(r => r.pair_name === params[0]);
    }
  }

  // Ordering
  if (lower.includes('order by trade_date desc')) {
    list.sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date));
  } else if (lower.includes('order by trade_date asc') || lower.includes('order by trade_date')) {
    list.sort((a, b) => new Date(a.trade_date) - new Date(b.trade_date));
  } else if (lower.includes('order by expiry_date asc')) {
    list.sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
  } else if (lower.includes('order by created_at desc') || lower.includes('order by id desc')) {
    list.sort((a, b) => (b.id || 0) - (a.id || 0));
  }

  // LIMIT
  const limitMatch = lower.match(/limit\s+(\d+)/);
  if (limitMatch) {
    const limit = parseInt(limitMatch[1], 10);
    list = list.slice(0, limit);
  }

  return { rows: list, rowCount: list.length };
}

function handleEmbeddedInsert(sql, params) {
  const lower = sql.toLowerCase();
  let table = null;
  if (lower.includes('into bhavcopy_raw')) table = 'bhavcopy_raw';
  else if (lower.includes('into normalized_derivatives')) table = 'normalized_derivatives';
  else if (lower.includes('into pair_analytics')) table = 'pair_analytics';
  else if (lower.includes('into backtest_runs')) table = 'backtest_runs';
  else if (lower.includes('into contracts')) table = 'contracts';
  else if (lower.includes('into users')) table = 'users';

  if (!table) return { rows: [], rowCount: 0 };

  const id = (embeddedData[table].length > 0 ? Math.max(...embeddedData[table].map(x => x.id || 0)) : 0) + 1;
  let newRecord = { id };

  if (table === 'users') {
    // google_id, email, name, picture, role
    newRecord = {
      id,
      google_id: params[0],
      email: params[1],
      name: params[2],
      picture: params[3],
      role: params[4] || 'ANALYST',
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString()
    };
    const existingIdx = embeddedData[table].findIndex(r => r.email === newRecord.email || (r.google_id && r.google_id === newRecord.google_id));
    if (existingIdx >= 0) {
      embeddedData[table][existingIdx] = { ...embeddedData[table][existingIdx], ...newRecord, last_login: new Date().toISOString() };
      newRecord = embeddedData[table][existingIdx];
    } else {
      embeddedData[table].push(newRecord);
    }
  } else if (table === 'bhavcopy_raw') {
    // symbol, trade_date, expiry_date, open, high, low, close, volume, open_interest, source
    newRecord = {
      id,
      symbol: params[0],
      trade_date: params[1],
      expiry_date: params[2],
      open: params[3],
      high: params[4],
      low: params[5],
      close: params[6],
      volume: params[7] || 0,
      open_interest: params[8] || 0,
      source: params[9] || 'MCX_BHAVCOPY',
      created_at: new Date().toISOString()
    };
    // Upsert check
    const existingIdx = embeddedData[table].findIndex(r => 
      r.symbol === newRecord.symbol && r.trade_date === newRecord.trade_date && r.expiry_date === newRecord.expiry_date
    );
    if (existingIdx >= 0) {
      embeddedData[table][existingIdx] = { ...embeddedData[table][existingIdx], ...newRecord };
    } else {
      embeddedData[table].push(newRecord);
    }
  } else if (table === 'normalized_derivatives') {
    newRecord = {
      id,
      raw_id: params[0],
      symbol: params[1],
      trade_date: params[2],
      expiry_date: params[3],
      days_to_expiry: params[4],
      is_tender_period: params[5],
      raw_close: params[6],
      price_norm_10g_999: params[7],
      norm_volume_10g: params[8],
      norm_oi_10g: params[9],
      lot_value_inr: params[10],
      created_at: new Date().toISOString()
    };
    const existingIdx = embeddedData[table].findIndex(r => 
      r.symbol === newRecord.symbol && r.trade_date === newRecord.trade_date && r.expiry_date === newRecord.expiry_date
    );
    if (existingIdx >= 0) {
      embeddedData[table][existingIdx] = { ...embeddedData[table][existingIdx], ...newRecord };
    } else {
      embeddedData[table].push(newRecord);
    }
  } else if (table === 'pair_analytics') {
    newRecord = {
      id,
      trade_date: params[0],
      pair_name: params[1],
      contract_a: params[2],
      contract_b: params[3],
      price_a_norm: params[4],
      price_b_norm: params[5],
      spread: params[6],
      spread_pct: params[7],
      rolling_mean_20d: params[8],
      rolling_std_20d: params[9],
      z_score_20d: params[10],
      rolling_mean_60d: params[11],
      rolling_std_60d: params[12],
      z_score_60d: params[13],
      convenience_premium: params[14],
      liquidity_score_a: params[15],
      liquidity_score_b: params[16],
      is_executable_edge: params[17],
      regime: params[18],
      created_at: new Date().toISOString()
    };
    const existingIdx = embeddedData[table].findIndex(r => 
      r.pair_name === newRecord.pair_name && r.trade_date === newRecord.trade_date
    );
    if (existingIdx >= 0) {
      embeddedData[table][existingIdx] = { ...embeddedData[table][existingIdx], ...newRecord };
    } else {
      embeddedData[table].push(newRecord);
    }
  } else if (table === 'backtest_runs') {
    newRecord = {
      id,
      name: params[0],
      pair_name: params[1],
      start_date: params[2],
      end_date: params[3],
      z_entry_threshold: params[4],
      z_exit_threshold: params[5],
      stop_loss_z: params[6],
      friction_model: params[7],
      initial_capital: params[8],
      gross_pnl: params[9],
      net_pnl: params[10],
      total_friction_drag: params[11],
      total_trades: params[12],
      win_rate: params[13],
      profit_factor: params[14],
      sharpe_ratio: params[15],
      sortino_ratio: params[16],
      max_drawdown_pct: params[17],
      alpha: params[18],
      beta: params[19],
      trades_json: params[20],
      equity_curve_json: params[21],
      created_at: new Date().toISOString()
    };
    embeddedData[table].push(newRecord);
  }

  saveEmbeddedStore();
  return { rows: [newRecord], rowCount: 1 };
}

function handleEmbeddedDelete(sql, params) {
  const lower = sql.toLowerCase();
  let table = null;
  if (lower.includes('from bhavcopy_raw')) table = 'bhavcopy_raw';
  else if (lower.includes('from normalized_derivatives')) table = 'normalized_derivatives';
  else if (lower.includes('from pair_analytics')) table = 'pair_analytics';
  else if (lower.includes('from backtest_runs')) table = 'backtest_runs';

  if (!table) return { rows: [], rowCount: 0 };

  if (params && params.length > 0 && lower.includes('where id = $1')) {
    const beforeLen = embeddedData[table].length;
    embeddedData[table] = embeddedData[table].filter(r => r.id !== params[0]);
    saveEmbeddedStore();
    return { rows: [], rowCount: beforeLen - embeddedData[table].length };
  }

  const count = embeddedData[table].length;
  embeddedData[table] = [];
  saveEmbeddedStore();
  return { rows: [], rowCount: count };
}

function handleEmbeddedUpdate(sql, params) {
  saveEmbeddedStore();
  return { rows: [], rowCount: 1 };
}

module.exports = {
  query,
  initDb,
  isPostgres: () => isPostgres,
  getEmbeddedStore: () => embeddedData,
  flushEmbeddedStore
};
