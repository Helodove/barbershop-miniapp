import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Barber, BarberSchedule, TimeSlot } from '../types'

const DAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function getWeekDates(offset = 0): string[] {
  const dates: string[] = []
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + offset * 7)
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function useBarbers() {
  const { role } = useAuth()
  return useQuery({
    queryKey: ['schedule-barbers'],
    queryFn: async (): Promise<Barber[]> => {
      if (role === 'barber') {
        const { data } = await supabase.from('barbers').select('*').eq('is_active', true)
        return (data ?? []).filter(b => b.telegram_id === null) // barber sees their own
      }
      const { data } = await supabase.from('barbers').select('*').eq('is_active', true)
      return data ?? []
    },
  })
}

function useSchedules(barberId: string, dates: string[]) {
  return useQuery({
    queryKey: ['schedules', barberId, dates],
    queryFn: async (): Promise<BarberSchedule[]> => {
      if (!barberId || dates.length === 0) return []
      const { data } = await supabase
        .from('barber_schedules')
        .select('*')
        .eq('barber_id', barberId)
        .in('date', dates)
      return data ?? []
    },
    enabled: !!barberId,
  })
}

function useSlots(barberId: string, dates: string[]) {
  return useQuery({
    queryKey: ['admin-slots', barberId, dates],
    queryFn: async (): Promise<TimeSlot[]> => {
      if (!barberId || dates.length === 0) return []
      const { data } = await supabase
        .from('time_slots')
        .select('*')
        .eq('barber_id', barberId)
        .in('date', dates)
        .order('start_time')
      return data ?? []
    },
    enabled: !!barberId,
  })
}

interface DayEditorProps {
  barberId: string
  date: string
  schedule: BarberSchedule | undefined
  slots: TimeSlot[]
  onSave: (data: Partial<BarberSchedule>) => void
  onGenerateSlots: () => void
  isSaving: boolean
  isGenerating: boolean
}

function DayEditor({ barberId, date, schedule, slots, onSave, onGenerateSlots, isSaving, isGenerating }: DayEditorProps) {
  const [isDayOff, setIsDayOff] = useState(schedule?.is_day_off ?? false)
  const [startTime, setStartTime] = useState(schedule?.start_time?.slice(0, 5) ?? '09:00')
  const [endTime, setEndTime] = useState(schedule?.end_time?.slice(0, 5) ?? '20:00')
  const bookedSlots = slots.filter(s => s.is_booked)
  const freeSlots = slots.filter(s => !s.is_booked && !s.is_blocked)

  const dateObj = new Date(date + 'T00:00:00')
  const dayName = DAYS_RU[dateObj.getDay()]
  const dayNum = dateObj.getDate()

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-semibold text-gray-900">{dayName}, {dayNum}</span>
          {schedule && (
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${isDayOff ? 'text-red-500 bg-red-50' : 'text-green-600 bg-green-50'}`}>
              {isDayOff ? 'выходной' : 'рабочий'}
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-gray-500">Выходной</span>
          <div
            className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${isDayOff ? 'bg-red-400' : 'bg-gray-200'}`}
            onClick={() => setIsDayOff(!isDayOff)}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform m-0.5 ${isDayOff ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
        </label>
      </div>

      {!isDayOff && (
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">С</label>
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-1 block">До</label>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onSave({ barber_id: barberId, date, is_day_off: isDayOff, start_time: startTime, end_time: endTime })}
          disabled={isSaving}
          className="flex-1 py-2 text-xs font-medium bg-black text-white rounded-xl disabled:opacity-50"
        >
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </button>
        {!isDayOff && (
          <button
            onClick={onGenerateSlots}
            disabled={isGenerating}
            className="flex-1 py-2 text-xs font-medium border border-gray-200 text-gray-600 rounded-xl disabled:opacity-50"
          >
            {isGenerating ? 'Генерация...' : `Слоты (${freeSlots.length}+${bookedSlots.length})`}
          </button>
        )}
      </div>
    </div>
  )
}

export function SchedulePage() {
  const queryClient = useQueryClient()
  const { data: barbers = [] } = useBarbers()
  const [selectedBarberId, setSelectedBarberId] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)
  const dates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const barberId = selectedBarberId || barbers[0]?.id || ''

  const { data: schedules = [] } = useSchedules(barberId, dates)
  const { data: slots = [] } = useSlots(barberId, dates)

  const saveSchedule = useMutation({
    mutationFn: async (data: Partial<BarberSchedule>) => {
      const { error } = await supabase
        .from('barber_schedules')
        .upsert(data, { onConflict: 'barber_id,date' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
  })

  const generateSlots = useMutation({
    mutationFn: async (date: string) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-slots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ barber_id: barberId, date }),
      })
      if (!res.ok) throw new Error('Ошибка генерации слотов')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-slots'] })
    },
  })

  const copyLastWeek = async () => {
    const lastWeekDates = getWeekDates(weekOffset - 1)
    const { data: lastWeekSchedules } = await supabase
      .from('barber_schedules')
      .select('*')
      .eq('barber_id', barberId)
      .in('date', lastWeekDates)

    if (!lastWeekSchedules?.length) {
      alert('Нет расписания на прошлой неделе')
      return
    }

    const newSchedules = lastWeekSchedules.map((s, i) => ({
      barber_id: barberId,
      date: dates[i],
      start_time: s.start_time,
      end_time: s.end_time,
      is_day_off: s.is_day_off,
    }))

    await supabase.from('barber_schedules').upsert(newSchedules, { onConflict: 'barber_id,date' })
    queryClient.invalidateQueries({ queryKey: ['schedules'] })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Расписание</h1>
        <div className="flex gap-2 flex-wrap">
          {barbers.length > 1 && (
            <select
              value={barberId}
              onChange={e => setSelectedBarberId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
            >
              {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
          >← Пред. неделя</button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-2 bg-black text-white rounded-xl text-sm"
          >Эта неделя</button>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
          >След. неделя →</button>
          <button
            onClick={copyLastWeek}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600"
          >Скопировать с пред. недели</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {dates.map(date => (
          <DayEditor
            key={date}
            barberId={barberId}
            date={date}
            schedule={schedules.find(s => s.date === date)}
            slots={slots.filter(s => s.date === date)}
            onSave={(data) => saveSchedule.mutate(data)}
            onGenerateSlots={() => generateSlots.mutate(date)}
            isSaving={saveSchedule.isPending}
            isGenerating={generateSlots.isPending}
          />
        ))}
      </div>
    </div>
  )
}
