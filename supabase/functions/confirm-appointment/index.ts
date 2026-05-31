import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { appointment_id, action } = await req.json()

    if (!appointment_id || !action) {
      return new Response(
        JSON.stringify({ error: 'appointment_id and action are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get appointment
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
      // Mark slot as booked (keep booked after completion for history)
      // Update appointment status
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appointment_id)

      if (updateError) throw updateError

      // Award bonus points
      const bonusToAward = BONUS_PER_VISIT

      // Use raw update instead of RPC for simplicity
      const { data: client } = await supabase
        .from('clients')
        .select('bonus_points, total_visits')
        .eq('id', appointment.client_id)
        .single()

      await supabase
        .from('clients')
        .update({
          bonus_points: (client?.bonus_points || 0) + bonusToAward,
          total_visits: (client?.total_visits || 0) + 1
        })
        .eq('id', appointment.client_id)

      // Record bonus history
      await supabase
        .from('bonus_history')
        .insert({
          client_id: appointment.client_id,
          appointment_id: appointment_id,
          points_change: bonusToAward,
          reason: 'Начислено за посещение'
        })

      return new Response(
        JSON.stringify({ success: true, bonus_earned: bonusToAward }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'confirm') {
      await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', appointment_id)

      // Mark slot as booked
      await supabase
        .from('time_slots')
        .update({ is_booked: true })
        .eq('id', appointment.slot_id)

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'cancel') {
      await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointment_id)

      // Free the slot
      await supabase
        .from('time_slots')
        .update({ is_booked: false })
        .eq('id', appointment.slot_id)

      // Refund bonus points if they were used
      if (appointment.bonus_used > 0) {
        const { data: client } = await supabase
          .from('clients')
          .select('bonus_points')
          .eq('id', appointment.client_id)
          .single()

        await supabase
          .from('clients')
          .update({ bonus_points: (client?.bonus_points || 0) + appointment.bonus_used })
          .eq('id', appointment.client_id)

        await supabase
          .from('bonus_history')
          .insert({
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
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
