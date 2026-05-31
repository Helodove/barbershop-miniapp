import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Appointment } from '../types'

export function useAppointments(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ['appointments', clientId],
    queryFn: async (): Promise<Appointment[]> => {
      if (!clientId) return []
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          barber:barbers(id, name, photo_url),
          slot:time_slots(id, date, start_time, end_time)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Appointment[]
    },
    enabled: !!clientId,
  })
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      client_id: string
      barber_id: string
      slot_id: string
      services: object[]
      total_price: number
      total_duration: number
      bonus_used: number
      notes?: string
    }): Promise<Appointment> => {
      const { data, error } = await supabase
        .from('appointments')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as Appointment
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appointments', data.client_id] })
      queryClient.invalidateQueries({ queryKey: ['slots'] })
    },
  })
}
