-- ============================================================
-- 주식 자동매매 시스템 - D1 테이블 생성
-- ============================================================

CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_code TEXT NOT NULL UNIQUE,
  stock_name TEXT,
  buy_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  order_no TEXT,
  buy_date TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_positions_stock_code ON positions(stock_code);

CREATE TABLE IF NOT EXISTS trade_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  stock_code TEXT NOT NULL,
  stock_name TEXT,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  profit_rate REAL,
  order_no TEXT,
  traded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trade_logs_traded_at ON trade_logs(traded_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_logs_stock_code ON trade_logs(stock_code);

CREATE TABLE IF NOT EXISTS stock_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_code TEXT NOT NULL,
  analysis_date TEXT NOT NULL DEFAULT (datetime('now')),
  current_price INTEGER,
  ma_short REAL,
  ma_mid REAL,
  ma_long REAL,
  rsi REAL,
  macd REAL,
  signal_score INTEGER
);

CREATE INDEX IF NOT EXISTS idx_stock_analysis_code_date ON stock_analysis(stock_code, analysis_date DESC);