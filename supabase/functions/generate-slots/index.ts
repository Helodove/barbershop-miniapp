import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { barber_id, date } = await req.json()

    if (!barber_id || !date) {
      return new Response(
        JSON.stringify({ error: 'barber_id and date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get barber schedule for the date
    const { data: schedule, error: scheduleError } = await supabase
      .from('barber_schedules')
      .select('*')
      .eq('barber_id', barber_id)
      .eq('date', date)
      .single()

    if (scheduleError || !schedule) {
      return new Response(
        JSON.stringify({ error: 'No schedule found for this date' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (schedule.is_day_off) {
      return new Response(
        JSON.stringify({ slots: [], message: 'Day off' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Delete existing unbooked slots for this barber+date
    await supabase
      .from('time_slots')
      .delete()
      .eq('barber_id', barber_id)
      .eq('date', date)
      .eq('is_booked', false)

    // Generate 30-minute slots
    const slots = []
    const [startHour, startMin] = schedule.start_time.split(':').map(Number)
    const [endHour, endMin] = schedule.end_time.split(':').map(Number)

    let currentHour = startHour
    let currentMin = startMin

    while (
      currentHour < endHour ||
      (currentHour === endHour && currentMin + 30 <= endMin)
    ) {
      const nextMin = currentMin + 30
      const nextHour = currentHour + Math.floor(nextMin / 60)
      const normalizedNextMin = nextMin % 60

      const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`
      const endTime = `${String(nextHour).padStart(2, '0')}:${String(normalizedNextMin).padStart(2, '0')}`

      slots.push({
        barber_id,
        date,
        start_time: startTime,
        end_time: endTime,
        is_booked: false,
        is_blocked: false,
      })

      currentHour = nextHour
      currentMin = normalizedNextMin
    }

    if (slots.length === 0) {
      return new Response(
        JSON.stringify({ slots: [], message: 'No slots generated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: insertedSlots, error: insertError } = await supabase
      .from('time_slots')
      .insert(slots)
      .select()

    if (insertError) {
      throw insertError
    }

    return new Response(
      JSON.stringify({ slots: insertedSlots, count: insertedSlots?.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
