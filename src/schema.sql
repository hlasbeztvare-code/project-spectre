CREATE TABLE IF NOT EXISTS leads (
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