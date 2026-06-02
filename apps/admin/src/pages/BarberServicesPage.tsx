import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatPrice } from '../lib/format'
import type { Service } from '../types'

interface BarberService {
  id: string
  barber_id: string
  service_id: string
  custom_price: number | null
  is_active: boolean
}

function useAllServices() {
  return useQuery({
    queryKey: ['all-services-catalog'],
    queryFn: async (): Promise<Service[]> => {
      const { data } = await supabase.from('services').select('*').eq('is_active', true).order('sort_order')
      return data ?? []
    },
  })
}

function useBarberServices(barberId: string) {
  return useQuery({
    queryKey: ['barber-services', barberId],
    queryFn: async (): Promise<BarberService[]> => {
      if (!barberId) return []
      const { data } = await supabase
        .from('barber_services')
        .select('*')
        .eq('barber_id', barberId)
      return data ?? []
    },
    enabled: !!barberId,
  })
}

function useBarbers() {
  return useQuery({
    queryKey: ['barbers-for-services'],
    queryFn: async () => {
      const { data } = await supabase.from('barbers').select('id, name').eq('is_active', true).order('name')
      return data ?? []
    },
  })
}

export function BarberServicesPage() {
  const queryClient = useQueryClient()
  const { role, user } = useAuth()
  const myBarberId = user?.user_metadata?.barber_id as string | undefined
  const { data: barbers = [] } = useBarbers()
  const [selectedBarberId, setSelectedBarberId] = useState(myBarberId ?? '')
  const barberId = role === 'barber' ? (myBarberId ?? '') : (selectedBarberId || barbers[0]?.id || '')

  const { data: allServices = [] } = useAllServices()
  const { data: barberServices = [], isLoading } = useBarberServices(barberId)
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({})

  const grouped = allServices.reduce((acc: Record<string, Service[]>, s) => {
    const cat = s.category ?? 'Прочее'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  const getBarberService = (serviceId: string) =>
    barberServices.find(bs => bs.service_id === serviceId)

  const toggleService = useMutation({
    mutationFn: async ({ serviceId, active }: { serviceId: string; active: boolean }) => {
      const existing = getBarberService(serviceId)
      if (existing) {
        await supabase.from('barber_services').update({ is_active: active }).eq('id', existing.id)
      } else {
        await supabase.from('barber_services').insert({ barber_id: barberId, service_id: serviceId, is_active: active })
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['barber-services', barberId] }),
  })

  const savePrice = useMutation({
    mutationFn: async ({ serviceId, price }: { serviceId: string; price: number | null }) => {
      const existing = getBarberService(serviceId)
      if (existing) {
        await supabase.from('barber_services').update({ custom_price: price, is_active: true }).eq('id', existing.id)
      } else {
        await supabase.from('barber_services').insert({ barber_id: barberId, service_id: serviceId, custom_price: price, is_active: true })
      }
    },
    onSuccess: (_, { serviceId }) => {
      queryClient.invalidateQueries({ queryKey: ['barber-services', barberId] })
      setEditingPrice(prev => { const n = { ...prev }; delete n[serviceId]; return n })
    },
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мои услуги</h1>
          <p className="text-gray-500 text-sm mt-0.5">Выберите услуги и установите свои цены</p>
        </div>
        {role === 'admin' && barbers.length > 1 && (
          <select
            value={barberId}
            onChange={e => setSelectedBarberId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
          >
            {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, services]) => (
            <div key={category}>
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">{category}</h2>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {services.map((service, i) => {
                  const bs = getBarberService(service.id)
                  const isEnabled = bs ? bs.is_active : false
                  const currentPrice = bs?.custom_price ?? service.price
                  const isPriceEditing = editingPrice[service.id] !== undefined

                  return (
                    <div key={service.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''} ${!isEnabled ? 'opacity-50' : ''}`}>
                      {/* Toggle */}
                      <div
                        onClick={() => toggleService.mutate({ serviceId: service.id, active: !isEnabled })}
                        className={`w-10 h-6 rounded-full cursor-pointer transition-colors flex-shrink-0 ${isEnabled ? 'bg-black' : 'bg-gray-200'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform m-0.5 ${isEnabled ? 'translate-x-4' : ''}`} />
                      </div>

                      {/* Service info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{service.name}</p>
                        {service.description && (
                          <p className="text-xs text-gray-400 truncate">{service.description}</p>
                        )}
                      </div>

                      {/* Price */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isPriceEditing ? (
                          <>
                            <input
                              type="number"
                              value={editingPrice[service.id]}
                              onChange={e => setEditingPrice(prev => ({ ...prev, [service.id]: e.target.value }))}
                              className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-sm text-right"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') savePrice.mutate({ serviceId: service.id, price: parseInt(editingPrice[service.id], 10) || null })
                                if (e.key === 'Escape') setEditingPrice(prev => { const n = { ...prev }; delete n[service.id]; return n })
                              }}
                            />
                            <button
                              onClick={() => savePrice.mutate({ serviceId: service.id, price: parseInt(editingPrice[service.id], 10) || null })}
                              className="px-2 py-1 bg-black text-white rounded-lg text-xs"
                            >✓</button>
                            <button
                              onClick={() => setEditingPrice(prev => { const n = { ...prev }; delete n[service.id]; return n })}
                              className="text-gray-400 text-xs"
                            >✕</button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditingPrice(prev => ({ ...prev, [service.id]: String(currentPrice) }))}
                            className={`text-sm font-semibold px-2 py-1 rounded-lg hover:bg-gray-50 ${bs?.custom_price ? 'text-black' : 'text-gray-400'}`}
                          >
                            {formatPrice(currentPrice)}
                            {bs?.custom_price && (
                              <span className="ml-1 text-xs text-gray-400 line-through">{formatPrice(service.price)}</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {allServices.length === 0 && (
            <div className="text-center text-gray-400 py-16 text-sm">Сначала добавьте услуги в разделе «Услуги»</div>
          )}
        </div>
      )}
    </div>
  )
}
