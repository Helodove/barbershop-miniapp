import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { formatPrice, formatDateShort } from '../lib/format'
import type { Appointment } from '../types'

const GOLD = '#C9A84C'
const COLORS = ['#C9A84C', '#1A1A1A', '#888', '#555', '#333']

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100">
      <p className="text-gray-500 text-sm">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
    </div>
  )
}

function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const { data: appointments } = await supabase
        .from('appointments')
        .select('*, barber:barbers(name), slot:time_slots(date)')
        .gte('created_at', weekAgo + 'T00:00:00')
        .order('created_at', { ascending: true })

      const { data: todayAppts } = await supabase
        .from('appointments')
        .select('id')
        .eq('created_at', today)

      const { data: newClients } = await supabase
        .from('clients')
        .select('id')
        .gte('created_at', weekAgo + 'T00:00:00')

      return {
        appointments: (appointments ?? []) as Appointment[],
        todayCount: todayAppts?.length ?? 0,
        newClientsCount: newClients?.length ?? 0,
      }
    },
    staleTime: 2 * 60 * 1000,
  })
}

export function DashboardPage() {
  const { data, isLoading } = useDashboardData()

  const weekRevenue = useMemo(() => {
    return (data?.appointments ?? [])
      .filter(a => a.status === 'completed')
      .reduce((sum, a) => sum + a.total_price, 0)
  }, [data?.appointments])

  // Revenue by day (last 7 days)
  const revenueByDay = useMemo(() => {
    const map: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      map[d.toISOString().split('T')[0]] = 0
    }
    for (const appt of data?.appointments ?? []) {
      if (appt.status !== 'completed') continue
      const date = appt.slot?.date ?? appt.created_at.split('T')[0]
      if (date in map) map[date] = (map[date] ?? 0) + appt.total_price
    }
    return Object.entries(map).map(([date, revenue]) => ({
      date: formatDateShort(date),
      revenue,
    }))
  }, [data?.appointments])

  // Top services
  const topServices = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {}
    for (const appt of data?.appointments ?? []) {
      for (const svc of appt.services ?? []) {
        if (!map[svc.id]) map[svc.id] = { name: svc.name, count: 0 }
        map[svc.id].count++
      }
    }
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5)
  }, [data?.appointments])

  // Barber workload
  const barberLoad = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {}
    for (const appt of data?.appointments ?? []) {
      const name = appt.barber?.name ?? 'Неизвестно'
      if (!map[name]) map[name] = { name, count: 0 }
      map[name].count++
    }
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [data?.appointments])

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-24 mb-2" />
              <div className="h-7 bg-gray-100 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Записей сегодня"
          value={String(data?.todayCount ?? 0)}
        />
        <MetricCard
          label="Выручка за неделю"
          value={formatPrice(weekRevenue)}
          sub="только завершённые"
        />
        <MetricCard
          label="Новых клиентов"
          value={String(data?.newClientsCount ?? 0)}
          sub="за 7 дней"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue LineChart */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h2 className="text-gray-800 font-semibold mb-4">Выручка по дням</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatPrice(v)} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke={GOLD}
                strokeWidth={2}
                dot={{ fill: GOLD, r: 3 }}
                name="Выручка"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Services PieChart */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <h2 className="text-gray-800 font-semibold mb-4">Топ услуг</h2>
          {topServices.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
              Нет данных
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={topServices}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, percent }: { name: string; percent: number }) =>
                    `${name.slice(0, 10)} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {topServices.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} раз`, '']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Barber Workload BarChart */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <h2 className="text-gray-800 font-semibold mb-4">Загруженность мастеров (записи за неделю)</h2>
        {barberLoad.length === 0 ? (
          <div className="h-[160px] flex items-center justify-center text-gray-400 text-sm">
            Нет данных
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barberLoad} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
              <Tooltip formatter={(v: number) => [`${v} записей`, '']} />
              <Bar dataKey="count" fill={GOLD} radius={[0, 4, 4, 0]} name="Записей" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
