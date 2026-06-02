import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Barber } from '../types'

function useBarbers() {
  return useQuery({
    queryKey: ['admin-barbers'],
    queryFn: async (): Promise<Barber[]> => {
      const { data } = await supabase.from('barbers').select('*').order('name')
      return data ?? []
    },
  })
}

async function createBarberAccount(barberId: string, email: string, password: string): Promise<string> {
  // Call Edge Function — service key stays server-side only
  const session = (await supabase.auth.getSession()).data.session
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-barber-account`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ barber_id: barberId, email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Ошибка создания аккаунта')
  return data.auth_user_id as string
}

function BarberForm({ barber, onClose }: { barber?: Barber; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(barber?.name ?? '')
  const [bio, setBio] = useState(barber?.bio ?? '')
  const [telegramId, setTelegramId] = useState(String(barber?.telegram_id ?? ''))
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [createAccount, setCreateAccount] = useState(!barber)
  const [barberEmail, setBarberEmail] = useState('')
  const [barberPassword, setBarberPassword] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      let photoUrl = barber?.photo_url ?? null

      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const path = `avatars/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, photoFile, { upsert: true })
        if (uploadError) {
          setIsSubmitting(false)
          alert(`Ошибка загрузки фото: ${uploadError.message}`)
          return
        }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        photoUrl = urlData.publicUrl
      }

      const payload: Record<string, unknown> = {
        name,
        bio: bio || null,
        telegram_id: telegramId ? parseInt(telegramId, 10) : null,
        photo_url: photoUrl,
      }

      let savedBarberId = barber?.id

      if (barber?.id) {
        await supabase.from('barbers').update(payload).eq('id', barber.id)
      } else {
        const { data } = await supabase.from('barbers').insert(payload).select('id').single()
        savedBarberId = data?.id
      }

      // Create auth account if requested
      if (createAccount && barberEmail && barberPassword && savedBarberId) {
        try {
          const authUserId = await createBarberAccount(savedBarberId, barberEmail, barberPassword)
          await supabase.from('barbers').update({ auth_user_id: authUserId }).eq('id', savedBarberId)
        } catch (err) {
          alert(`Барбер сохранён, но аккаунт не создан: ${err instanceof Error ? err.message : 'Ошибка'}`)
        }
      }

      queryClient.invalidateQueries({ queryKey: ['admin-barbers'] })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {barber ? 'Редактировать мастера' : 'Новый мастер'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Имя *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Описание</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Telegram ID</label>
            <input
              type="number"
              value={telegramId}
              onChange={e => setTelegramId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Фото</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setPhotoFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100"
            />
          </div>
        </div>

        {/* Account creation section */}
        <div className="border-t border-gray-100 pt-4 mt-4">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <div
              className={`w-10 h-6 rounded-full transition-colors ${createAccount ? 'bg-black' : 'bg-gray-200'}`}
              onClick={() => setCreateAccount(!createAccount)}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform m-0.5 ${createAccount ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm font-medium text-gray-700">Создать аккаунт для входа в панель</span>
          </label>

          {createAccount && (
            <div className="space-y-3 mt-2">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Email для входа</label>
                <input
                  type="email"
                  value={barberEmail}
                  onChange={e => setBarberEmail(e.target.value)}
                  placeholder="barber@example.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Пароль</label>
                <input
                  type="password"
                  value={barberPassword}
                  onChange={e => setBarberPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              {barber?.auth_user_id && (
                <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                  ✓ Аккаунт уже создан. Новый email/пароль перезапишут существующий.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name}
            className="flex-1 py-2.5 bg-black text-white rounded-xl text-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function BarbersPage() {
  const queryClient = useQueryClient()
  const { data: barbers = [], isLoading } = useBarbers()
  const [editBarber, setEditBarber] = useState<Barber | 'new' | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await supabase.from('barbers').update({ is_active }).eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-barbers'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (barberId: string) => {
      // Check if barber has active appointments
      const { data: appts } = await supabase
        .from('appointments')
        .select('id')
        .eq('barber_id', barberId)
        .in('status', ['pending', 'confirmed'])
        .limit(1)

      if (appts && appts.length > 0) {
        throw new Error('Нельзя удалить мастера с активными записями. Сначала отмените или завершите записи.')
      }

      const { error } = await supabase.from('barbers').delete().eq('id', barberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-barbers'] })
      setDeleteConfirmId(null)
    },
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Сотрудники</h1>
        <button
          onClick={() => setEditBarber('new')}
          className="px-4 py-2 bg-black text-white rounded-xl text-sm font-medium"
        >
          + Добавить
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {barbers.map(barber => (
            <div key={barber.id} className={`bg-white border rounded-2xl p-5 ${!barber.is_active ? 'opacity-50' : 'border-gray-100'}`}>
              <div className="flex items-start gap-3 mb-3">
                {barber.photo_url ? (
                  <img src={barber.photo_url} alt={barber.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl">✂️</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{barber.name}</p>
                  {barber.bio && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{barber.bio}</p>}
                  {barber.telegram_id && <p className="text-xs text-gray-300 mt-1">TG: {barber.telegram_id}</p>}
                  {barber.auth_user_id && (
                    <p className="text-xs text-blue-400 mt-1">Аккаунт создан</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setEditBarber(barber)}
                  className="flex-1 py-2 text-xs border border-gray-200 text-gray-600 rounded-xl min-h-[36px]"
                >
                  Редактировать
                </button>
                <button
                  onClick={() => toggleActive.mutate({ id: barber.id, is_active: !barber.is_active })}
                  className={`flex-1 py-2 text-xs rounded-xl min-h-[36px] ${barber.is_active ? 'border border-red-200 text-red-500' : 'border border-green-200 text-green-600'}`}
                >
                  {barber.is_active ? 'Деактивировать' : 'Активировать'}
                </button>
                <button
                  onClick={() => setDeleteConfirmId(barber.id)}
                  className="py-2 px-3 text-xs text-gray-400 hover:text-red-500 border border-gray-100 rounded-xl min-h-[36px]"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteConfirmId && (() => {
        const barber = barbers.find(b => b.id === deleteConfirmId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setDeleteConfirmId(null)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Удалить мастера?</h3>
              <p className="text-gray-500 text-sm mb-1">
                <span className="font-medium">{barber?.name}</span>
              </p>
              <p className="text-gray-400 text-sm mb-5">
                Удалятся все расписания и слоты. Записи с активным статусом удалить нельзя.
              </p>
              {deleteMutation.isError && (
                <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl mb-4">
                  {(deleteMutation.error as Error).message}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm"
                >
                  Отмена
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirmId)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {editBarber !== null && (
        <BarberForm
          barber={editBarber === 'new' ? undefined : editBarber}
          onClose={() => setEditBarber(null)}
        />
      )}
    </div>
  )
}
