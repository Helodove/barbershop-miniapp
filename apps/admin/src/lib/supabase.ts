import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UserRole = 'admin' | 'barber'

export function getUserRole(user: { user_metadata?: Record<string, unknown> } | null): UserRole | null {
  return (user?.user_metadata?.role as UserRole) ?? null
}
