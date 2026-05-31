import { Bot, webhookCallback, InlineKeyboard } from 'grammy'
import { createClient } from '@supabase/supabase-js'

const BOT_TOKEN = process.env.BOT_TOKEN
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const WEBHOOK_URL = process.env.WEBHOOK_URL
const APP_URL = process.env.APP_URL
const PORT = process.env.PORT || 3000

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN environment variable is required')
  process.exit(1)
}

const bot = new Bot(BOT_TOKEN)

const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null

// ─── HELPERS ────────────────────────────────────────────────────────────────

const formatPrice = (amount) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount)

const formatDate = (dateStr) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dateStr + 'T00:00:00'))

const formatTime = (timeStr) => timeStr.slice(0, 5)

async function getOrCreateClient(tgUser) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('clients')
    .upsert({
      telegram_id: tgUser.id,
      username: tgUser.username ?? null,
      first_name: tgUser.first_name ?? null,
      last_name: tgUser.last_name ?? null,
    }, { onConflict: 'telegram_id' })
    .select()
    .single()
  if (error) {
    console.error('getOrCreateClient error:', error.message)
    return null
  }
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

// ─── COMMANDS ───────────────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  const user = ctx.from
  await getOrCreateClient(user)

  const keyboard = new InlineKeyboard()
  if (APP_URL) {
    keyboard.webApp('✂️ Записаться', APP_URL)
  }

  await ctx.reply(
    `👋 Привет, ${user.first_name || 'друг'}!\n\n` +
    `Добро пожаловать в барбершоп! Здесь вы можете записаться на стрижку, проверить свои записи и управлять бонусами.\n\n` +
    `Используйте кнопку ниже или команду /menu для навигации.`,
    {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    }
  )
})

bot.command('menu', async (ctx) => {
  const keyboard = new InlineKeyboard()
  if (APP_URL) {
    keyboard.webApp('✂️ Открыть приложение', APP_URL).row()
  }
  keyboard
    .text('📅 Мои записи', 'mybooking')
    .row()
    .text('💡 Помощь', 'help')

  await ctx.reply(
    '🗂️ <b>Главное меню</b>\n\nВыберите действие:',
    { reply_markup: keyboard, parse_mode: 'HTML' }
  )
})

bot.command('mybooking', async (ctx) => {
  const user = ctx.from
  const client = await getOrCreateClient(user)
  if (!client) {
    return ctx.reply('Произошла ошибка. Попробуйте позже.')
  }

  const appointments = await getClientAppointments(client.id)
  if (appointments.length === 0) {
    const keyboard = APP_URL
      ? new InlineKeyboard().webApp('✂️ Записаться', APP_URL)
      : undefined
    return ctx.reply('У вас нет активных записей.', { reply_markup: keyboard })
  }

  let text = '📅 <b>Ваши записи:</b>\n\n'
  for (const appt of appointments) {
    const statusEmoji = appt.status === 'confirmed' ? '✅' : '⏳'
    const dateStr = appt.slot ? `${formatDate(appt.slot.date)}, ${formatTime(appt.slot.start_time)}` : 'Дата не указана'
    text += `${statusEmoji} <b>${appt.barber?.name ?? 'Мастер'}</b>\n`
    text += `📅 ${dateStr}\n`
    text += `💰 ${formatPrice(appt.total_price)}\n`
    text += `🆔 /cancel_${appt.id.slice(0, 8)}\n\n`
  }

  await ctx.reply(text, { parse_mode: 'HTML' })
})

// /cancel command: /cancel <appointment_id_prefix>
bot.command('cancel', async (ctx) => {
  const args = ctx.message?.text?.split(' ').slice(1).join('') ?? ''
  if (!args) {
    return ctx.reply('Укажите ID записи: /cancel <id>\nID можно найти в команде /mybooking')
  }

  if (!supabase) {
    return ctx.reply('Сервис временно недоступен.')
  }

  const user = ctx.from
  const client = await getOrCreateClient(user)
  if (!client) return ctx.reply('Произошла ошибка.')

  // Find appointment by full or partial ID
  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, slot:time_slots(date, start_time)')
    .eq('client_id', client.id)
    .in('status', ['pending', 'confirmed'])

  const appt = appointments?.find(a => a.id.startsWith(args) || a.id.slice(0, 8) === args)

  if (!appt) {
    return ctx.reply('Запись не найдена или уже отменена.')
  }

  // Check 2h window
  if (appt.slot) {
    const apptTime = new Date(`${appt.slot.date}T${appt.slot.start_time}`)
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
    if (apptTime <= twoHoursFromNow) {
      return ctx.reply('❌ Запись нельзя отменить менее чем за 2 часа до визита.')
    }
  }

  // Cancel
  await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id)
  if (appt.slot_id) {
    await supabase.from('time_slots').update({ is_booked: false }).eq('id', appt.slot_id)
  }

  await ctx.reply('✅ Запись успешно отменена.')
})

