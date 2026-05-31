-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Barbers
CREATE TABLE barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  photo_url TEXT,
  bio TEXT,
  telegram_id BIGINT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  bonus_points INTEGER DEFAULT 0,
  total_visits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Barber schedules
CREATE TABLE barber_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID REFERENCES barbers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_day_off BOOLEAN DEFAULT false,
  UNIQUE(barber_id, date)
);

-- Time slots
CREATE TABLE time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID REFERENCES barbers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_booked BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false
);

-- Appointments
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  barber_id UUID REFERENCES barbers(id),
  slot_id UUID REFERENCES time_slots(id),
  services JSONB NOT NULL,
  total_price INTEGER NOT NULL,
  total_duration INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  bonus_earned INTEGER DEFAULT 100,
  bonus_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bonus history
CREATE TABLE bonus_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  appointment_id UUID REFERENCES appointments(id),
  points_change INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_appointments_client_id ON appointments(client_id);
CREATE INDEX idx_appointments_barber_id ON appointments(barber_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_time_slots_barber_date ON time_slots(barber_id, date);
CREATE INDEX idx_time_slots_is_booked ON time_slots(is_booked);
CREATE INDEX idx_barber_schedules_barber_date ON barber_schedules(barber_id, date);
CREATE INDEX idx_bonus_history_client_id ON bonus_history(client_id);
