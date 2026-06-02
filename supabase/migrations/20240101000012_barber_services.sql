-- Per-barber service catalog with optional price override
CREATE TABLE barber_services (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id  UUID REFERENCES barbers(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  custom_price INTEGER CHECK (custom_price > 0),
  is_active  BOOLEAN DEFAULT true,
  UNIQUE(barber_id, service_id)
);

CREATE INDEX idx_barber_services_barber ON barber_services(barber_id);

ALTER TABLE barber_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read barber_services"
  ON barber_services FOR SELECT USING (true);

CREATE POLICY "Authenticated can manage barber_services"
  ON barber_services FOR ALL TO authenticated USING (true);

CREATE POLICY "Anon can read barber_services"
  ON barber_services FOR SELECT TO anon USING (true);
