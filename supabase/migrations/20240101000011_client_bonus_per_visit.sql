-- Per-client bonus override: if NULL — use global app_settings 'bonus_per_visit'
ALTER TABLE clients ADD COLUMN IF NOT EXISTS bonus_per_visit INTEGER CHECK (bonus_per_visit > 0);
