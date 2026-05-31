import WebApp from '@twa-dev/sdk'

export const tg = WebApp

export function getTelegramUser() {
  return WebApp.initDataUnsafe?.user
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
  WebApp.HapticFeedback.impactOccurred(style)
}

export function hapticNotification(type: 'error' | 'success' | 'warning') {
  WebApp.HapticFeedback.notificationOccurred(type)
}

export function hapticSelection() {
  WebApp.HapticFeedback.selectionChanged()
}
