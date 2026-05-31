import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BONUS_PER_VISIT = 100
const MAX_BONUS_PERCENT = 0.20

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Verify caller has service role authorization
    const authHeader = req.headers.get('Authorization')
    const apiKey = req.headers.get('apikey')
    const callerKey = authHeader?.replace('Bearer ', '') || apiKey

    if (!callerKey || callerKey !== serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await req.json()
    const { appointment_id, action } = body

    if (!appointment_id || !action) {
      return new Response(
        JSON.stringify({ error: 'appointment_id and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointment_id)
      .single()

    if (apptError || !appointment) {
      return new Response(
        JSON.stringify({ error: 'Appointment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'complete') {
      if (appointment.status !== 'confirmed') {
        return new Response(
          JSON.stringify({ error: `Cannot complete appointment with status: ${appointment.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appointment_id)

      if (updateError) throw updateError

      // Atomic increment using RPC
      await supabase.rpc('increment_client_bonus', {
        p_client_id: appointment.client_id,
        p_points: BONUS_PER_VISIT
      })

      await supabase.rpc('increment_client_visits', {
        p_client_id: appointment.client_id
      })

      await supabase.from('bonus_history').insert({
        client_id: appointment.client_id,
        appointment_id: appointment_id,
        points_change: BONUS_PER_VISIT,
        reason: 'Начислено за посещение'
      })

      return new Response(
        JSON.stringify({ success: true, bonus_earned: BONUS_PER_VISIT }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'confirm') {
      if (appointment.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: `Cannot confirm appointment with status: ${appointment.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await supabase.from('appointments').update({ status: 'confirmed' }).eq('id', appointment_id)
      await supabase.from('time_slots').update({ is_booked: true }).eq('id', appointment.slot_id)

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'cancel') {
      if (['completed', 'cancelled'].includes(appointment.status)) {
        return new Response(
          JSON.stringify({ error: `Cannot cancel appointment with status: ${appointment.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appointment_id)
      await supabase.from('time_slots').update({ is_booked: false }).eq('id', appointment.slot_id)

      if (appointment.bonus_used > 0) {
        await supabase.rpc('increment_client_bonus', {
          p_client_id: appointment.client_id,
          p_points: appointment.bonus_used
        })

        await supabase.from('bonus_history').insert({
          client_id: appointment.client_id,
          appointment_id: appointment_id,
          points_change: appointment.bonus_used,
          reason: 'Возврат бонусов при отмене записи'
        })
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action. Valid: confirm, complete, cancel' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
