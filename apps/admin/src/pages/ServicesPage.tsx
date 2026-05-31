import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { formatPrice, formatDuration } from '../lib/format'
import type { Service } from '../types'

function useServices() {
  return useQuery({
    queryKey: ['admin-services'],
    queryFn: async (): Promise<Service[]> => {
      const { data } = await supabase.from('services').select('*').order('sort_order').order('name')
      return data ?? []
    },
  })
}

function ServiceForm({ service, onClose }: { service?: Service; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(service?.name ?? '')
  const [description, setDescription] = useState(service?.description ?? '')
  const [price, setPrice] = useState(String(service?.price ?? ''))
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? ''))
  const [category, setCategory] = useState(service?.category ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const payload = {
        name,
        description: description || null,
        price: parseInt(price, 10),
        duration_minutes: parseInt(duration, 10),
        category: category || null,
      }
      if (service?.id) {
        await supabase.from('services').update(payload).eq('id', service.id)
      } else {
        await supabase.from('services').insert(payload)
      }
      queryClient.invalidateQueries({ queryKey: ['admin-services'] })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{service ? 'Редактировать услугу' : 'Новая услуга'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Название *</label>
            <input value={name} onChange={e => setName(e.target.value)} required className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Описание</label>
            <input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Цена (₽) *</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} required min="0" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Время (мин) *</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)} required min="1" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Категория</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Например: Стрижки" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Отмена</button>
          <button type="submit" disabled={isSubmitting || !name || !price || !duration} className="flex-1 py-2.5 bg-black text-white rounded-xl text-sm disabled:opacity-50">
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function ServicesPage() {
  const queryClient = useQueryClient()
  const { data: services = [], isLoading } = useServices()
  const [editService, setEditService] = useState<Service | 'new' | null>(null)

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await supabase.from('services').update({ is_active }).eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-services'] }),
  })

  const moveOrder = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const idx = services.findIndex(s => s.id === id)
      if (idx === -1) return
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= services.length) return

      // Assign new sort_orders based on swapped positions
      const newOrder = [...services.map(s => s.id)]
      const temp = newOrder[idx]
      newOrder[idx] = newOrder[swapIdx]
      newOrder[swapIdx] = temp

      await Promise.all(
        newOrder.map((serviceId, position) =>
          supabase.from('services').update({ sort_order: position }).eq('id', serviceId)
        )
      )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-services'] }),
  })

  const grouped = services.reduce((acc: Record<string, Service[]>, s) => {
    const cat = s.category ?? 'Без категории'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Услуги</h1>
        <button onClick={() => setEditService('new')} className="px-4 py-2 bg-black text-white rounded-xl text-sm font-medium">
          + Добавить
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">{category}</h2>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {items.map((service, i) => (
                  <div key={service.id} className={`flex items-center gap-3 px-4 py-3 ${!service.is_active ? 'opacity-50' : ''} ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="flex flex-col gap-0.5 mr-1">
                      <button
                        onClick={() => moveOrder.mutate({ id: service.id, direction: 'up' })}
                        disabled={i === 0}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none"
                      >▲</button>
                      <button
                        onClick={() => moveOrder.mutate({ id: service.id, direction: 'down' })}
                        disabled={i === items.length - 1}
                        className="text-gray-300 hover:text-gray-500 disabled:opacity-20 text-xs leading-none"
                      >▼</button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{service.name}</p>
                      {service.description && <p className="text-xs text-gray-400 truncate">{service.description}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatPrice(service.price)}</p>
                      <p className="text-xs text-gray-400">{formatDuration(service.duration_minutes)}</p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => setEditService(service)} className="p-1.5 text-gray-400 hover:text-gray-600 border border-gray-100 rounded-lg text-xs">✏️</button>
                      <button
                        onClick={() => toggleActive.mutate({ id: service.id, is_active: !service.is_active })}
                        className={`p-1.5 border rounded-lg text-xs ${service.is_active ? 'text-red-400 border-red-100 hover:text-red-600' : 'text-green-500 border-green-100 hover:text-green-700'}`}
                      >
                        {service.is_active ? '🚫' : '✅'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editService !== null && (
        <ServiceForm
          service={editService === 'new' ? undefined : editService}
          onClose={() => setEditService(null)}
        />
      )}
    </div>
  )
}
