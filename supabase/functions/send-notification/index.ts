import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { telegram_id, message, parse_mode = 'HTML' } = await req.json()

    const validParseModes = ['HTML', 'Markdown', 'MarkdownV2']
    const safeParseMmode = validParseModes.includes(parse_mode) ? parse_mode : 'HTML'

    const botToken = Deno.env.get('BOT_TOKEN')
    if (!botToken) {
      throw new Error('BOT_TOKEN not configured')
    }

    if (!telegram_id || !message) {
      return new Response(
        JSON.stringify({ error: 'telegram_id and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegram_id,
          text: message,
          parse_mode: safeParseMmode,
        }),
      }
    )

    const result = await response.json()

    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description}`)
    }

    return new Response(
      JSON.stringify({ success: true, message_id: result.result?.message_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
