import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Barber } from '../types'

export function useBarbers() {
  return useQuery({
    queryKey: ['barbers'],
    queryFn: async (): Promise<Barber[]> => {
      const { data, error } = await supabase
        .from('barbers')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}
