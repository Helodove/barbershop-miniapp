-- App settings table for configurable values
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default: 100 bonus points per appointment
INSERT INTO app_settings (key, value, description) VALUES
  ('bonus_per_visit', '100', 'Количество бонусных баллов за каждую запись');

-- RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "Public can read settings"
  ON app_settings FOR SELECT
  USING (true);

-- Only service_role can modify
CREATE POLICY "Service role can manage settings"
  ON app_settings FOR ALL
  USING (auth.role() = 'service_role');
