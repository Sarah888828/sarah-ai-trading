-- Support Korean, US, and China listings in normalized stocks table.
CREATE TABLE stocks_new (
  stock_code TEXT PRIMARY KEY,
  stock_name TEXT NOT NULL,
  market_type TEXT NOT NULL DEFAULT 'KOSPI'
    CHECK (market_type IN ('KOSPI', 'KOSDAQ', 'US', 'CN')),
  sector TEXT,
  listing_date TEXT
);

INSERT INTO stocks_new (stock_code, stock_name, market_type, sector, listing_date)
SELECT stock_code, stock_name, market_type, sector, listing_date FROM stocks;

DROP TABLE stocks;
ALTER TABLE stocks_new RENAME TO stocks;