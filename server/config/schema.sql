-- MCX Goldintel Derivatives Intelligence Database Schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS contracts (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    trading_unit_grams NUMERIC(10, 2) NOT NULL,
    quote_unit_grams NUMERIC(10, 2) NOT NULL,
    purity INT NOT NULL,
    purity_factor NUMERIC(6, 4) NOT NULL,
    expiry_window VARCHAR(50),
    tender_period_days INT DEFAULT 5,
    min_tick NUMERIC(6, 2) DEFAULT 1.00,
    typical_volume_tier VARCHAR(50),
    description TEXT,
    available_from DATE
);

CREATE TABLE IF NOT EXISTS bhavcopy_raw (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    trade_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    open NUMERIC(12, 2),
    high NUMERIC(12, 2),
    low NUMERIC(12, 2),
    close NUMERIC(12, 2) NOT NULL,
    volume BIGINT DEFAULT 0,
    open_interest BIGINT DEFAULT 0,
    source VARCHAR(50) DEFAULT 'MCX_BHAVCOPY',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_symbol_date_expiry UNIQUE (symbol, trade_date, expiry_date)
);

CREATE INDEX IF NOT EXISTS idx_bhavcopy_date ON bhavcopy_raw(trade_date);
CREATE INDEX IF NOT EXISTS idx_bhavcopy_symbol ON bhavcopy_raw(symbol);
CREATE INDEX IF NOT EXISTS idx_bhavcopy_expiry ON bhavcopy_raw(expiry_date);

CREATE TABLE IF NOT EXISTS normalized_derivatives (
    id SERIAL PRIMARY KEY,
    raw_id INT REFERENCES bhavcopy_raw(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    trade_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    days_to_expiry INT NOT NULL,
    is_tender_period BOOLEAN DEFAULT FALSE,
    raw_close NUMERIC(12, 2) NOT NULL,
    price_norm_10g_999 NUMERIC(12, 2) NOT NULL,
    norm_volume_10g BIGINT DEFAULT 0,
    norm_oi_10g BIGINT DEFAULT 0,
    lot_value_inr NUMERIC(14, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_norm_symbol_date_expiry UNIQUE (symbol, trade_date, expiry_date)
);

CREATE INDEX IF NOT EXISTS idx_norm_date ON normalized_derivatives(trade_date);
CREATE INDEX IF NOT EXISTS idx_norm_symbol_date ON normalized_derivatives(symbol, trade_date);

CREATE TABLE IF NOT EXISTS pair_analytics (
    id SERIAL PRIMARY KEY,
    trade_date DATE NOT NULL,
    pair_name VARCHAR(40) NOT NULL,
    contract_a VARCHAR(20) NOT NULL,
    contract_b VARCHAR(20) NOT NULL,
    price_a_norm NUMERIC(12, 2) NOT NULL,
    price_b_norm NUMERIC(12, 2) NOT NULL,
    spread NUMERIC(12, 2) NOT NULL, -- price_a_norm - price_b_norm
    spread_pct NUMERIC(8, 4) NOT NULL,
    rolling_mean_20d NUMERIC(12, 2),
    rolling_std_20d NUMERIC(12, 2),
    z_score_20d NUMERIC(8, 3),
    rolling_mean_60d NUMERIC(12, 2),
    rolling_std_60d NUMERIC(12, 2),
    z_score_60d NUMERIC(8, 3),
    convenience_premium NUMERIC(12, 2),
    liquidity_score_a NUMERIC(6, 2),
    liquidity_score_b NUMERIC(6, 2),
    is_executable_edge BOOLEAN DEFAULT FALSE,
    regime VARCHAR(30) DEFAULT 'NOISE_SUPPRESSED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pair_date UNIQUE (pair_name, trade_date)
);

CREATE INDEX IF NOT EXISTS idx_pair_date ON pair_analytics(trade_date);
CREATE INDEX IF NOT EXISTS idx_pair_name ON pair_analytics(pair_name);

CREATE TABLE IF NOT EXISTS backtest_runs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    pair_name VARCHAR(40) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    z_entry_threshold NUMERIC(5, 2) NOT NULL,
    z_exit_threshold NUMERIC(5, 2) NOT NULL,
    stop_loss_z NUMERIC(5, 2),
    friction_model VARCHAR(50) DEFAULT 'MCX_FULL_STATUTORY_SLIPPAGE',
    initial_capital NUMERIC(14, 2) DEFAULT 1000000,
    gross_pnl NUMERIC(14, 2),
    net_pnl NUMERIC(14, 2),
    total_friction_drag NUMERIC(14, 2),
    total_trades INT,
    win_rate NUMERIC(6, 2),
    profit_factor NUMERIC(6, 2),
    sharpe_ratio NUMERIC(6, 2),
    sortino_ratio NUMERIC(6, 2),
    max_drawdown_pct NUMERIC(6, 2),
    alpha NUMERIC(8, 4),
    beta NUMERIC(8, 4),
    trades_json JSONB,
    equity_curve_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
