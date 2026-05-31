import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useClient, useRegisterClient } from '../hooks/useClient'
import { useAppointments } from '../hooks/useAppointments'
import { getTelegramUser, tg, hapticImpact } from '../lib/telegram'
import { formatPrice, formatDate, formatTime } from '../lib/format'
import { AppointmentCardSkeleton, Skeleton } from '../components/ui/Skeleton'
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
  completed: 'text-white/60 bg-white/5',
  cancelled: 'text-red-400 bg-red-400/10',
}

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const navigate = useNavigate()

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/appointments/${appointment.id}`)}
      className="p-4 rounded-2xl bg-surface border border-white/5 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">
            {appointment.barber?.name ?? 'Барбер'}
          </p>
          <p className="text-white/50 text-sm mt-0.5">
            {appointment.slot
              ? `${formatDate(appointment.slot.date)}, ${formatTime(appointment.slot.start_time)}`
              : formatDate(appointment.created_at)}
          </p>
          <p className="text-gold text-sm mt-1 font-medium">
            {formatPrice(appointment.total_price)}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0 ${STATUS_COLORS[appointment.status]}`}
        >
          {STATUS_LABELS[appointment.status]}
        </span>
      </div>
    </motion.div>
  )
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const tgUser = getTelegramUser()
  const { data: client, isLoading: clientLoading } = useClient()
  const { mutate: registerClient } = useRegisterClient()
  const { data: appointments, isLoading: apptLoading } = useAppointments(client?.id)

  useEffect(() => {
    // Register/update client on first open
    if (tgUser) {
      registerClient()
    }
  }, [tgUser?.id])

  useEffect(() => {
    tg.BackButton.hide()
    tg.MainButton.hide()
  }, [])

  const recentAppointments = (appointments ?? [])
    .filter(a => a.status !== 'cancelled')
    .slice(0, 3)

  const firstName = tgUser?.first_name ?? 'Гость'

  return (
    <div className="min-h-screen bg-bg relative overflow-hidden">
      {/* Decorative gold geometric lines background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg className="absolute top-0 right-0 w-64 h-64 opacity-[0.04]" viewBox="0 0 256 256">
          <line x1="256" y1="0" x2="0" y2="256" stroke="#C9A84C" strokeWidth="1" />
          <line x1="256" y1="64" x2="64" y2="256" stroke="#C9A84C" strokeWidth="1" />
          <line x1="256" y1="128" x2="128" y2="256" stroke="#C9A84C" strokeWidth="1" />
          <line x1="192" y1="0" x2="0" y2="192" stroke="#C9A84C" strokeWidth="1" />
          <line x1="128" y1="0" x2="0" y2="128" stroke="#C9A84C" strokeWidth="1" />
        </svg>
      </div>

      <div className="relative z-10 px-4 pt-8 pb-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-white/50 text-sm font-body">Добро пожаловать</p>
          <h1 className="text-white text-2xl font-display font-bold mt-1">
            {firstName}
          </h1>
        </motion.div>

        {/* Bonus Card */}
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6 rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #2A2A1A 0%, #1A1A0A 50%, #0A0A0A 100%)',
            border: '1px solid rgba(201, 168, 76, 0.3)',
          }}
        >
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/50 text-xs font-body uppercase tracking-widest">
                  Бонусный счёт
                </p>
                {clientLoading ? (
                  <Skeleton className="h-8 w-24 mt-2" />
                ) : (
                  <motion.p
                    key={client?.bonus_points}
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    className="text-3xl font-display font-bold mt-1"
                    style={{ color: '#C9A84C' }}
                  >
                    {client?.bonus_points ?? 0}
                    <span className="text-base ml-1 text-gold/70">бонусов</span>
                  </motion.p>
                )}
              </div>
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(201, 168, 76, 0.15)', border: '1px solid rgba(201, 168, 76, 0.3)' }}
              >
                <span className="text-2xl">✦</span>
              </div>
            </div>
            {!clientLoading && (
              <div className="mt-3">
                <p className="text-white/40 text-xs font-body">
                  Посещений: {client?.total_visits ?? 0} • 1 бонус = 1 ₽
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            hapticImpact('medium')
            navigate('/booking')
          }}
          className="w-full mt-6 py-4 rounded-2xl font-display font-bold text-black text-lg"
          style={{
            background: 'linear-gradient(135deg, #E8C97A 0%, #C9A84C 50%, #A88830 100%)',
          }}
        >
          Записаться
        </motion.button>

        {/* Recent Visits */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-8"
        >
          <h2 className="text-white font-display font-semibold text-lg mb-4">
            Последние визиты
          </h2>
          {apptLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <AppointmentCardSkeleton key={i} />)}
            </div>
          ) : recentAppointments.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-white/30 text-sm font-body">
                Здесь появятся ваши визиты
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAppointments.map((appt) => (
                <AppointmentCard key={appt.id} appointment={appt} />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
