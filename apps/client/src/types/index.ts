export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export interface Barber {
  id: string
  name: string
  photo_url: string | null
  bio: string | null
  telegram_id: number | null
  is_active: boolean
  created_at: string
}

export interface Service {
  id: string
  name: string
  description: string | null
  price: number
  duration_minutes: number
  category: string | null
  is_active: boolean
  sort_order: number
}

export interface Client {
  id: string
  telegram_id: number
  username: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  bonus_points: number
  total_visits: number
  created_at: string
}

export interface TimeSlot {
  id: string
  barber_id: string
  date: string
  start_time: string
  end_time: string
  is_booked: boolean
  is_blocked: boolean
}

export interface Appointment {
  id: string
  client_id: string
  barber_id: string
  slot_id: string | null
  services: Service[]
  total_price: number
  total_duration: number
  status: AppointmentStatus
  notes: string | null
  bonus_earned: number
  bonus_used: number
  created_at: string
  barber?: Barber
  slot?: TimeSlot
}

export interface BonusHistory {
  id: string
  client_id: string
  appointment_id: string | null
  points_change: number
  reason: string | null
  created_at: string
}

export interface BookingFormState {
  barber: Barber | null
  services: Service[]
  date: string | null
  slot: TimeSlot | null
  bonusUsed: number
  notes: string
}
