-- ============================================
-- Project Spectre — Full Database Schema
-- ============================================

CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    title TEXT,
    description TEXT,
    offer_type TEXT DEFAULT 'prodej',          -- prodej / pronájem
    property_type TEXT DEFAULT 'jine',          -- byt/dům/pozemek/chata/chalupa/garáž/komerce/jiné
    disposition TEXT,                           -- 1+1, 2+kk, 3+1...
    area_m2 REAL,                              -- plocha v m2
    price INTEGER,
    currency TEXT DEFAULT 'CZK',
    location TEXT,                             -- lokalita jako text
    region TEXT,                               -- kraj
    district TEXT,                             -- okres
    city TEXT,                                 -- město / obec
    phone TEXT,
    email TEXT,
    advertiser_name TEXT,
    advertiser_type TEXT DEFAULT 'neznamo',     -- soukromnik / realitka / neznamo
    realitka_score INTEGER DEFAULT 0,           -- 0-100
    private_score INTEGER DEFAULT 0,            -- 0-100
    duplicate_group TEXT,
    duplicate_count INTEGER DEFAULT 0,
    ad_published_date DATETIME,                -- datum vložení inzerátu
    ad_status TEXT DEFAULT 'aktivni',          -- aktivni/neaktivni/smazany/nedostupny
    status TEXT DEFAULT 'novy',                -- workflow stav
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_url ON leads(url);
CREATE INDEX IF NOT EXISTS idx_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_duplicate_group ON leads(duplicate_group);
CREATE INDEX IF NOT EXISTS idx_region ON leads(region);
CREATE INDEX IF NOT EXISTS idx_district ON leads(district);
CREATE INDEX IF NOT EXISTS idx_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_first_seen ON leads(first_seen);
CREATE INDEX IF NOT EXISTS idx_offer_type ON leads(offer_type);
CREATE INDEX IF NOT EXISTS idx_property_type ON leads(property_type);
CREATE INDEX IF NOT EXISTS idx_ad_status ON leads(ad_status);

-- Scrape run logs
CREATE TABLE IF NOT EXISTS scrape_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    source TEXT,
    processed INTEGER DEFAULT 0,
    new_leads INTEGER DEFAULT 0,
    updated_leads INTEGER DEFAULT 0,
    duplicates INTEGER DEFAULT 0,
    errors TEXT,
    duration_ms INTEGER
);

-- Configurable scoring rules
CREATE TABLE IF NOT EXISTS scoring_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_type TEXT NOT NULL,    -- realitka_keyword / soukromnik_keyword
    keyword TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Source configuration
CREATE TABLE IF NOT EXISTS source_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 5,
    base_url TEXT,
    scrape_method TEXT DEFAULT 'html',
    last_success DATETIME,
    last_error TEXT,
    last_run DATETIME,
    total_runs INTEGER DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    notes TEXT
);