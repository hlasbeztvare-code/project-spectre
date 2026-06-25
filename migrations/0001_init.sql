-- Migration number: 0001 	 2026-06-25T11:35:47.707Z
DROP TABLE IF EXISTS leads;

CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  source TEXT,
  url TEXT,
  price INTEGER,
  title TEXT,
  description TEXT,
  phone TEXT,
  location TEXT,
  score INTEGER,
  status TEXT DEFAULT 'new',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leads_score ON leads(score);