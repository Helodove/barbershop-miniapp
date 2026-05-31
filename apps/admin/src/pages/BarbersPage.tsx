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

function BarberForm({ barber, onClose }: { barber?: Barber; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(barber?.name ?? '')
  const [bio, setBio] = useState(barber?.bio ?? '')
  const [telegramId, setTelegramId] = useState(String(barber?.telegram_id ?? ''))
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
          photoUrl = urlData.publicUrl
        }
      }

      const payload = {
        name,
        bio: bio || null,
        telegram_id: telegramId ? parseInt(telegramId, 10) : null,
        photo_url: photoUrl,
      }

      if (barber?.id) {
        await supabase.from('barbers').update(payload).eq('id', barber.id)
      } else {
        await supabase.from('barbers').insert(payload)
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
        className="bg-white rounded-2xl w-full max-w-md p-6"
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

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await supabase.from('barbers').update({ is_active }).eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-barbers'] }),
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
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditBarber(barber)}
                  className="flex-1 py-2 text-xs border border-gray-200 text-gray-600 rounded-xl"
                >
                  Редактировать
                </button>
                <button
                  onClick={() => toggleActive.mutate({ id: barber.id, is_active: !barber.is_active })}
                  className={`flex-1 py-2 text-xs rounded-xl ${barber.is_active ? 'border border-red-200 text-red-500' : 'border border-green-200 text-green-600'}`}
                >
                  {barber.is_active ? 'Деактивировать' : 'Активировать'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editBarber !== null && (
        <BarberForm
          barber={editBarber === 'new' ? undefined : editBarber}
          onClose={() => setEditBarber(null)}
        />
      )}
    </div>
  )
}
