-- Enable RLS on all tables
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_history ENABLE ROW LEVEL SECURITY;

-- BARBERS: public read for active barbers
CREATE POLICY "Public can view active barbers"
  ON barbers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage barbers"
  ON barbers FOR ALL
  USING (auth.role() = 'service_role');

-- SERVICES: public read for active services
CREATE POLICY "Public can view active services"
  ON services FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage services"
  ON services FOR ALL
  USING (auth.role() = 'service_role');

-- TIME_SLOTS: public read
CREATE POLICY "Public can view time slots"
  ON time_slots FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage time slots"
  ON time_slots FOR ALL
  USING (auth.role() = 'service_role');

-- BARBER_SCHEDULES: public read
CREATE POLICY "Public can view barber schedules"
  ON barber_schedules FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage schedules"
  ON barber_schedules FOR ALL
  USING (auth.role() = 'service_role');

-- CLIENTS: clients can only see their own record
CREATE POLICY "Clients can view own record"
  ON clients FOR SELECT
  USING (telegram_id::text = auth.jwt() ->> 'telegram_id');

CREATE POLICY "Service role can manage clients"
  ON clients FOR ALL
  USING (auth.role() = 'service_role');

-- APPOINTMENTS: clients see their own, service role sees all
CREATE POLICY "Clients can view own appointments"
  ON appointments FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE telegram_id::text = auth.jwt() ->> 'telegram_id'
    )
  );

CREATE POLICY "Service role can manage appointments"
  ON appointments FOR ALL
  USING (auth.role() = 'service_role');

-- BONUS_HISTORY: clients see their own
CREATE POLICY "Clients can view own bonus history"
  ON bonus_history FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE telegram_id::text = auth.jwt() ->> 'telegram_id'
    )
  );

CREATE POLICY "Service role can manage bonus history"
  ON bonus_history FOR ALL
  USING (auth.role() = 'service_role');
