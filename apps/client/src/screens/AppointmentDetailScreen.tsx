import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useClient } from '../hooks/useClient'
import { tg, hapticImpact, hapticNotification } from '../lib/telegram'
import { formatPrice, formatDate, formatTime, formatDuration } from '../lib/format'
import type { Appointment } from '../types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждено',
  completed: 'Завершено',
  cancelled: 'Отменено',
}

const STATUS_COLORS: Record<string, Record<string, string>> = {
  pending: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#EAB308' },
  confirmed: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#22C55E' },
  completed: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.5)' },
  cancelled: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#EF4444' },
}

function useAppointmentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['appointment', id],
    queryFn: async (): Promise<Appointment | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          barber:barbers(id, name, photo_url, bio),
          slot:time_slots(id, date, start_time, end_time)
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Appointment
    },
    enabled: !!id,
  })
}

export default function AppointmentDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: client } = useClient()
  const { data: appointment, isLoading } = useAppointmentDetail(id)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('No appointment ID')
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id)

      if (error) throw error

      // Only free the slot if appointment cancel succeeded
      if (appointment?.slot_id) {
        await supabase
          .from('time_slots')
          .update({ is_booked: false })
          .eq('id', appointment.slot_id)
      }
    },
    onSuccess: () => {
      hapticNotification('success')
      queryClient.invalidateQueries({ queryKey: ['appointment', id] })
      queryClient.invalidateQueries({ queryKey: ['appointments', client?.id] })
      setShowCancelConfirm(false)
    },
    onError: () => {
      hapticNotification('error')
    },
  })

  useEffect(() => {
    tg.BackButton.show()
    const handler = () => navigate(-1)
    tg.BackButton.onClick(handler)
    tg.MainButton.hide()
    return () => tg.BackButton.offClick(handler)
  }, [navigate])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg px-6 text-center">
        <p className="text-white/40 font-body mb-4">Запись не найдена</p>
        <button onClick={() => navigate(-1)} className="text-gold text-sm">Назад</button>
      </div>
    )
  }

  // Can cancel if pending or confirmed and at least 2 hours before appointment
  const canCancel = (() => {
    if (!['pending', 'confirmed'].includes(appointment.status)) return false
    if (!appointment.slot) return true // allow cancel if no slot info
    const apptDateTime = new Date(`${appointment.slot.date}T${appointment.slot.start_time}`)
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
    return apptDateTime > twoHoursFromNow
  })()

  const statusStyle = STATUS_COLORS[appointment.status] ?? STATUS_COLORS.pending
  const totalDuration = (appointment.services ?? []).reduce((s, x) => s + x.duration_minutes, 0)

  return (
    <div className="min-h-screen bg-bg">
      <div className="px-4 pt-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Status Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
            style={{ background: statusStyle.bg, border: `1px solid ${statusStyle.border}`, color: statusStyle.text }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: statusStyle.text }} />
            {STATUS_LABELS[appointment.status]}
          </div>

          {/* Barber */}
          <div className="p-4 rounded-2xl bg-surface border border-white/5">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Мастер</p>
            <div className="flex items-center gap-3">
              {appointment.barber?.photo_url ? (
                <img
                  src={appointment.barber.photo_url}
                  alt={appointment.barber.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-xl">
                  ✂️
                </div>
              )}
              <div>
                <p className="text-white font-medium">{appointment.barber?.name}</p>
                {appointment.barber?.bio && (
                  <p className="text-white/40 text-xs mt-0.5 line-clamp-1">{appointment.barber.bio}</p>
                )}
              </div>
            </div>
          </div>

          {/* Date & Time */}
          {appointment.slot && (
            <div className="p-4 rounded-2xl bg-surface border border-white/5">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Дата и время</p>
              <p className="text-white font-medium">
                {formatDate(appointment.slot.date)}, {formatTime(appointment.slot.start_time)}
              </p>
              {totalDuration > 0 && (
                <p className="text-white/40 text-sm mt-1">Продолжительность: {formatDuration(totalDuration)}</p>
              )}
            </div>
          )}

          {/* Services */}
          <div className="p-4 rounded-2xl bg-surface border border-white/5">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Услуги</p>
            <div className="space-y-2">
              {(appointment.services ?? []).map((service, i) => (
                <div key={i} className="flex justify-between items-center">
                  <p className="text-white text-sm">{service.name}</p>
                  <p className="text-white/60 text-sm">{formatPrice(service.price)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="p-4 rounded-2xl bg-surface border border-white/5">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Итого</p>
            {appointment.bonus_used > 0 && (
              <div className="flex justify-between mb-2">
                <p className="text-white/50 text-sm">Использовано бонусов</p>
                <p className="text-gold text-sm">-{formatPrice(appointment.bonus_used)}</p>
              </div>
            )}
            <div className="flex justify-between">
              <p className="text-white font-semibold">Сумма</p>
              <p className="text-gold font-display font-bold text-lg">{formatPrice(appointment.total_price)}</p>
            </div>
            {appointment.status === 'completed' && appointment.bonus_earned > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-white/40 text-xs">
                  ✦ Начислено {appointment.bonus_earned} бонусов за этот визит
                </p>
              </div>
            )}
          </div>

          {/* Cancel Button */}
          {canCancel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {!showCancelConfirm ? (
                <button
                  onClick={() => {
                    hapticImpact('medium')
                    setShowCancelConfirm(true)
                  }}
                  className="w-full py-4 rounded-2xl text-red-400 border border-red-400/20 font-body font-medium min-h-[48px]"
                  style={{ background: 'rgba(239,68,68,0.05)' }}
                >
                  Отменить запись
                </button>
              ) : (
                <div className="p-4 rounded-2xl border border-red-400/30" style={{ background: 'rgba(239,68,68,0.08)' }}>
                  <p className="text-white font-medium mb-1">Отменить запись?</p>
                  <p className="text-white/50 text-sm mb-4">Это действие нельзя отменить</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        hapticImpact('medium')
                        cancelMutation.mutate()
                      }}
                      disabled={cancelMutation.isPending}
                      className="flex-1 py-3 rounded-xl text-red-400 border border-red-400/40 font-medium min-h-[48px]"
                    >
                      {cancelMutation.isPending ? 'Отмена...' : 'Да, отменить'}
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 py-3 rounded-xl text-white/60 border border-white/10 font-medium min-h-[48px]"
                    >
                      Назад
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
