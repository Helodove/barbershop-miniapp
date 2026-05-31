export const formatPrice = (amount: number): string =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount)

export const formatDate = (dateStr: string): string =>
  new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateStr))

export const formatDateShort = (dateStr: string): string =>
  new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(dateStr))

export const formatTime = (timeStr: string): string => timeStr.slice(0, 5)

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} мин`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
}

export const formatDayOfWeek = (dateStr: string): string =>
  new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(new Date(dateStr))

export const DAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
export const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
