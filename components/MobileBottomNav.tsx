'use client'

import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  DollarSign, 
  FileText, 
  BookOpen, 
  Users,
  Store
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { hasPermission, type UserRole } from '@/lib/supabase'

interface NavItem {
  href: string
  label: string
  icon: any
  permission: string
  managerOnly?: boolean
}

export default function MobileBottomNav({ userRole }: { userRole: UserRole }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Load dark mode preference
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('dark_mode')
    if (savedDarkMode) {
      setIsDarkMode(savedDarkMode === 'true')
    }

    // Listen for dark mode changes
    const handleDarkModeChange = (e: any) => {
      setIsDarkMode(e.detail.isDarkMode)
    }
    window.addEventListener('darkModeChange', handleDarkModeChange)
    return () => window.removeEventListener('darkModeChange', handleDarkModeChange)
  }, [])

  const navItems: NavItem[] = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, permission: 'view_dashboard' },
    { href: '/dashboard/pos', label: 'POS', icon: ShoppingCart, permission: 'process_sale' },
    { href: '/dashboard/inventory', label: 'Products', icon: Package, permission: 'create_product' },
    { href: '/dashboard/sales', label: 'Sales', icon: DollarSign, permission: 'view_sales' },
    { href: '/dashboard/expenses', label: 'Expenses', icon: FileText, permission: 'add_expense' },
    { href: '/dashboard/khaata', label: 'Ledger', icon: BookOpen, permission: 'create_user' },
    { href: '/dashboard/cashiers', label: 'Staff', icon: Users, permission: 'create_user', managerOnly: true },
    { href: '/dashboard/store', label: 'Settings', icon: Store, permission: 'create_user' },
  ]

  const filteredNavItems = navItems.filter(item => {
    if (!hasPermission(userRole, item.permission)) return false
    if (item.managerOnly && userRole !== 'Manager') return false
    return true
  })

  return (
    <nav 
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t ${
        isDarkMode 
          ? 'bg-gray-900 border-gray-800' 
          : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-center justify-around px-2 py-2 overflow-x-auto">
        {filteredNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded min-w-[60px] transition-colors ${
                isActive 
                  ? (isDarkMode 
                      ? 'text-cyan-400 bg-cyan-900/30' 
                      : 'text-cyan-600 bg-cyan-50')
                  : (isDarkMode 
                      ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50')
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium truncate max-w-full">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