// Callback for inline buttons
bot.callbackQuery('mybooking', async (ctx) => {
  await ctx.answerCallbackQuery()
  // Simulate /mybooking command
  const user = ctx.from
  const client = await getOrCreateClient(user)
  if (!client) return ctx.editMessageText('Произошла ошибка.')
  const appointments = await getClientAppointments(client.id)
  if (appointments.length === 0) {
    return ctx.editMessageText('У вас нет активных записей.')
  }
  let text = '📅 <b>Ваши записи:</b>\n\n'
  for (const appt of appointments) {
    const statusEmoji = appt.status === 'confirmed' ? '✅' : '⏳'
    const dateStr = appt.slot ? `${formatDate(appt.slot.date)}, ${formatTime(appt.slot.start_time)}` : 'Дата не указана'
    text += `${statusEmoji} <b>${appt.barber?.name ?? 'Мастер'}</b>\n`
    text += `📅 ${dateStr}\n`
    text += `💰 ${formatPrice(appt.total_price)}\n\n`
  }
  await ctx.editMessageText(text, { parse_mode: 'HTML' })
})

bot.callbackQuery('help', async (ctx) => {
  await ctx.answerCallbackQuery()
  await ctx.editMessageText(
    '💡 <b>Помощь</b>\n\n' +
    '/start — запустить бота\n' +
    '/menu — главное меню\n' +
    '/mybooking — мои записи\n' +
    '/cancel <id> — отменить запись\n\n' +
    'Для записи используйте кнопку "Открыть приложение"',
    { parse_mode: 'HTML' }
  )
})

// ─── NOTIFICATION FUNCTIONS (called externally) ──────────────────────────────

export async function notifyBookingCreated({ telegram_id, barberName, date, time, services, total_price }) {
  const serviceList = services.map(s => `• ${s.name}`).join('\n')
  await bot.api.sendMessage(
    telegram_id,
    `✅ <b>Запись оформлена!</b>\n\n` +
    `👤 Мастер: <b>${barberName}</b>\n` +
    `📅 ${formatDate(date)}, ${formatTime(time)}\n\n` +
    `<b>Услуги:</b>\n${serviceList}\n\n` +
    `💰 Итого: <b>${formatPrice(total_price)}</b>\n\n` +
    `Ждём вас! 💈`,
    { parse_mode: 'HTML' }
  )
}

export async function notifyReminder({ telegram_id, barberName, date, time }) {
  await bot.api.sendMessage(
    telegram_id,
    `⏰ <b>Напоминание о визите</b>\n\n` +
    `Через 2 часа у вас запись к мастеру <b>${barberName}</b>\n` +
    `📅 ${formatDate(date)}, ${formatTime(time)}\n\n` +
    `Ждём вас! 💈`,
    { parse_mode: 'HTML' }
  )
}

export async function notifyBarberNewBooking({ telegram_id, clientName, date, time, services }) {
  const serviceList = services.map(s => `• ${s.name}`).join('\n')
  await bot.api.sendMessage(
    telegram_id,
    `📣 <b>Новая запись!</b>\n\n` +
    `👤 Клиент: <b>${clientName}</b>\n` +
    `📅 ${formatDate(date)}, ${formatTime(time)}\n\n` +
    `<b>Услуги:</b>\n${serviceList}`,
    { parse_mode: 'HTML' }
  )
}

export async function notifyCancellation({ telegram_id, barberName, date, time, isBarber = false }) {
  const message = isBarber
    ? `❌ <b>Запись отменена</b>\n\n📅 ${formatDate(date)}, ${formatTime(time)}\nКлиент отменил запись.`
    : `❌ <b>Ваша запись отменена</b>\n\nМастер: <b>${barberName}</b>\n📅 ${formatDate(date)}, ${formatTime(time)}`
  await bot.api.sendMessage(telegram_id, message, { parse_mode: 'HTML' })
}

export async function notifyCompletion({ telegram_id, bonus_earned }) {
  await bot.api.sendMessage(
    telegram_id,
    `🙏 <b>Спасибо за визит!</b>\n\n` +
    `Надеемся, вам понравилось!\n\n` +
    `✦ Начислено <b>${bonus_earned} бонусов</b> на ваш счёт.\n\n` +
    `Ждём вас снова! 💈`,
    { parse_mode: 'HTML' }
  )
}

// ─── HTTP SERVER (webhook) ────────────────────────────────────────────────────

import { createServer } from 'http'

const handleUpdate = webhookCallback(bot, 'http')

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    try {
      await handleUpdate(req, res)
    } catch (err) {
      console.error('Webhook error:', err)
      res.writeHead(500)
      res.end()
    }
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(PORT, async () => {
  console.log(`Bot server running on port ${PORT}`)

  // Register webhook with Telegram
  if (WEBHOOK_URL) {
    try {
      await bot.api.setWebhook(`${WEBHOOK_URL}/webhook`)
      console.log(`Webhook registered: ${WEBHOOK_URL}/webhook`)
    } catch (err) {
      console.error('Failed to set webhook:', err.message)
    }
  } else {
    console.log('No WEBHOOK_URL set, skipping webhook registration')
  }
})

server.on('error', (err) => {
  console.error('Server error:', err)
  process.exit(1)
})
