'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  HouseIcon,
  StorefrontIcon,
  UsersIcon,
  UserListIcon,
  SignOutIcon,
  ListIcon,
  ShieldCheckIcon,
  ClockCountdownIcon,
} from '@phosphor-icons/react'
import { useState, useEffect } from 'react'

export default function SuperAdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const saved = localStorage.getItem('sa_sidebar_collapsed')
    if (saved) {
      const collapsed = saved === 'true'
      setIsCollapsed(collapsed)
      document.documentElement.style.setProperty('--sa-sidebar-width', collapsed ? '4rem' : '13rem')
    } else {
      document.documentElement.style.setProperty('--sa-sidebar-width', '13rem')
    }

    // Fetch pending signups count for badge
    fetch('/api/super-admin/stats', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((data) => setPendingCount(data.pendingSignups || 0))
      .catch(() => {})
  }, [])

  const toggleSidebar = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sa_sidebar_collapsed', newState.toString())
    document.documentElement.style.setProperty('--sa-sidebar-width', newState ? '4rem' : '13rem')
  }

  const handleLogout = async () => {
    await fetch('/api/super-admin/logout', {
      method: 'POST',
      credentials: 'include',
    })
    router.push('/super-admin/login')
  }

  const navItems = [
    { href: '/super-admin', label: 'Dashboard', icon: HouseIcon, badge: 0 },
    { href: '/super-admin/approvals', label: 'Approvals', icon: ClockCountdownIcon, badge: pendingCount },
    { href: '/super-admin/stores', label: 'Stores', icon: StorefrontIcon, badge: 0 },
    { href: '/super-admin/managers', label: 'Managers', icon: UsersIcon, badge: 0 },
    { href: '/super-admin/cashiers', label: 'Cashiers', icon: UserListIcon, badge: 0 },
  ]

  return (
    <aside
      className={`
        hidden lg:flex
        fixed inset-y-0 left-0 z-40
        flex-col transition-all duration-300
        ${isCollapsed ? 'w-16' : 'w-52'}
        bg-white border-r border-gray-200 dark:bg-[#1a1a1a] dark:border-gray-700
      `}
    >
      {/* Header */}
      <div className={`p-4 border-b border-gray-200 dark:border-gray-700 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <ShieldCheckIcon size={20} className="text-gray-900 dark:text-white" weight="bold" />
            <h1 className="text-sm font-bold text-gray-900 dark:text-white">Super Admin</h1>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded transition-colors flex-shrink-0 hover:bg-gray-100 dark:hover:bg-gray-700"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ListIcon size={20} className="flex-shrink-0 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/super-admin' && pathname.startsWith(item.href))
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className="relative flex-shrink-0">
                    <Icon size={20} />
                    {item.badge > 0 && (
                      <span className={`absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 text-[10px] font-bold leading-4 text-center rounded-full ${
                        isActive ? 'bg-white text-gray-900 dark:bg-gray-900 dark:text-white' : 'bg-red-500 text-white'
                      }`}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <span className="flex-1">{item.label}</span>
                  )}
                  {!isCollapsed && item.badge > 0 && (
                    <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white dark:bg-gray-900/20 dark:text-gray-900' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full transition-colors text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Logout' : undefined}
        >
          <SignOutIcon size={20} className="flex-shrink-0" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
