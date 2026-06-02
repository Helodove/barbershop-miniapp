import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/format'
import type { Client, BonusHistory } from '../types'

// ─── HOOKS ───────────────────────────────────────────────────────────────────

function useBonusSetting() {
  return useQuery({
    queryKey: ['setting', 'bonus_per_visit'],
    queryFn: async (): Promise<number> => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'bonus_per_visit')
        .single()
      return parseInt(data?.value ?? '100', 10)
    },
  })
}

function useClients(search: string) {
  return useQuery({
    queryKey: ['bonus-clients', search],
    queryFn: async (): Promise<Client[]> => {
      let query = supabase
        .from('clients')
        .select('*')
        .order('bonus_points', { ascending: false })

      if (search.trim()) {
        const s = search.trim()
        query = query.or(
          `first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%,username.ilike.%${s}%`
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
  })
}

function useClientBonusHistory(clientId: string | null) {
  return useQuery({
    queryKey: ['bonus-history', clientId],
    queryFn: async (): Promise<BonusHistory[]> => {
      if (!clientId) return []
      const { data } = await supabase
        .from('bonus_history')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50)
      return data ?? []
    },
    enabled: !!clientId,
  })
}

// ─── SETTINGS CARD ───────────────────────────────────────────────────────────

function BonusSettingCard() {
  const queryClient = useQueryClient()
  const { data: currentBonus, isLoading } = useBonusSetting()
  const [editValue, setEditValue] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)

  const saveSetting = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: String(value) })
        .eq('key', 'bonus_per_visit')
      if (error) throw new Error('Нет прав для изменения настроек. Используйте Supabase Dashboard.')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setting', 'bonus_per_visit'] })
      setIsEditing(false)
    },
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Начисление бонусов</h2>
          <p className="text-gray-500 text-sm mt-0.5">Количество бонусов за каждую завершённую запись</p>
        </div>
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}
        >
          ✦
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        {isEditing ? (
          <>
            <input
              type="number"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              min="0"
              max="10000"
              className="w-32 px-3 py-2 border border-gray-300 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-black/10"
              autoFocus
            />
            <span className="text-gray-500 text-sm">баллов за визит</span>
            <button
              onClick={() => saveSetting.mutate(parseInt(editValue, 10))}
              disabled={saveSetting.isPending || !editValue || parseInt(editValue) < 0}
              className="px-4 py-2 bg-black text-white rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {saveSetting.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm"
            >
              Отмена
            </button>
          </>
        ) : (
          <>
            {isLoading ? (
              <div className="h-9 w-24 bg-gray-100 rounded-xl animate-pulse" />
            ) : (
              <span className="text-4xl font-bold" style={{ color: '#C9A84C' }}>{currentBonus}</span>
            )}
            <span className="text-gray-500 text-sm">баллов за визит</span>
            <button
              onClick={() => { setEditValue(String(currentBonus ?? 100)); setIsEditing(true) }}
              className="ml-2 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50"
            >
              Изменить
            </button>
          </>
        )}
      </div>
      {saveSetting.isError && (
        <p className="text-red-500 text-sm mt-2 bg-red-50 p-2 rounded-lg">
          {(saveSetting.error as Error).message}
        </p>
      )}
      <p className="text-gray-400 text-xs mt-3">
        1 балл = 1 ₽ при списании. Максимум 20% от суммы заказа.
      </p>
    </div>
  )
}

// ─── CLIENT BONUS MODAL ───────────────────────────────────────────────────────

function ClientBonusModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data: globalBonus } = useBonusSetting()
  const { data: history = [], isLoading } = useClientBonusHistory(client.id)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [customBonus, setCustomBonus] = useState<string>(
    client.bonus_per_visit != null ? String(client.bonus_per_visit) : ''
  )
  const [savingBonus, setSavingBonus] = useState(false)

  const name = [client.first_name, client.last_name].filter(Boolean).join(' ')
    || client.username
    || `TG ${client.telegram_id}`

  const adjustBonus = useMutation({
    mutationFn: async () => {
      const points = parseInt(amount, 10)
      if (isNaN(points) || points === 0) throw new Error('Введите сумму')

      const { data: current } = await supabase
        .from('clients')
        .select('bonus_points')
        .eq('id', client.id)
        .single()

      const newBalance = Math.max(0, (current?.bonus_points ?? 0) + points)

      await supabase.from('clients').update({ bonus_points: newBalance }).eq('id', client.id)
      await supabase.from('bonus_history').insert({
        client_id: client.id,
        points_change: points,
        reason: reason || (points > 0 ? 'Ручное начисление' : 'Ручное списание'),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus-clients'] })
      queryClient.invalidateQueries({ queryKey: ['bonus-history', client.id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setAmount('')
      setReason('')
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{name}</h2>
              <p className="text-sm text-gray-400">
                {client.phone && <span className="mr-2">📞 {client.phone}</span>}
                {client.username && <span>@{client.username}</span>}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          {/* Balance stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}>
              <p className="text-2xl font-bold" style={{ color: '#C9A84C' }}>{client.bonus_points}</p>
              <p className="text-xs text-gray-400 mt-0.5">Баллов</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{client.total_visits}</p>
              <p className="text-xs text-gray-400 mt-0.5">Визитов</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-sm font-bold text-gray-900">{formatDate(client.created_at).slice(0, 6)}</p>
              <p className="text-xs text-gray-400 mt-0.5">С нами с</p>
            </div>
          </div>

          {/* Custom bonus per visit */}
          <div className="border border-gray-100 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-800">Баллов за визит</p>
              {client.bonus_per_visit != null && (
                <button
                  onClick={async () => {
                    await supabase.from('clients').update({ bonus_per_visit: null }).eq('id', client.id)
                    queryClient.invalidateQueries({ queryKey: ['bonus-clients'] })
                    setCustomBonus('')
                  }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Сбросить к глобальному
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={customBonus}
                onChange={e => setCustomBonus(e.target.value)}
                placeholder={`По умолчанию: ${globalBonus ?? 100}`}
                min="1"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              <span className="text-gray-400 text-sm flex-shrink-0">баллов</span>
              <button
                disabled={savingBonus || !customBonus}
                onClick={async () => {
                  const val = parseInt(customBonus, 10)
                  if (isNaN(val) || val < 1) return
                  setSavingBonus(true)
                  await supabase.from('clients').update({ bonus_per_visit: val }).eq('id', client.id)
                  queryClient.invalidateQueries({ queryKey: ['bonus-clients'] })
                  setSavingBonus(false)
                }}
                className="px-3 py-2 bg-black text-white rounded-xl text-sm disabled:opacity-50 flex-shrink-0"
              >
                {savingBonus ? '...' : 'OK'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {client.bonus_per_visit != null
                ? `Индивидуально: ${client.bonus_per_visit} баллов за визит`
                : `Используется глобальный: ${globalBonus ?? 100} баллов`}
            </p>
          </div>

          {/* Manual adjustment */}
          <div className="border border-gray-100 rounded-xl p-4 mb-5">
            <p className="text-sm font-semibold text-gray-800 mb-3">Изменить баллы вручную</p>
            <div className="flex gap-2 mb-2">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="+500 или -200"
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              <button
                onClick={() => adjustBonus.mutate()}
                disabled={adjustBonus.isPending || !amount}
                className="px-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {adjustBonus.isPending ? '...' : 'Применить'}
              </button>
            </div>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Причина (необязательно)"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none"
            />
            {adjustBonus.isError && (
              <p className="text-red-500 text-xs mt-2">{(adjustBonus.error as Error).message}</p>
            )}
          </div>

          {/* Bonus history */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-3">
              История начислений ({history.length})
            </p>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">История пуста</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map(h => (
                  <div key={h.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{h.reason || '—'}</p>
                      <p className="text-xs text-gray-400">{formatDate(h.created_at)}</p>
                    </div>
                    <span
                      className={`text-sm font-semibold ml-3 flex-shrink-0 ${h.points_change > 0 ? 'text-green-600' : 'text-red-500'}`}
                    >
                      {h.points_change > 0 ? '+' : ''}{h.points_change}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export function BonusPage() {
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const { data: clients = [], isLoading } = useClients(search)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Бонусная программа</h1>

      <BonusSettingCard />

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени, фамилии или телефону"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-gray-400 hover:text-gray-600 text-sm px-3 py-2 border border-gray-200 rounded-xl"
          >
            Сбросить
          </button>
        )}
      </div>

      {/* Clients table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {clients.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              {search ? 'Клиенты не найдены' : 'Нет клиентов'}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Клиент</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Телефон</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Визитов</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Баллов</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => {
                  const name = [client.first_name, client.last_name].filter(Boolean).join(' ')
                    || client.username
                    || `TG ${client.telegram_id}`
                  return (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{name}</p>
                        {client.username && (
                          <p className="text-xs text-gray-400">@{client.username}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {client.phone || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{client.total_visits}</td>
                      <td className="px-4 py-3">
                        <span
                          className="text-sm font-bold px-2 py-1 rounded-lg"
                          style={{ color: '#C9A84C', background: 'rgba(201,168,76,0.1)' }}
                        >
                          {client.bonus_points}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectedClient && (
        <ClientBonusModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  )
}
