-- Add auth_user_id to link barbers to Supabase Auth accounts
ALTER TABLE barbers ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS barbers_auth_user_id_idx ON barbers(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Allow authenticated users (admin panel) to manage barbers (activate/deactivate/edit)
CREATE POLICY "Authenticated can manage barbers"
  ON barbers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage services
CREATE POLICY "Authenticated can manage services"
  ON services FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage schedules
CREATE POLICY "Authenticated can manage barber_schedules"
  ON barber_schedules FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage time slots
CREATE POLICY "Authenticated can manage time_slots"
  ON time_slots FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage appointments
CREATE POLICY "Authenticated can manage appointments"
  ON appointments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage clients
CREATE POLICY "Authenticated can manage clients"
  ON clients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to manage bonus_history
CREATE POLICY "Authenticated can manage bonus_history"
  ON bonus_history FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
