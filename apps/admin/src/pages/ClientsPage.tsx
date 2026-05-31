import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { formatPrice, formatDate } from '../lib/format'
import type { Client, Appointment, BonusHistory } from '../types'

function useClients(search: string) {
  return useQuery({
    queryKey: ['clients', search],
    queryFn: async (): Promise<Client[]> => {
      let query = supabase.from('clients').select('*').order('created_at', { ascending: false })
      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,username.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
  })
}

function useClientDetail(clientId: string | null) {
  return useQuery({
    queryKey: ['client-detail', clientId],
    queryFn: async () => {
      if (!clientId) return null
      const [appts, history] = await Promise.all([
        supabase.from('appointments').select('*, barber:barbers(name), slot:time_slots(date, start_time)').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('bonus_history').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
      ])
      return {
        appointments: (appts.data ?? []) as Appointment[],
        bonusHistory: (history.data ?? []) as BonusHistory[],
      }
    },
    enabled: !!clientId,
  })
}

function ClientModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: detail, isLoading } = useClientDetail(client.id)
  const [bonusAmount, setBonusAmount] = useState('')
  const [bonusReason, setBonusReason] = useState('')

  const adjustBonus = useMutation({
    mutationFn: async () => {
      const points = parseInt(bonusAmount, 10)
      if (isNaN(points) || points === 0) throw new Error('Введите сумму')

      const { data: current } = await supabase.from('clients').select('bonus_points').eq('id', client.id).single()
      const newBalance = Math.max(0, (current?.bonus_points ?? 0) + points)

      await supabase.from('clients').update({ bonus_points: newBalance }).eq('id', client.id)
      await supabase.from('bonus_history').insert({
        client_id: client.id,
        points_change: points,
        reason: bonusReason || (points > 0 ? 'Ручное начисление' : 'Ручное списание'),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client-detail', client.id] })
      setBonusAmount('')
      setBonusReason('')
    },
  })

  const exportCSV = () => {
    const rows = [
      ['Клиент', 'Telegram ID', 'Username', 'Визитов', 'Бонусов', 'Дата регистрации'],
      [
        [client.first_name, client.last_name].filter(Boolean).join(' '),
        String(client.telegram_id),
        client.username ?? '',
        String(client.total_visits),
        String(client.bonus_points),
        formatDate(client.created_at),
      ],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `client-${client.id}.csv`
    a.click()
  }

  const name = [client.first_name, client.last_name].filter(Boolean).join(' ') || client.username || `TG ${client.telegram_id}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{name}</h2>
              <p className="text-sm text-gray-400">@{client.username} · TG {client.telegram_id}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{client.total_visits}</p>
              <p className="text-xs text-gray-400 mt-0.5">Визитов</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-amber-700">{client.bonus_points}</p>
              <p className="text-xs text-gray-400 mt-0.5">Бонусов</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-sm font-bold text-gray-900">{formatDate(client.created_at).slice(0, 8)}</p>
              <p className="text-xs text-gray-400 mt-0.5">С нами с</p>
            </div>
          </div>

          {/* Bonus adjustment */}
          <div className="border border-gray-100 rounded-xl p-4 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Изменить бонусы</p>
            <div className="flex gap-2 mb-2">
              <input
                type="number"
                value={bonusAmount}
                onChange={e => setBonusAmount(e.target.value)}
                placeholder="Например: 500 или -200"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
              />
              <button
                onClick={() => adjustBonus.mutate()}
                disabled={adjustBonus.isPending || !bonusAmount}
                className="px-4 py-2 bg-black text-white rounded-xl text-sm disabled:opacity-50"
              >
                {adjustBonus.isPending ? '...' : 'Применить'}
              </button>
            </div>
            <input
              type="text"
              value={bonusReason}
              onChange={e => setBonusReason(e.target.value)}
              placeholder="Причина (необязательно)"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            />
            {adjustBonus.isError && (
              <p className="text-red-500 text-xs mt-1">{(adjustBonus.error as Error).message}</p>
            )}
          </div>

          {/* History */}
          {isLoading ? (
            <div className="py-6 flex justify-center">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700 mb-2">История визитов ({detail?.appointments.length})</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(detail?.appointments ?? []).map(appt => (
                  <div key={appt.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                    <div>
                      <p className="text-gray-700">{appt.barber?.name}</p>
                      {appt.slot && <p className="text-gray-400 text-xs">{formatDate(appt.slot.date)}</p>}
                    </div>
                    <p className="font-medium text-gray-800">{formatPrice(appt.total_price)}</p>
                  </div>
                ))}
                {(detail?.appointments ?? []).length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-3">Записей нет</p>
                )}
              </div>
            </>
          )}

          <div className="mt-4 flex justify-end">
            <button onClick={exportCSV} className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-xl">
              Экспорт CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ClientsPage() {
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const { data: clients = [], isLoading } = useClients(search)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Клиенты</h1>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по имени или @username"
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm w-64 focus:outline-none focus:ring-2 focus:ring-black/10"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {clients.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">Клиенты не найдены</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Клиент</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Telegram</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Визитов</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Бонусов</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Регистрация</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => {
                  const name = [client.first_name, client.last_name].filter(Boolean).join(' ') || '—'
                  return (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{name}</p>
                        {client.username && <p className="text-xs text-gray-400">@{client.username}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{client.telegram_id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{client.total_visits}</td>
                      <td className="px-4 py-3 text-sm font-medium text-amber-600">{client.bonus_points}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{formatDate(client.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectedClient && (
        <ClientModal client={selectedClient} onClose={() => setSelectedClient(null)} />
      )}
    </div>
  )
}
