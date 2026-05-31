import { useOutlet, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { tg } from '../../lib/telegram'

const NAV_ITEMS = [
  { to: '/', label: 'Главная', icon: '✂️' },
  { to: '/profile', label: 'Профиль', icon: '👤' },
]

export function AppLayout() {
  const location = useLocation()
  const currentOutlet = useOutlet()

  useEffect(() => {
    tg.ready()
    tg.expand()
  }, [])

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          className="flex-1 overflow-y-auto pb-20"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {currentOutlet}
        </motion.div>
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-white/5 safe-area-bottom">
        <div className="flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-3 min-h-[48px] transition-colors ${
                  isActive ? 'text-gold' : 'text-white/40'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-body">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
