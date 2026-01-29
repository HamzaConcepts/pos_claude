'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Receipt, 
  Wallet, 
  BarChart3, 
  Users,
  LogOut,
  Menu,
  X,
  BookUser,
  Truck,
  User,
  ChevronDown,
  Moon,
  Sun,
  Settings,
  UserCog,
  Home,
  ShoppingBag,
  Package2,
  FileText,
  DollarSign,
  TrendingUp,
  BookOpen,
  PackageCheck
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase, hasPermission, type UserRole, getStoreId } from '@/lib/supabase'

interface SidebarProps {
  userRole: UserRole
  userName: string
}

interface Cashier {
  id: number
  full_name: string
  phone_number: string
  commission_rate: number
}

export default function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [cashiers, setCashiers] = useState<Cashier[]>([])
  const [selectedCashier, setSelectedCashier] = useState<Cashier | null>(null)
  const [showCashierDropdown, setShowCashierDropdown] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [storeName, setStoreName] = useState('POS System')

  // Notify layout when sidebar is toggled
  const toggleSidebar = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sidebar_collapsed', newState.toString())
    // Update CSS variable for smooth transition
    document.documentElement.style.setProperty('--sidebar-width', newState ? '4rem' : '13rem')
  }

  // Load collapsed state from localStorage
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebar_collapsed')
    if (savedCollapsed) {
      const collapsed = savedCollapsed === 'true'
      setIsCollapsed(collapsed)
      document.documentElement.style.setProperty('--sidebar-width', collapsed ? '4rem' : '13rem')
    } else {
      document.documentElement.style.setProperty('--sidebar-width', '13rem')
    }
  }, [])

  // Load dark mode preference from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('dark_mode')
    if (savedDarkMode) {
      setIsDarkMode(savedDarkMode === 'true')
    }
  }, [])

  // Load selected cashier from localStorage on mount
  useEffect(() => {
    const savedCashier = localStorage.getItem('selected_cashier')
    if (savedCashier) {
      setSelectedCashier(JSON.parse(savedCashier))
    }
    fetchCashiers()
    fetchStoreName()
  }, [])

  const fetchStoreName = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const { data, error } = await supabase
        .from('stores')
        .select('store_name')
        .eq('id', storeId)
        .single()

      if (data && !error) {
        setStoreName(data.store_name)
      }
    } catch (err) {
      console.error('Error fetching store name:', err)
    }
  }

  const fetchCashiers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/cashiers?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setCashiers(result.data || [])
      }
    } catch (err) {
      console.error('Error fetching cashiers:', err)
    }
  }

  const handleCashierSelect = (cashier: Cashier) => {
    setSelectedCashier(cashier)
    localStorage.setItem('selected_cashier', JSON.stringify(cashier))
    setShowCashierDropdown(false)
    
    // Dispatch custom event to notify POS page and other components
    console.log('[Sidebar] Cashier selected, dispatching event:', cashier)
    window.dispatchEvent(new CustomEvent('cashierChanged', { detail: { cashier } }))
  }

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)
    localStorage.setItem('dark_mode', newDarkMode.toString())
    // Dispatch custom event to notify dashboard page
    window.dispatchEvent(new CustomEvent('darkModeChange', { detail: { isDarkMode: newDarkMode } }))
  }

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: Home, permission: 'view_dashboard' },
    { href: '/dashboard/pos', label: 'New Sale', icon: ShoppingBag, permission: 'process_sale' },
    { href: '/dashboard/inventory', label: 'Products', icon: Package2, permission: 'create_product' },
    { href: '/dashboard/sales', label: 'Sales History', icon: FileText, permission: 'view_sales' },
    { href: '/dashboard/expenses', label: 'Expense Tracker', icon: DollarSign, permission: 'add_expense' },
    { href: '/dashboard/reports', label: 'Reports', icon: TrendingUp, permission: 'view_dashboard' },
    { href: '/dashboard/customer-ledger', label: 'Customer Ledger', icon: BookOpen, permission: 'create_user' },
    { href: '/dashboard/supplier-ledger', label: 'Supplier Ledger', icon: PackageCheck, permission: 'create_user' },
    { href: '/dashboard/cashiers', label: 'Staff Performance', icon: UserCog, permission: 'create_user', managerOnly: true },
    { href: '/dashboard/store', label: 'Settings', icon: Settings, permission: 'create_user' },
  ]

  const handleLogout = async () => {
    // Clear all session data
    localStorage.removeItem('user_session')
    sessionStorage.removeItem('store_id')
    sessionStorage.removeItem('user_type')
    sessionStorage.removeItem('user_id')
    
    // Logout from Supabase Auth (for managers)
    await supabase.auth.signOut()
    
    router.push('/login')
  }

  const filteredNavItems = navItems.filter(item => {
    // Check if user has permission
    if (!hasPermission(userRole, item.permission)) return false
    
    // If item is managerOnly, only show for Manager role
    if (item.managerOnly && userRole !== 'Manager') return false
    
    return true
  })

  return (
    <>

      {/* Sidebar */}
      <aside
        className={`
          hidden lg:flex
          fixed inset-y-0 left-0 z-40
          flex-col transition-all duration-300
          ${isCollapsed ? 'w-16' : 'w-52'}
          ${isDarkMode ? 'bg-[#1a1a1a] border-r border-gray-700' : 'bg-white border-r border-gray-200'}
        `}
      >
        {/* Logo */}
        <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          {!isCollapsed && (
            <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{storeName}</h1>
          )}
          <button
            onClick={toggleSidebar}
            className={`p-1.5 rounded transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu size={18} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto">
          {/* Cashier Selector - Only show for cashier accounts */}
          {userRole === 'Cashier' && cashiers.length > 0 && (
            <div className="mb-3">
              <label className={`text-xs mb-1.5 block ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Active Cashier</label>
              <div className="relative">
                <button
                  onClick={() => setShowCashierDropdown(!showCashierDropdown)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 border rounded text-sm transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-800 hover:bg-gray-700 border-gray-700' 
                      : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <User size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
                    <span className={`truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {selectedCashier ? selectedCashier.full_name : 'Select Cashier'}
                    </span>
                  </div>
                  <ChevronDown size={14} className={`transition-transform ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} ${showCashierDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showCashierDropdown && (
                  <div className={`absolute top-full left-0 right-0 mt-1 border rounded z-50 max-h-64 overflow-y-auto ${
                    isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}>
                    <div
                      onClick={() => {
                        setSelectedCashier(null)
                        localStorage.removeItem('selected_cashier')
                        setShowCashierDropdown(false)
                      }}
                      className={`px-3 py-2 cursor-pointer text-sm border-b ${
                        isDarkMode 
                          ? 'hover:bg-gray-700 text-gray-400 border-gray-700' 
                          : 'hover:bg-gray-50 text-gray-500 border-gray-100'
                      }`}
                    >
                      No Cashier Selected
                    </div>
                    {cashiers.map((cashier) => (
                      <div
                        key={cashier.id}
                        onClick={() => handleCashierSelect(cashier)}
                        className={`px-3 py-2 cursor-pointer transition-colors ${
                          selectedCashier?.id === cashier.id 
                            ? (isDarkMode ? 'bg-gray-700' : 'bg-gray-50')
                            : (isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50')
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <User size={14} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{cashier.full_name}</p>
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{cashier.phone_number}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <ul className="space-y-1.5">
            {filteredNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`
                      flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors relative group
                      ${isActive 
                        ? (isDarkMode 
                            ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-700' 
                            : 'bg-cyan-50 text-cyan-700 border border-cyan-200')
                        : (isDarkMode 
                            ? 'text-gray-300 hover:bg-[#2a2a2a] hover:text-white' 
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')
                      }
                      ${isCollapsed ? 'justify-center' : ''}
                    `}
                    title={isCollapsed ? item.label : ''}
                  >
                    <Icon 
                      size={18} 
                      fill={isActive ? 'currentColor' : 'none'}
                      className={isActive 
                        ? (isDarkMode ? 'text-cyan-400' : 'text-cyan-600')
                        : (isDarkMode ? 'text-gray-400 group-hover:text-white' : 'text-gray-500')
                      } 
                    />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className={`p-3 border-t ${isDarkMode ? 'border-gray-700 bg-[#151515]' : 'border-gray-200 bg-gray-50'}`}>
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className={`flex items-center gap-2 w-full px-3 py-2 mb-2 border rounded transition-colors text-sm font-medium ${isCollapsed ? 'justify-center' : ''} ${
              isDarkMode 
                ? 'bg-[#0f0f0f] hover:bg-[#2a2a2a] border-gray-600 text-gray-200' 
                : 'bg-white hover:bg-gray-100 border-gray-200 text-gray-700'
            }`}
            title={isCollapsed ? (isDarkMode ? 'Light Mode' : 'Dark Mode') : ''}
          >
            {isDarkMode ? <Sun size={16} className="text-yellow-500" /> : <Moon size={16} className="text-blue-500" />}
            {!isCollapsed && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          {!isCollapsed && (
            <div className="mb-2">
              <p className={`font-medium text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{userName}</p>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{userRole}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 w-full px-3 py-2 border rounded transition-colors text-sm font-medium ${isCollapsed ? 'justify-center' : ''} ${
              isDarkMode 
                ? 'bg-[#0f0f0f] hover:bg-red-900/20 border-gray-600 hover:border-red-800 text-gray-200 hover:text-red-400' 
                : 'bg-white hover:bg-red-50 border-gray-200 hover:border-red-200 text-gray-700 hover:text-red-600'
            }`}
            title={isCollapsed ? 'Logout' : ''}
          >
            <LogOut size={16} />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
