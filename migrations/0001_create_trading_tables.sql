-- ============================================================
-- 주식 자동매매 시스템 - D1 3차 정규화(3NF) 스키마
-- ============================================================

-- 1. stocks: 종목 기본 정보 (참조 테이블)
CREATE TABLE IF NOT EXISTS stocks (
  stock_code TEXT PRIMARY KEY,
  stock_name TEXT NOT NULL,
  market_type TEXT NOT NULL DEFAULT 'KOSPI' CHECK (market_type IN ('KOSPI', 'KOSDAQ')),
  sector TEXT,
  listing_date TEXT
);

-- 2. positions: 보유 포지션 (stock_code FK)
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_code TEXT NOT NULL,
  buy_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  order_no TEXT,
  buy_date TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (stock_code) REFERENCES stocks(stock_code),
  UNIQUE (stock_code)
);
CREATE INDEX IF NOT EXISTS idx_positions_stock ON positions(stock_code);

-- 3. trade_logs: 매매 내역 (stock_code FK, amount는 price*quantity로 계산)
CREATE TABLE IF NOT EXISTS trade_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_code TEXT NOT NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  profit_rate REAL,
  order_no TEXT,
  traded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (stock_code) REFERENCES stocks(stock_code)
);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trade_logs(traded_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_stock ON trade_logs(stock_code);

-- 4. price_history: 일별 가격 데이터 (stock_code FK, UNIQUE 복합키)
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_code TEXT NOT NULL,
  date TEXT NOT NULL,
  open INTEGER,
  high INTEGER,
  low INTEGER,
  close INTEGER,
  volume INTEGER,
  FOREIGN KEY (stock_code) REFERENCES stocks(stock_code),
  UNIQUE (stock_code, date)
);
CREATE INDEX IF NOT EXISTS idx_price_stock_date ON price_history(stock_code, date DESC);

-- 5. analysis_results: 분석 결과 (stock_code FK)
CREATE TABLE IF NOT EXISTS analysis_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stock_code TEXT NOT NULL,
  analysis_date TEXT NOT NULL DEFAULT (datetime('now')),
  price_close INTEGER,
  ma_5 REAL,
  ma_20 REAL,
  ma_60 REAL,
  rsi_14 REAL,
  macd REAL,
  macd_signal REAL,
  bollinger_upper REAL,
  bollinger_mid REAL,
  bollinger_lower REAL,
  signal_score INTEGER,
  FOREIGN KEY (stock_code) REFERENCES stocks(stock_code)
);
CREATE INDEX IF NOT EXISTS idx_analysis_stock_date ON analysis_results(stock_code, analysis_date DESC);

-- 6. strategies: 전략 설정 (정규화)
CREATE TABLE IF NOT EXISTS strategies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT DEFAULT 'General',
  description TEXT,
  config_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. backtest_results: 백테스팅 결과 (strategy_id FK)
CREATE TABLE IF NOT EXISTS backtest_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_id INTEGER NOT NULL,
  stock_code TEXT,
  run_date TEXT NOT NULL DEFAULT (datetime('now')),
  days INTEGER NOT NULL,
  initial_capital INTEGER NOT NULL,
  final_capital REAL,
  total_return REAL,
  total_trades INTEGER DEFAULT 0,
  win_trades INTEGER DEFAULT 0,
  lose_trades INTEGER DEFAULT 0,
  max_drawdown REAL,
  profit_factor REAL,
  sharpe_ratio REAL,
  result_json TEXT,
  FOREIGN KEY (strategy_id) REFERENCES strategies(id)
);
CREATE INDEX IF NOT EXISTS idx_backtest_strategy ON backtest_results(strategy_id);
CREATE INDEX IF NOT EXISTS idx_backtest_date ON backtest_results(run_date DESC);