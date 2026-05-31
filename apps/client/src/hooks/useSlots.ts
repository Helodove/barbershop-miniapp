import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { TimeSlot } from '../types'

export function useSlots(barberId: string | null, date: string | null) {
  return useQuery({
    queryKey: ['slots', barberId, date],
    queryFn: async (): Promise<TimeSlot[]> => {
      if (!barberId || !date) return []
      const { data, error } = await supabase
        .from('time_slots')
        .select('*')
        .eq('barber_id', barberId)
        .eq('date', date)
        .eq('is_blocked', false)
        .order('start_time')
      if (error) throw error
      return data ?? []
    },
    enabled: !!barberId && !!date,
  })
}
