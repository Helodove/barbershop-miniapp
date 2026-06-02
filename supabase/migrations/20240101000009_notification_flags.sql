-- Track which notifications have been sent to avoid duplicates
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS notified_created    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notified_day_before BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notified_hour_before BOOLEAN DEFAULT false;

-- Index for fast lookup of appointments that need notifications
CREATE INDEX IF NOT EXISTS idx_appointments_notifications
  ON appointments (status, notified_created, notified_day_before, notified_hour_before)
  WHERE status NOT IN ('cancelled', 'completed');

-- RLS: anon can read notification flags (needed for bot polling)
CREATE POLICY "Service role can update notification flags"
  ON appointments FOR UPDATE
  TO authenticated
  USING (true);
