import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatPrice, formatDate, formatTime } from '../lib/format'
import type { Appointment, AppointmentStatus } from '../types'

const STATUSES: AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'cancelled']

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Ожидает',
  confirmed: 'Подтверждено',
  completed: 'Завершено',
  cancelled: 'Отменено',
}

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-gray-50 text-gray-600 border-gray-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
}

const KANBAN_COLORS: Record<AppointmentStatus, string> = {
  pending: 'border-yellow-300 bg-yellow-50',
  confirmed: 'border-green-300 bg-green-50',
  completed: 'border-gray-300 bg-gray-50',
  cancelled: 'border-red-300 bg-red-50',
}

function useAppointments(filterBarber: string, filterStatus: string, filterDate: string) {
  return useQuery({
    queryKey: ['admin-appointments', filterBarber, filterStatus, filterDate],
    queryFn: async (): Promise<Appointment[]> => {
      let query = supabase
        .from('appointments')
        .select('*, barber:barbers(id, name), client:clients(id, first_name, last_name, username, telegram_id), slot:time_slots(id, date, start_time, end_time)')
        .order('created_at', { ascending: false })

      if (filterBarber) query = query.eq('barber_id', filterBarber)
      if (filterStatus) query = query.eq('status', filterStatus)
      if (filterDate && filterDate !== '') {
        const { data: slots } = await supabase.from('time_slots').select('id').eq('date', filterDate)
        if (slots && slots.length > 0) {
          query = query.in('slot_id', slots.map(s => s.id))
        } else {
          return []
        }
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Appointment[]
    },
    staleTime: 30 * 1000,
  })
}

function useBarbersList() {
  return useQuery({
    queryKey: ['barbers-list'],
    queryFn: async () => {
      const { data } = await supabase.from('barbers').select('id, name').eq('is_active', true)
      return data ?? []
    },
  })
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-lg border ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function AppointmentDetailModal({
  appointment,
  onClose,
  onStatusChange,
}: {
  appointment: Appointment
  onClose: () => void
  onStatusChange: (id: string, status: AppointmentStatus) => void
}) {
  const clientName = [appointment.client?.first_name, appointment.client?.last_name].filter(Boolean).join(' ')
    || appointment.client?.username || `ID ${appointment.client?.telegram_id}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Детали записи</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Статус</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    onClick={() => onStatusChange(appointment.id, s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      appointment.status === s
                        ? STATUS_COLORS[s] + ' ring-2 ring-offset-1 ring-gray-300'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Клиент</p>
                <p className="text-sm font-medium text-gray-900">{clientName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Мастер</p>
                <p className="text-sm font-medium text-gray-900">{appointment.barber?.name}</p>
              </div>
            </div>

            {appointment.slot && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Дата и время</p>
                <p className="text-sm text-gray-700">
                  {formatDate(appointment.slot.date)}, {formatTime(appointment.slot.start_time)}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Услуги</p>
              <div className="space-y-1">
                {(appointment.services ?? []).map((s, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{s.name}</span>
                    <span className="text-gray-500">{formatPrice(s.price)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100">
              {appointment.bonus_used > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Бонусы</span>
                  <span className="text-amber-600">-{formatPrice(appointment.bonus_used)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span className="text-gray-700">Итого</span>
                <span className="text-gray-900">{formatPrice(appointment.total_price)}</span>
              </div>
            </div>

            {appointment.notes && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Заметки</p>
                <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">{appointment.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppointmentsPage() {
  const queryClient = useQueryClient()
  const { role, user } = useAuth()
  const myBarberId = user?.user_metadata?.barber_id as string | undefined
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [filterBarber, setFilterBarber] = useState(myBarberId ?? '')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)

  const { data: appointments = [], isLoading } = useAppointments(filterBarber, filterStatus, filterDate)
  const { data: barbers = [] } = useBarbersList()

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-appointments'] })
    },
  })

  const handleStatusChange = (id: string, status: AppointmentStatus) => {
    changeStatus.mutate({ id, status })
    if (selectedAppt?.id === id) {
      setSelectedAppt(prev => prev ? { ...prev, status } : null)
    }
  }

  const kanbanGroups = useMemo(() => {
    const groups: Record<AppointmentStatus, Appointment[]> = {
      pending: [], confirmed: [], completed: [], cancelled: [],
    }
    for (const appt of appointments) {
      groups[appt.status]?.push(appt)
    }
    return groups
  }, [appointments])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Записи</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setView('table')}
            className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              view === 'table' ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            Таблица
          </button>
          <button
            onClick={() => setView('kanban')}
            className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              view === 'kanban' ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            Канбан
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        />
        {role === 'admin' && (
          <select
            value={filterBarber}
            onChange={e => setFilterBarber(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          >
            <option value="">Все мастера</option>
            {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
        >
          <option value="">Все статусы</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {(filterStatus || filterDate || (role === 'admin' && filterBarber)) && (
          <button
            onClick={() => { if (role === 'admin') setFilterBarber(''); setFilterStatus(''); setFilterDate('') }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl"
          >
            Сбросить
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : view === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {appointments.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">Записей не найдено</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Клиент</th>
                    {role === 'admin' && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Мастер</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Дата</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Сумма</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(appt => {
                    const clientName = [appt.client?.first_name, appt.client?.last_name].filter(Boolean).join(' ')
                      || appt.client?.username || `TG ${appt.client?.telegram_id}`
                    return (
                      <tr
                        key={appt.id}
                        onClick={() => setSelectedAppt(appt)}
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">{clientName}</td>
                        {role === 'admin' && (
                          <td className="px-4 py-3 text-sm text-gray-600">{appt.barber?.name}</td>
                        )}
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {appt.slot ? `${formatDate(appt.slot.date)}, ${formatTime(appt.slot.start_time)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatPrice(appt.total_price)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={appt.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* KANBAN VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUSES.map(status => (
            <div key={status} className={`rounded-2xl border-2 p-3 ${KANBAN_COLORS[status]}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">{STATUS_LABELS[status]}</h3>
                <span className="text-xs bg-white/60 text-gray-500 px-2 py-0.5 rounded-full">
                  {kanbanGroups[status].length}
                </span>
              </div>
              <div className="space-y-2">
                {kanbanGroups[status].map(appt => {
                  const clientName = [appt.client?.first_name, appt.client?.last_name].filter(Boolean).join(' ')
                    || appt.client?.username || `TG ${appt.client?.telegram_id}`
                  return (
                    <div
                      key={appt.id}
                      onClick={() => setSelectedAppt(appt)}
                      className="bg-white rounded-xl p-3 cursor-pointer hover:shadow-sm transition-shadow border border-white/80"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{clientName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{appt.barber?.name}</p>
                      {appt.slot && (
                        <p className="text-xs text-gray-400 mt-0.5">{formatTime(appt.slot.start_time)}</p>
                      )}
                      <p className="text-xs font-semibold text-gray-700 mt-1">{formatPrice(appt.total_price)}</p>
                    </div>
                  )
                })}
                {kanbanGroups[status].length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Пусто</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedAppt && (
        <AppointmentDetailModal
          appointment={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
