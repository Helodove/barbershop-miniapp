import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useClient } from '../hooks/useClient'
import { useAppointments } from '../hooks/useAppointments'
import { getTelegramUser, tg, hapticImpact } from '../lib/telegram'
import { formatPrice, formatDate, formatTime } from '../lib/format'
import { Skeleton, AppointmentCardSkeleton } from '../components/ui/Skeleton'
import type { Appointment } from '../types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  confirmed: 'Подтверждено',
  completed: 'Завершено',
  cancelled: 'Отменено',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  confirmed: 'text-green-400 bg-green-400/10',
  completed: 'text-white/50 bg-white/5',
  cancelled: 'text-red-400 bg-red-400/10',
}

function VisitCard({ appointment }: { appointment: Appointment }) {
  const navigate = useNavigate()

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        hapticImpact('light')
        navigate(`/appointments/${appointment.id}`)
      }}
      className="p-4 rounded-2xl bg-surface border border-white/5 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">
            {appointment.barber?.name ?? 'Барбер'}
          </p>
          <p className="text-white/50 text-sm mt-0.5">
            {appointment.slot
              ? `${formatDate(appointment.slot.date)}, ${formatTime(appointment.slot.start_time)}`
              : formatDate(appointment.created_at)}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {(appointment.services ?? []).slice(0, 2).map((s, i) => (
              <span key={i} className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-lg">
                {s.name}
              </span>
            ))}
            {(appointment.services ?? []).length > 2 && (
              <span className="text-xs text-white/30">
                +{(appointment.services ?? []).length - 2} ещё
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-1 rounded-lg font-medium ${STATUS_COLORS[appointment.status]}`}>
            {STATUS_LABELS[appointment.status]}
          </span>
          <p className="text-gold text-sm font-semibold">{formatPrice(appointment.total_price)}</p>
        </div>
      </div>
    </motion.div>
  )
}

export default function ProfileScreen() {
  const navigate = useNavigate()
  const tgUser = getTelegramUser()
  const { data: client, isLoading: clientLoading } = useClient()
  const { data: appointments = [], isLoading: apptLoading } = useAppointments(client?.id)

  const completedVisits = appointments.filter(a => a.status === 'completed')
  const totalSpent = completedVisits.reduce((sum, a) => sum + a.total_price, 0)
  const nextTarget = Math.ceil((client?.total_visits ?? 0) / 5) * 5
  const progressToNext = nextTarget > 0
    ? ((client?.total_visits ?? 0) % 5) / 5
    : 0

  useEffect(() => {
    tg.BackButton.hide()
    tg.MainButton.hide()
  }, [])

  const avatarUrl = tgUser?.photo_url

  return (
    <div className="min-h-screen bg-bg">
      <div className="px-4 pt-8 pb-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-6"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover border-2"
              style={{ borderColor: 'rgba(201,168,76,0.4)' }}
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: 'rgba(201,168,76,0.12)', border: '2px solid rgba(201,168,76,0.3)' }}
            >
              {tgUser?.first_name?.[0] ?? '?'}
            </div>
          )}
          <div>
            <h1 className="text-white text-xl font-display font-bold">
              {[tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' ') || 'Гость'}
            </h1>
            {tgUser?.username && (
              <p className="text-white/40 text-sm font-body">@{tgUser.username}</p>
            )}
          </div>
        </motion.div>

        {/* Bonus Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl p-5 mb-4"
          style={{
            background: 'linear-gradient(135deg, #2A2A1A 0%, #1A1A0A 60%, #0A0A0A 100%)',
            border: '1px solid rgba(201,168,76,0.25)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest">Бонусный баланс</p>
              {clientLoading ? (
                <Skeleton className="h-8 w-24 mt-1" />
              ) : (
                <p className="text-3xl font-display font-bold mt-1" style={{ color: '#C9A84C' }}>
                  {client?.bonus_points ?? 0}
                  <span className="text-sm ml-1 opacity-70">бонусов</span>
                </p>
              )}
            </div>
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)' }}
            >
              ✦
            </div>
          </div>

          {/* Progress bar to next reward */}
          <div>
            <div className="flex justify-between text-xs text-white/40 mb-1">
              <span>Визитов: {client?.total_visits ?? 0}</span>
              <span>До награды: {nextTarget - (client?.total_visits ?? 0) % 5} визитов</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #C9A84C, #E8C97A)' }}
                initial={{ width: 0 }}
                animate={{ width: `${progressToNext * 100}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
              />
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 gap-3 mb-6"
        >
          <div className="p-4 rounded-2xl bg-surface border border-white/5">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Визитов</p>
            {clientLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <p className="text-white text-2xl font-display font-bold">{client?.total_visits ?? 0}</p>
            )}
          </div>
          <div className="p-4 rounded-2xl bg-surface border border-white/5">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Потрачено</p>
            {clientLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-gold text-xl font-display font-bold">
                {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0, notation: 'compact' }).format(totalSpent)}
              </p>
            )}
          </div>
        </motion.div>

        {/* Visit History */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-white font-display font-semibold text-lg mb-4">История посещений</h2>
          {apptLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <AppointmentCardSkeleton key={i} />)}
            </div>
          ) : appointments.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-white/30 text-sm font-body mb-4">Записей пока нет</p>
              <button
                onClick={() => {
                  hapticImpact('medium')
                  navigate('/booking')
                }}
                className="text-gold text-sm font-body underline"
              >
                Записаться на первый визит
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map(appt => (
                <VisitCard key={appt.id} appointment={appt} />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
