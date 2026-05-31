import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

interface NavItem {
  to: string
  label: string
  icon: string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Дашборд', icon: '📊', adminOnly: true },
  { to: '/appointments', label: 'Записи', icon: '📅' },
  { to: '/schedule', label: 'Расписание', icon: '🗓️' },
  { to: '/clients', label: 'Клиенты', icon: '👥', adminOnly: true },
  { to: '/barbers', label: 'Сотрудники', icon: '✂️', adminOnly: true },
  { to: '/services', label: 'Услуги', icon: '💈', adminOnly: true },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { role, user, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = role === 'admin'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin)

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-100 w-64">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
            <span className="text-gold text-sm">✂</span>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-none">Барбершоп</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isAdmin ? 'Администратор' : 'Мастер'}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                isActive
                  ? 'bg-black text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User + Sign out */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
            {user?.email?.[0].toUpperCase()}
          </div>
          <p className="text-xs text-gray-500 truncate flex-1">{user?.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full text-left text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
        >
          Выйти
        </button>
      </div>
    </div>
  )
}
