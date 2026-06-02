import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Service } from '../types'

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async (): Promise<Service[]> => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function groupServicesByCategory(services: Service[]): Record<string, Service[]> {
  const grouped: Record<string, Service[]> = {}
  for (const service of services) {
    const cat = service.category ?? 'Прочее'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(service)
  }
  return grouped
}

export interface BarberService {
  id: string
  service_id: string
  custom_price: number | null
  is_active: boolean
}

export function useBarberServices(barberId: string | null) {
  return useQuery({
    queryKey: ['barber-services-client', barberId],
    queryFn: async (): Promise<BarberService[]> => {
      if (!barberId) return []
      const { data } = await supabase
        .from('barber_services')
        .select('id, service_id, custom_price, is_active')
        .eq('barber_id', barberId)
        .eq('is_active', true)
      return data ?? []
    },
    enabled: !!barberId,
    staleTime: 2 * 60 * 1000,
  })
}
