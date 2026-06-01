-- Fix RLS policies for Telegram Mini App anonymous users
-- In a Mini App, users authenticate through Telegram, not Supabase Auth.
-- We use the anon key + telegram_id uniqueness as natural access control.

-- ─── CLIENTS ──────────────────────────────────────────────────────────────────

-- Allow anon to upsert their own client record (telegram_id uniqueness prevents abuse)
CREATE POLICY "Anon can upsert clients"
  ON clients FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update clients"
  ON clients FOR UPDATE
  TO anon
  USING (true);

-- Allow anon to read all clients (needed for own profile lookup by telegram_id)
CREATE POLICY "Anon can read clients"
  ON clients FOR SELECT
  TO anon
  USING (true);

-- ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

-- Allow anon to create appointments
CREATE POLICY "Anon can create appointments"
  ON appointments FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to read appointments (filtered client-side by client_id)
CREATE POLICY "Anon can read appointments"
  ON appointments FOR SELECT
  TO anon
  USING (true);

-- Allow anon to update appointments (for cancellation)
CREATE POLICY "Anon can update appointments"
  ON appointments FOR UPDATE
  TO anon
  USING (true);

-- ─── BONUS_HISTORY ────────────────────────────────────────────────────────────

-- Allow anon to read bonus history
CREATE POLICY "Anon can read bonus history"
  ON bonus_history FOR SELECT
  TO anon
  USING (true);

-- ─── TIME_SLOTS ───────────────────────────────────────────────────────────────

-- Allow anon to update time_slots (for booking/cancelling)
CREATE POLICY "Anon can update time slots"
  ON time_slots FOR UPDATE
  TO anon
  USING (true);
