-- Migration 0003: Přidání 8 nových parsovacích zdrojů

INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('sreality', 'Sreality', 2, 'https://www.sreality.cz', 'api');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('ceskereality', 'ČeskéReality', 3, 'https://www.ceskereality.cz', 'html');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('realitymix', 'RealityMix', 3, 'https://realitymix.cz', 'html');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('realcity', 'RealCity', 3, 'https://www.realcity.cz', 'html');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('videobydleni', 'VideoBydlení', 4, 'https://www.videobydleni.cz', 'html');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('realingo', 'Realingo', 4, 'https://www.realingo.cz', 'html');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('bydlet', 'Bydlet.cz', 4, 'https://www.bydlet.cz', 'html');
INSERT INTO source_config (source_name, display_name, priority, base_url, scrape_method) VALUES ('realhit', 'RealHit', 4, 'https://www.realhit.cz', 'html');
