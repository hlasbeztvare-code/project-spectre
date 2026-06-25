-- Migration 0002: Full schema for client specification
-- Extends the leads table with all required fields and adds config tables

-- Add new columns to leads table
ALTER TABLE leads ADD COLUMN offer_type TEXT DEFAULT 'prodej'; -- prodej / pronájem
ALTER TABLE leads ADD COLUMN property_type TEXT DEFAULT 'jine'; -- byt/dům/pozemek/chata/chalupa/garáž/komerce/jiné
ALTER TABLE leads ADD COLUMN disposition TEXT; -- 1+1, 2+kk, 3+1, etc.
ALTER TABLE leads ADD COLUMN area_m2 REAL; -- plocha v m2
ALTER TABLE leads ADD COLUMN ad_published_date DATETIME; -- datum vložení inzerátu
ALTER TABLE leads ADD COLUMN ad_status TEXT DEFAULT 'aktivni'; -- aktivni/neaktivni/smazany/nedostupny
ALTER TABLE leads ADD COLUMN duplicate_count INTEGER DEFAULT 0;

-- Scoring rules table (configurable without redeploy)
CREATE TABLE IF NOT EXISTS scoring_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_type TEXT NOT NULL, -- 'realitka_keyword', 'soukromnik_keyword', 'realitka_pattern', 'soukromnik_pattern'
    keyword TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Source configuration table
CREATE TABLE IF NOT EXISTS source_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 5, -- 1=highest, lower = scraped more frequently
    base_url TEXT,
    scrape_method TEXT DEFAULT 'html', -- html/api/manual
    last_success DATETIME,
    last_error TEXT,
    last_run DATETIME,
    total_runs INTEGER DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    notes TEXT
);

-- Insert default scoring rules
-- Realitka keywords
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'realitní kancelář', 25);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'realitní kanceláře', 25);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'rk ', 20);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'makléř', 25);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'makléřka', 25);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'provize', 20);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'ev. číslo', 20);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'číslo zakázky', 20);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'broker', 15);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'zastoupení', 15);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'exkluzivně nabízíme', 20);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'exkluzivně', 15);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'naše společnost', 20);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'realitní servis', 15);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'právní servis', 15);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'financování zajistíme', 15);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'nabízíme vám', 15);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'nabízíme k prodeji', 15);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 're/max', 30);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'century 21', 30);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'm&m reality', 30);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'next reality', 25);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('realitka_keyword', 'sting', 20);

-- Soukromnik keywords
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('soukromnik_keyword', 'bez rk', 30);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('soukromnik_keyword', 'bez realitky', 30);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('soukromnik_keyword', 'realitky nevolat', 30);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('soukromnik_keyword', 'nevolat realitky', 30);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('soukromnik_keyword', 'přímý majitel', 30);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('soukromnik_keyword', 'prodám vlastní byt', 25);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('soukromnik_keyword', 'prodám vlastní dům', 25);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('soukromnik_keyword', 'prodám sám', 25);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('soukromnik_keyword', 'soukromý prodej', 25);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('soukromnik_keyword', 'vlastník', 20);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('soukromnik_keyword', 'nechci realitku', 25);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('soukromnik_keyword', 'bez provize', 20);
INSERT INTO scoring_rules (rule_type, keyword, points) VALUES ('soukromnik_keyword', 'přímo od majitele', 25);

-- Insert default source configurations
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('bazos', 'Bazoš Reality', 1, 'https://reality.bazos.cz', 'html');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('bezrealitky', 'Bezrealitky', 1, 'https://www.bezrealitky.cz', 'api');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('sbazar', 'Sbazar Nemovitosti', 2, 'https://www.sbazar.cz', 'manual');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('avizo', 'Avízo Reality', 2, 'https://www.avizo.cz', 'html');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('annonce', 'Annonce Reality', 3, 'https://www.annonce.cz', 'html');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('hyperinzerce', 'Hyperinzerce Reality', 3, 'https://reality.hyperinzerce.cz', 'html');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('kuprealitu', 'KupRealitu', 2, 'https://www.kuprealitu.cz', 'api');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('realizujte', 'Realizujte', 3, 'https://www.realizujte.cz', 'html');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('mujrealitak', 'MůjRealiťák', 3, 'https://www.mujrealitak.cz', 'html');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('manual', 'Ruční import', 5, NULL, 'manual');

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_offer_type ON leads(offer_type);
CREATE INDEX IF NOT EXISTS idx_property_type ON leads(property_type);
CREATE INDEX IF NOT EXISTS idx_ad_status ON leads(ad_status);
CREATE INDEX IF NOT EXISTS idx_duplicate_group ON leads(duplicate_group);
CREATE INDEX IF NOT EXISTS idx_region ON leads(region);
CREATE INDEX IF NOT EXISTS idx_district ON leads(district);
CREATE INDEX IF NOT EXISTS idx_city ON leads(city);
