import { Bot, webhookCallback, InlineKeyboard } from 'grammy'
import { createClient } from '@supabase/supabase-js'
import { createServer } from 'http'
import cron from 'node-cron'

const BOT_TOKEN        = process.env.BOT_TOKEN
const SUPABASE_URL     = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const WEBHOOK_URL      = process.env.WEBHOOK_URL
const APP_URL          = process.env.APP_URL
const PORT             = process.env.PORT || 3000

if (!BOT_TOKEN) { console.error('BOT_TOKEN required'); process.exit(1) }

const bot = new Bot(BOT_TOKEN)

const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null

// ─── FORMATTERS ──────────────────────────────────────────────────────────────

const fmt = (amount) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount)

const fmtDate = (dateStr) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(dateStr + 'T00:00:00'))

const fmtTime = (t) => t.slice(0, 5)

// ─── DB HELPERS ──────────────────────────────────────────────────────────────

async function getOrCreateClient(tgUser) {
  if (!supabase) return null
  const { data } = await supabase
    .from('clients')
    .upsert({
      telegram_id: tgUser.id,
      username: tgUser.username ?? null,
      first_name: tgUser.first_name ?? null,
      last_name: tgUser.last_name ?? null,
    }, { onConflict: 'telegram_id' })
    .select().single()
  return data
}

async function getClientAppointments(clientId) {
  if (!supabase) return []
  const { data } = await supabase
    .from('appointments')
    .select('*, barber:barbers(name), slot:time_slots(date, start_time)')
    .eq('client_id', clientId)
    .in('status', ['pending', 'confirmed'])
    .order('created_at', { ascending: false })
  return data ?? []
}

// ─── SEND HELPER ─────────────────────────────────────────────────────────────

async function send(telegramId, text) {
  try {
    await bot.api.sendMessage(telegramId, text, { parse_mode: 'HTML' })
  } catch (err) {
    console.error(`[notify] failed to send to ${telegramId}:`, err.message)
  }
}

// ─── COMMANDS ────────────────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  await getOrCreateClient(ctx.from)
  const kb = new InlineKeyboard()
  if (APP_URL) kb.webApp('✂️ Записаться', APP_URL)
  await ctx.reply(
    `👋 Привет, <b>${ctx.from.first_name || 'друг'}</b>!\n\n` +
    `Добро пожаловать в барбершоп. Запишитесь к мастеру в пару кликов.`,
    { reply_markup: kb, parse_mode: 'HTML' }
  )
})

bot.command('menu', async (ctx) => {
  const kb = new InlineKeyboard()
  if (APP_URL) kb.webApp('✂️ Открыть приложение', APP_URL).row()
  kb.text('📅 Мои записи', 'mybooking').row().text('💡 Помощь', 'help')
  await ctx.reply('🗂️ <b>Главное меню</b>', { reply_markup: kb, parse_mode: 'HTML' })
})

bot.command('mybooking', async (ctx) => {
  const client = await getOrCreateClient(ctx.from)
  if (!client) return ctx.reply('Произошла ошибка. Попробуйте позже.')
  const appointments = await getClientAppointments(client.id)
  if (appointments.length === 0) {
    const kb = APP_URL ? new InlineKeyboard().webApp('✂️ Записаться', APP_URL) : undefined
    return ctx.reply('У вас нет активных записей.', { reply_markup: kb })
  }
  let text = '📅 <b>Ваши записи:</b>\n\n'
  for (const appt of appointments) {
    const emoji = appt.status === 'confirmed' ? '✅' : '⏳'
    const dt = appt.slot ? `${fmtDate(appt.slot.date)}, ${fmtTime(appt.slot.start_time)}` : '—'
    text += `${emoji} <b>${appt.barber?.name ?? 'Мастер'}</b>\n📅 ${dt}\n💰 ${fmt(appt.total_price)}\n🆔 /cancel_${appt.id.slice(0, 8)}\n\n`
  }
  await ctx.reply(text, { parse_mode: 'HTML' })
})

bot.command('cancel', async (ctx) => {
  const arg = ctx.message?.text?.split(' ').slice(1).join('') ?? ''
  if (!arg) return ctx.reply('Укажите ID записи: /cancel <id>')
  const client = await getOrCreateClient(ctx.from)
  if (!client) return ctx.reply('Произошла ошибка.')
  const { data: appts } = await supabase
    .from('appointments')
    .select('*, slot:time_slots(date, start_time)')
    .eq('client_id', client.id)
    .in('status', ['pending', 'confirmed'])
  const appt = appts?.find(a => a.id.startsWith(arg) || a.id.slice(0, 8) === arg)
  if (!appt) return ctx.reply('Запись не найдена или уже отменена.')
  if (appt.slot) {
    const apptTime = new Date(`${appt.slot.date}T${appt.slot.start_time}`)
    if (apptTime <= new Date(Date.now() + 2 * 60 * 60 * 1000))
      return ctx.reply('❌ Отменить можно минимум за 2 часа до визита.')
  }
  await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id)
  if (appt.slot_id) await supabase.from('time_slots').update({ is_booked: false }).eq('id', appt.slot_id)
  await ctx.reply('✅ Запись отменена.')
})

bot.callbackQuery('mybooking', async (ctx) => {
  await ctx.answerCallbackQuery()
  const client = await getOrCreateClient(ctx.from)
  if (!client) return ctx.editMessageText('Произошла ошибка.')
  const appts = await getClientAppointments(client.id)
  if (appts.length === 0) return ctx.editMessageText('У вас нет активных записей.')
  let text = '📅 <b>Ваши записи:</b>\n\n'
  for (const a of appts) {
    const dt = a.slot ? `${fmtDate(a.slot.date)}, ${fmtTime(a.slot.start_time)}` : '—'
    text += `${a.status === 'confirmed' ? '✅' : '⏳'} <b>${a.barber?.name}</b>\n📅 ${dt}\n💰 ${fmt(a.total_price)}\n\n`
  }
  await ctx.editMessageText(text, { parse_mode: 'HTML' })
})

