import { useReducer, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useBarbers } from '../hooks/useBarbers'
import { useServices, groupServicesByCategory } from '../hooks/useServices'
import { useSlots } from '../hooks/useSlots'
import { useClient } from '../hooks/useClient'
import { useCreateAppointment } from '../hooks/useAppointments'
import { tg, hapticImpact, hapticNotification, hapticSelection } from '../lib/telegram'
import { formatPrice, formatDuration, formatDateShort, formatDayOfWeek, formatTime } from '../lib/format'
import { BarberCardSkeleton, ServiceCardSkeleton, Skeleton } from '../components/ui/Skeleton'
import type { Barber, Service, TimeSlot } from '../types'

type BookingStep = 1 | 2 | 3 | 4 | 5

interface BookingState {
  step: BookingStep
  barber: Barber | null
  services: Service[]
  date: string | null
  slot: TimeSlot | null
  bonusUsed: number
  notes: string
  booked: boolean
}

type BookingAction =
  | { type: 'SET_BARBER'; barber: Barber }
  | { type: 'TOGGLE_SERVICE'; service: Service }
  | { type: 'SET_DATE'; date: string }
  | { type: 'SET_SLOT'; slot: TimeSlot }
  | { type: 'SET_BONUS'; amount: number }
  | { type: 'SET_NOTES'; notes: string }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_BOOKED' }

const initialState: BookingState = {
  step: 1,
  barber: null,
  services: [],
  date: null,
  slot: null,
  bonusUsed: 0,
  notes: '',
  booked: false,
}

function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case 'SET_BARBER':
      return { ...state, barber: action.barber }
    case 'TOGGLE_SERVICE': {
      const exists = state.services.find(s => s.id === action.service.id)
      const services = exists
        ? state.services.filter(s => s.id !== action.service.id)
        : [...state.services, action.service]
      return { ...state, services }
    }
    case 'SET_DATE':
      return { ...state, date: action.date, slot: null }
    case 'SET_SLOT':
      return { ...state, slot: action.slot }
    case 'SET_BONUS':
      return { ...state, bonusUsed: action.amount }
    case 'SET_NOTES':
      return { ...state, notes: action.notes }
    case 'NEXT_STEP':
      return { ...state, step: Math.min(state.step + 1, 5) as BookingStep }
    case 'PREV_STEP':
      return { ...state, step: Math.max(state.step - 1, 1) as BookingStep }
    case 'SET_BOOKED':
      return { ...state, booked: true }
    default:
      return state
  }
}

