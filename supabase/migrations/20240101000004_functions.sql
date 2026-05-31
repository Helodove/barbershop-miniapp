-- Atomic bonus increment/decrement functions
CREATE OR REPLACE FUNCTION increment_client_bonus(p_client_id UUID, p_points INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  UPDATE clients
  SET bonus_points = bonus_points + p_points
  WHERE id = p_client_id
  RETURNING bonus_points INTO new_balance;
  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION increment_client_visits(p_client_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE clients
  SET total_visits = total_visits + 1
  WHERE id = p_client_id
  RETURNING total_visits INTO new_count;
  RETURN new_count;
END;
$$;

-- Check constraints for data integrity
ALTER TABLE clients ADD CONSTRAINT clients_bonus_points_non_negative CHECK (bonus_points >= 0);
ALTER TABLE clients ADD CONSTRAINT clients_total_visits_non_negative CHECK (total_visits >= 0);

-- Bonus cap constraint: bonus_used cannot exceed 20% of total_price
ALTER TABLE appointments ADD CONSTRAINT appointments_bonus_cap
  CHECK (bonus_used <= FLOOR(total_price * 0.20));

-- Time slots unique constraint to prevent double booking
ALTER TABLE time_slots ADD CONSTRAINT time_slots_unique_slot
  UNIQUE (barber_id, date, start_time);

-- Services JSONB must be an array
ALTER TABLE appointments ADD CONSTRAINT appointments_services_is_array
  CHECK (jsonb_typeof(services) = 'array');

-- Explicit ON DELETE behavior for appointments
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_client_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_barber_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_barber_id_fkey
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE RESTRICT;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_slot_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_slot_id_fkey
  FOREIGN KEY (slot_id) REFERENCES time_slots(id) ON DELETE SET NULL;