bot.callbackQuery('help', async (ctx) => {
  await ctx.answerCallbackQuery()
  await ctx.editMessageText(
    '💡 <b>Помощь</b>\n\n/start — старт\n/menu — меню\n/mybooking — мои записи\n/cancel <id> — отменить запись',
    { parse_mode: 'HTML' }
  )
})

// ─── NOTIFICATION JOBS ────────────────────────────────────────────────────────

async function getUnnotified(flag) {
  if (!supabase) return []
  const { data } = await supabase
    .from('appointments')
    .select('id, services, total_price, notified_created, notified_day_before, notified_hour_before, slot_id, client:clients(telegram_id, first_name), barber:barbers(name), slot:time_slots(date, start_time)')
    .in('status', ['pending', 'confirmed'])
    .eq(flag, false)
  return data ?? []
}

// JOB 1: Booking confirmation — каждые 2 минуты
async function jobCreated() {
  const appts = await getUnnotified('notified_created')
  for (const appt of appts) {
    const tgId = appt.client?.telegram_id
    if (!tgId) continue
    const dt = appt.slot ? `${fmtDate(appt.slot.date)}, ${fmtTime(appt.slot.start_time)}` : '—'
    const svcList = (appt.services ?? []).map(s => `• ${s.name}`).join('\n') || '—'
    await send(tgId,
      `✅ <b>Запись оформлена!</b>\n\n` +
      `👤 Мастер: <b>${appt.barber?.name}</b>\n` +
      `📅 ${dt}\n\n` +
      `<b>Услуги:</b>\n${svcList}\n\n` +
      `💰 Итого: <b>${fmt(appt.total_price)}</b>\n\n` +
      `Ждём вас! 💈`
    )
    await supabase.from('appointments').update({ notified_created: true }).eq('id', appt.id)
    console.log(`[notify:created] → ${tgId}`)
  }
}

// JOB 2: День до записи — каждый час в :05
async function jobDayBefore() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const appts = await getUnnotified('notified_day_before')
  const toSend = appts.filter(a => a.slot?.date === tomorrowStr)

  for (const appt of toSend) {
    const tgId = appt.client?.telegram_id
    if (!tgId) continue
    await send(tgId,
      `📅 <b>Напоминание — завтра визит!</b>\n\n` +
      `Мастер: <b>${appt.barber?.name}</b>\n` +
      `Время: <b>${fmtDate(appt.slot.date)}, ${fmtTime(appt.slot.start_time)}</b>\n\n` +
      `Если планы изменились — отмените запись через /mybooking. 💈`
    )
    await supabase.from('appointments').update({ notified_day_before: true }).eq('id', appt.id)
    console.log(`[notify:day-before] → ${tgId}`)
  }
}

// JOB 3: Час до записи — каждые 10 минут
async function jobHourBefore() {
  const now       = new Date()
  const in50      = new Date(now.getTime() + 50 * 60 * 1000)
  const in70      = new Date(now.getTime() + 70 * 60 * 1000)
  const todayStr  = now.toISOString().split('T')[0]

  const appts = await getUnnotified('notified_hour_before')
  const toSend = appts.filter(a => {
    if (!a.slot || a.slot.date !== todayStr) return false
    const t = new Date(`${a.slot.date}T${a.slot.start_time}`)
    return t >= in50 && t <= in70
  })

  for (const appt of toSend) {
    const tgId = appt.client?.telegram_id
    if (!tgId) continue
    await send(tgId,
      `⏰ <b>Через час — ваша запись!</b>\n\n` +
      `Мастер: <b>${appt.barber?.name}</b>\n` +
      `Время: <b>${fmtTime(appt.slot.start_time)}</b>\n\n` +
      `Ждём вас! 💈`
    )
    await supabase.from('appointments').update({ notified_hour_before: true }).eq('id', appt.id)
    console.log(`[notify:hour-before] → ${tgId}`)
  }
}

// Запуск cron-задач
cron.schedule('*/2 * * * *',  () => jobCreated().catch(e => console.error('[cron:created]', e.message)))
cron.schedule('5 * * * *',    () => jobDayBefore().catch(e => console.error('[cron:day-before]', e.message)))
cron.schedule('*/10 * * * *', () => jobHourBefore().catch(e => console.error('[cron:hour-before]', e.message)))

console.log('✅ Cron jobs: создание(2мин) | за день(1ч) | за час(10мин)')

// ─── HTTP SERVER ──────────────────────────────────────────────────────────────

const handleUpdate = webhookCallback(bot, 'http')

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    try { await handleUpdate(req, res) } catch (e) { console.error('Webhook:', e); res.writeHead(500); res.end() }
    return
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
    return
  }
  res.writeHead(404); res.end()
})

server.listen(PORT, async () => {
  console.log(`Bot server on port ${PORT}`)
  if (WEBHOOK_URL) {
    try {
      await bot.api.setWebhook(`${WEBHOOK_URL}/webhook`)
      console.log(`Webhook: ${WEBHOOK_URL}/webhook`)
    } catch (e) { console.error('Webhook error:', e.message) }
  }
  // Сразу при старте проверяем пропущенные уведомления
  jobCreated().catch(e => console.error('[startup]', e.message))
})

server.on('error', (e) => { console.error('Server error:', e); process.exit(1) })