// --- Step 1: Choose Barber ---
function StepBarber({
  state,
  dispatch,
}: {
  state: BookingState
  dispatch: React.Dispatch<BookingAction>
}) {
  const { data: barbers = [], isLoading } = useBarbers()

  return (
    <div>
      <h2 className="text-white font-display text-xl font-bold mb-1">Выберите мастера</h2>
      <p className="text-white/40 text-sm font-body mb-6">Шаг 1 из 4</p>
      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {[1, 2, 3].map(i => <BarberCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {barbers.map(barber => (
            <motion.div
              key={barber.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                hapticSelection()
                dispatch({ type: 'SET_BARBER', barber })
              }}
              className="flex-shrink-0 w-36 p-4 rounded-2xl cursor-pointer transition-all duration-200"
              style={{
                background: state.barber?.id === barber.id
                  ? 'rgba(201, 168, 76, 0.12)'
                  : 'rgba(255, 255, 255, 0.04)',
                border: state.barber?.id === barber.id
                  ? '1px solid rgba(201, 168, 76, 0.6)'
                  : '1px solid rgba(255, 255, 255, 0.06)',
                boxShadow: state.barber?.id === barber.id
                  ? '0 0 20px rgba(201, 168, 76, 0.15)'
                  : 'none',
              }}
            >
              {barber.photo_url ? (
                <img
                  src={barber.photo_url}
                  alt={barber.name}
                  className="w-16 h-16 rounded-full object-cover mx-auto mb-3"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">✂️</span>
                </div>
              )}
              <p className="text-white text-sm font-medium text-center leading-tight">
                {barber.name}
              </p>
              {barber.bio && (
                <p className="text-white/40 text-xs text-center mt-1 line-clamp-2 leading-tight">
                  {barber.bio}
                </p>
              )}
              {state.barber?.id === barber.id && (
                <motion.div
                  layoutId="barber-check"
                  className="mt-2 mx-auto w-5 h-5 rounded-full bg-gold flex items-center justify-center"
                >
                  <span className="text-black text-xs">✓</span>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Step 2: Choose Services ---
function StepServices({
  state,
  dispatch,
}: {
  state: BookingState
  dispatch: React.Dispatch<BookingAction>
}) {
  const { data: services = [], isLoading } = useServices()
  const grouped = useMemo(() => groupServicesByCategory(services), [services])
  const totalPrice = state.services.reduce((s, x) => s + x.price, 0)
  const totalDuration = state.services.reduce((s, x) => s + x.duration_minutes, 0)

  return (
    <div>
      <h2 className="text-white font-display text-xl font-bold mb-1">Выберите услуги</h2>
      <p className="text-white/40 text-sm font-body mb-6">Можно выбрать несколько</p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <ServiceCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-gold text-xs font-body uppercase tracking-widest mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {items.map(service => {
                  const selected = !!state.services.find(s => s.id === service.id)
                  return (
                    <motion.div
                      key={service.id}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        hapticSelection()
                        dispatch({ type: 'TOGGLE_SERVICE', service })
                      }}
                      className="flex items-center gap-3 p-4 rounded-2xl cursor-pointer"
                      style={{
                        background: selected ? 'rgba(201, 168, 76, 0.08)' : 'rgba(255,255,255,0.04)',
                        border: selected ? '1px solid rgba(201, 168, 76, 0.5)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {/* Animated Checkbox */}
                      <motion.div
                        className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center"
                        animate={{
                          background: selected ? '#C9A84C' : 'rgba(255,255,255,0.08)',
                          borderColor: selected ? '#C9A84C' : 'rgba(255,255,255,0.2)',
                        }}
                        style={{ border: '1px solid' }}
                      >
                        <AnimatePresence>
                          {selected && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="text-black text-xs font-bold"
                            >
                              ✓
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>

                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{service.name}</p>
                        {service.description && (
                          <p className="text-white/40 text-xs mt-0.5 truncate">{service.description}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-white text-sm font-semibold">{formatPrice(service.price)}</p>
                        <p className="text-white/40 text-xs">{formatDuration(service.duration_minutes)}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sticky price bar */}
      {state.services.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-20 left-4 right-4 rounded-2xl px-4 py-3 flex items-center justify-between"
          style={{ background: 'rgba(201, 168, 76, 0.15)', border: '1px solid rgba(201, 168, 76, 0.3)', backdropFilter: 'blur(12px)' }}
        >
          <span className="text-white/70 text-sm font-body">{formatDuration(totalDuration)}</span>
          <span className="text-gold font-display font-bold text-lg">{formatPrice(totalPrice)}</span>
        </motion.div>
      )}
    </div>
  )
}

// --- Step 3: Choose Date ---
function StepDate({
  state,
  dispatch,
}: {
  state: BookingState
  dispatch: React.Dispatch<BookingAction>
}) {
  const days = useMemo(() => {
    const result = []
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      result.push(d.toISOString().split('T')[0])
    }
    return result
  }, [])

  return (
    <div>
      <h2 className="text-white font-display text-xl font-bold mb-1">Выберите дату</h2>
      <p className="text-white/40 text-sm font-body mb-6">Доступно на 14 дней вперёд</p>
      <div className="flex gap-2 overflow-x-auto pb-3">
        {days.map(dateStr => {
          const date = new Date(dateStr)
          const dayOfWeek = date.getDay()
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
          const isSelected = state.date === dateStr

          return (
            <motion.div
              key={dateStr}
              whileTap={isWeekend ? undefined : { scale: 0.95 }}
              onClick={() => {
                if (isWeekend) return
                hapticSelection()
                dispatch({ type: 'SET_DATE', date: dateStr })
              }}
              className="flex-shrink-0 w-14 py-3 rounded-2xl flex flex-col items-center gap-1 cursor-pointer"
              style={{
                background: isSelected
                  ? 'linear-gradient(135deg, #E8C97A, #C9A84C)'
                  : isWeekend
                  ? 'rgba(255,255,255,0.03)'
                  : 'rgba(255,255,255,0.06)',
                border: isSelected
                  ? 'none'
                  : '1px solid rgba(255,255,255,0.06)',
                opacity: isWeekend ? 0.35 : 1,
              }}
            >
              <span
                className="text-xs font-body uppercase tracking-wide"
                style={{ color: isSelected ? '#0A0A0A' : 'rgba(255,255,255,0.5)' }}
              >
                {formatDayOfWeek(dateStr)}
              </span>
              <span
                className="text-lg font-display font-bold"
                style={{ color: isSelected ? '#0A0A0A' : 'white' }}
              >
                {date.getDate()}
              </span>
              <span
                className="text-xs font-body"
                style={{ color: isSelected ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.35)' }}
              >
                {new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(date)}
              </span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// --- Step 4: Choose Time ---
function StepTime({
  state,
  dispatch,
}: {
  state: BookingState
  dispatch: React.Dispatch<BookingAction>
}) {
  const { data: slots = [], isLoading } = useSlots(
    state.barber?.id ?? null,
    state.date
  )

  return (
    <div>
      <h2 className="text-white font-display text-xl font-bold mb-1">Выберите время</h2>
      <p className="text-white/40 text-sm font-body mb-6">
        {state.date ? formatDateShort(state.date) : ''}
      </p>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : slots.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-white/30 text-sm font-body">Нет доступных слотов на этот день</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {slots.map(slot => {
            const isSelected = state.slot?.id === slot.id
            const isUnavailable = slot.is_booked || slot.is_blocked

            return (
              <motion.div
                key={slot.id}
                whileTap={isUnavailable ? undefined : { scale: 0.95 }}
                onClick={() => {
                  if (isUnavailable) return
                  hapticSelection()
                  dispatch({ type: 'SET_SLOT', slot })
                }}
                className="py-3 rounded-xl flex items-center justify-center text-sm font-medium"
                style={{
                  background: isSelected
                    ? 'rgba(201, 168, 76, 0.15)'
                    : isUnavailable
                    ? 'rgba(255,255,255,0.03)'
                    : 'rgba(255,255,255,0.07)',
                  border: isSelected
                    ? '1px solid rgba(201, 168, 76, 0.7)'
                    : '1px solid rgba(255,255,255,0.06)',
                  color: isSelected ? '#C9A84C' : isUnavailable ? 'rgba(255,255,255,0.2)' : 'white',
                  cursor: isUnavailable ? 'not-allowed' : 'pointer',
                  textDecoration: isUnavailable ? 'line-through' : 'none',
                  opacity: isUnavailable ? 0.5 : 1,
                }}
              >
                {formatTime(slot.start_time)}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Step 5: Confirm ---
function StepConfirm({
  state,
  dispatch,
  onSubmit,
  isSubmitting,
}: {
  state: BookingState
  dispatch: React.Dispatch<BookingAction>
  onSubmit: () => void
  isSubmitting: boolean
}) {
  const { data: client } = useClient()
  const totalPrice = state.services.reduce((s, x) => s + x.price, 0)
  const maxBonus = Math.floor(totalPrice * 0.2)
  const availableBonus = Math.min(client?.bonus_points ?? 0, maxBonus)
  const finalPrice = totalPrice - state.bonusUsed

  useEffect(() => {
    tg.MainButton.setText(isSubmitting ? 'Оформление...' : 'Подтвердить запись')
    tg.MainButton.show()
    if (!isSubmitting) {
      tg.MainButton.onClick(onSubmit)
      tg.MainButton.enable()
    } else {
      tg.MainButton.disable()
    }
    return () => {
      tg.MainButton.offClick(onSubmit)
    }
  }, [isSubmitting, onSubmit])

  return (
    <div>
      <h2 className="text-white font-display text-xl font-bold mb-1">Подтверждение</h2>
      <p className="text-white/40 text-sm font-body mb-6">Проверьте детали записи</p>

      <div className="space-y-3">
        {/* Barber */}
        <div className="p-4 rounded-2xl bg-surface border border-white/5">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Мастер</p>
          <p className="text-white font-medium">{state.barber?.name}</p>
        </div>

        {/* Services */}
        <div className="p-4 rounded-2xl bg-surface border border-white/5">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Услуги</p>
          <div className="space-y-1">
            {state.services.map(s => (
              <div key={s.id} className="flex justify-between">
                <p className="text-white text-sm">{s.name}</p>
                <p className="text-white/70 text-sm">{formatPrice(s.price)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Date & Time */}
        <div className="p-4 rounded-2xl bg-surface border border-white/5">
          <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Дата и время</p>
          <p className="text-white font-medium">
            {state.date && formatDateShort(state.date)},{' '}
            {state.slot && formatTime(state.slot.start_time)}
          </p>
        </div>

        {/* Bonus Usage */}
        {availableBonus > 0 && (
          <div className="p-4 rounded-2xl border" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <p className="text-gold text-xs uppercase tracking-widest mb-3">Использовать бонусы</p>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/60 text-sm">Доступно: {client?.bonus_points} бонусов</p>
              <p className="text-gold text-sm font-semibold">-{formatPrice(state.bonusUsed)}</p>
            </div>
            <input
              type="range"
              min={0}
              max={availableBonus}
              step={50}
              value={state.bonusUsed}
              onChange={(e) => dispatch({ type: 'SET_BONUS', amount: Number(e.target.value) })}
              className="w-full accent-gold"
            />
            <p className="text-white/40 text-xs mt-1">Максимум 20% от суммы = {formatPrice(maxBonus)}</p>
          </div>
        )}

        {/* Total */}
        <div className="p-4 rounded-2xl bg-surface border border-white/5 flex items-center justify-between">
          <p className="text-white font-display font-semibold">Итого</p>
          <div className="text-right">
            {state.bonusUsed > 0 && (
              <p className="text-white/40 text-sm line-through">{formatPrice(totalPrice)}</p>
            )}
            <p className="text-gold font-display font-bold text-xl">{formatPrice(finalPrice)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Success Screen ---
function SuccessScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    tg.MainButton.hide()
    tg.BackButton.hide()
    hapticNotification('success')
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' }}
      >
        <span className="text-4xl text-black">✓</span>
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-white font-display text-2xl font-bold mb-3"
      >
        Запись оформлена!
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-white/50 font-body mb-8"
      >
        Вы получите уведомление с подтверждением
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col gap-3 w-full"
      >
        <button
          onClick={() => navigate('/profile')}
          className="w-full py-4 rounded-2xl font-display font-bold text-black"
          style={{ background: 'linear-gradient(135deg, #E8C97A, #C9A84C)' }}
        >
          Мои записи
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-full py-4 rounded-2xl font-body text-white/70 border border-white/10"
        >
          На главную
        </button>
      </motion.div>
    </motion.div>
  )
}

// --- Main BookingScreen ---
export default function BookingScreen() {
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(bookingReducer, initialState)
  const { data: client } = useClient()
  const { mutateAsync: createAppointment, isPending } = useCreateAppointment()

  // Progress bar
  const progress = ((state.step - 1) / 4) * 100

  // Back button handling
  useEffect(() => {
    if (state.step === 1) {
      tg.BackButton.hide()
    } else {
      tg.BackButton.show()
      tg.BackButton.onClick(() => dispatch({ type: 'PREV_STEP' }))
    }
    return () => tg.BackButton.offClick(() => dispatch({ type: 'PREV_STEP' }))
  }, [state.step])

  // Main button for steps 1-4
  useEffect(() => {
    if (state.step === 5 || state.booked) return

    const canProceed =
      (state.step === 1 && !!state.barber) ||
      (state.step === 2 && state.services.length > 0) ||
      (state.step === 3 && !!state.date) ||
      (state.step === 4 && !!state.slot)

    if (canProceed) {
      tg.MainButton.setText('Далее')
      tg.MainButton.show()
      tg.MainButton.enable()
      tg.MainButton.onClick(() => {
        hapticImpact('light')
        dispatch({ type: 'NEXT_STEP' })
      })
    } else {
      tg.MainButton.hide()
    }

    return () => {
      tg.MainButton.offClick(() => dispatch({ type: 'NEXT_STEP' }))
    }
  }, [state.step, state.barber, state.services, state.date, state.slot, state.booked])

  const handleSubmit = useCallback(async () => {
    if (!client || !state.barber || !state.slot || state.services.length === 0) return

    try {
      hapticImpact('medium')
      await createAppointment({
        client_id: client.id,
        barber_id: state.barber.id,
        slot_id: state.slot.id,
        services: state.services,
        total_price: state.services.reduce((s, x) => s + x.price, 0) - state.bonusUsed,
        total_duration: state.services.reduce((s, x) => s + x.duration_minutes, 0),
        bonus_used: state.bonusUsed,
        notes: state.notes || undefined,
      })
      dispatch({ type: 'SET_BOOKED' })
      hapticNotification('success')
    } catch {
      hapticNotification('error')
    }
  }, [client, state, createAppointment])

  if (state.booked) return <SuccessScreen />

  const stepComponents: Record<BookingStep, React.ReactNode> = {
    1: <StepBarber state={state} dispatch={dispatch} />,
    2: <StepServices state={state} dispatch={dispatch} />,
    3: <StepDate state={state} dispatch={dispatch} />,
    4: <StepTime state={state} dispatch={dispatch} />,
    5: <StepConfirm state={state} dispatch={dispatch} onSubmit={handleSubmit} isSubmitting={isPending} />,
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <motion.div
          className="h-full"
          style={{ background: 'linear-gradient(90deg, #C9A84C, #E8C97A)' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="px-4 pt-6 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={state.step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
          >
            {stepComponents[state.step]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
