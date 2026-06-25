CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    title TEXT,
    description TEXT,
    price INTEGER,
    currency TEXT DEFAULT 'CZK',
    location TEXT,
    region TEXT,
    district TEXT,
    city TEXT,
    phone TEXT,
    email TEXT,
    advertiser_name TEXT,
    advertiser_type TEXT DEFAULT 'neznamo',
    realitka_score INTEGER DEFAULT 0,
    private_score INTEGER DEFAULT 0,
    duplicate_group TEXT,
    status TEXT DEFAULT 'novy',
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_check DATETIME DEFAULT CURRENT_TIMESTAMP,
    note TEXT,
    assigned_to TEXT,
    contact_date DATETIME,
    contact_result TEXT,
    raw_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_url ON leads(url);
CREATE INDEX IF NOT EXISTS idx_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_duplicate ON leads(duplicate_group);
CREATE INDEX IF NOT EXISTS idx_region ON leads(region);
CREATE INDEX IF NOT EXISTS idx_first_seen ON leads(first_seen);

CREATE TABLE IF NOT EXISTS scrape_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    source TEXT,
    processed INTEGER DEFAULT 0,
    new_leads INTEGER DEFAULT 0,
    errors TEXT,
    duration_ms INTEGER
);