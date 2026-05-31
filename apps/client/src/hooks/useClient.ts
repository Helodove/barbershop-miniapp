import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getTelegramUser } from '../lib/telegram'
import type { Client } from '../types'

export function useClient() {
  const tgUser = getTelegramUser()

  return useQuery({
    queryKey: ['client', tgUser?.id],
    queryFn: async (): Promise<Client | null> => {
      if (!tgUser?.id) return null

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('telegram_id', tgUser.id)
        .single()

      if (error && error.code === 'PGRST116') return null
      if (error) throw error
      return data
    },
    enabled: !!tgUser?.id,
  })
}

export function useRegisterClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<Client> => {
      const tgUser = getTelegramUser()
      if (!tgUser) throw new Error('Telegram не инициализирован. Откройте приложение через Telegram.')

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

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      const tgUser = getTelegramUser()
      queryClient.setQueryData(['client', tgUser?.id], data)
    },
  })
}
