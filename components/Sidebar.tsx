'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  HouseIcon,
  ShoppingBagIcon,
  PackageIcon,
  FileTextIcon,
  CurrencyDollarIcon,
  TrendUpIcon,
  BookOpenIcon,
  TruckIcon,
  UserGearIcon,
  GearIcon,
  XIcon,
  UserIcon,
  CaretDownIcon,
  MoonIcon,
  SunIcon,
  SignOutIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  ClipboardTextIcon,
  LifebuoyIcon,
  ArrowsLeftRightIcon
} from '@phosphor-icons/react'
import { useState, useEffect } from 'react'
import { supabase, hasPermission, type UserRole, getStoreId } from '@/lib/supabase'
import Logo from '@/components/Logo'

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
  const [storeName, setStoreName] = useState('Atom')

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
      const darkModeOn = savedDarkMode === 'true'
      setIsDarkMode(darkModeOn)
      document.documentElement.classList.toggle('dark', darkModeOn)
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
    window.dispatchEvent(new CustomEvent('cashierChanged', { detail: { cashier } }))
  }

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)
    localStorage.setItem('dark_mode', newDarkMode.toString())
    document.documentElement.classList.toggle('dark', newDarkMode)
    // Dispatch custom event to notify dashboard page
    window.dispatchEvent(new CustomEvent('darkModeChange', { detail: { isDarkMode: newDarkMode } }))
  }

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: HouseIcon, permission: 'view_dashboard' },
    { href: '/dashboard/pos', label: 'New Sale', icon: ShoppingBagIcon, permission: 'process_sale' },
    { href: '/dashboard/inventory', label: 'New Purchases', icon: PackageIcon, permission: 'create_product' },
    { href: '/dashboard/inventory-purchases', label: 'Purchase History', icon: ShoppingCartIcon, permission: 'create_product' },
    { href: '/dashboard/sales', label: 'Sales History', icon: FileTextIcon, permission: 'view_sales' },
    { href: '/dashboard/quotations', label: 'Quotations', icon: ClipboardTextIcon, permission: 'process_sale' },
    { href: '/dashboard/expenses', label: 'Expense Tracker', icon: CurrencyDollarIcon, permission: 'add_expense' },
    { href: '/dashboard/returns', label: 'Returns', icon: PackageIcon, permission: 'process_sale' },
    { href: '/dashboard/reports', label: 'Reports', icon: TrendUpIcon, permission: 'view_dashboard' },
    { href: '/dashboard/customer-ledger', label: 'Customer Ledger', icon: BookOpenIcon, permission: 'create_user' },
    { href: '/dashboard/supplier-ledger', label: 'Supplier Ledger', icon: TruckIcon, permission: 'create_user' },
    { href: '/dashboard/cash-transfers', label: 'Cash Transfers', icon: ArrowsLeftRightIcon, permission: 'create_user', managerOnly: true },
    { href: '/dashboard/cashiers', label: 'Staff Performance', icon: UserGearIcon, permission: 'create_user', managerOnly: true },
    { href: '/dashboard/receipt-settings', label: 'Receipt Settings', icon: ReceiptIcon, permission: 'create_user', managerOnly: true },
    { href: '/dashboard/support', label: 'Support', icon: LifebuoyIcon, permission: 'process_sale' },
    { href: '/dashboard/store', label: 'Settings', icon: GearIcon, permission: 'create_user' },
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
          bg-white border-r border-gray-200 dark:bg-[#1a1a1a] dark:border-gray-700
        `}
      >
        {/* Logo */}
        <div className={`p-4 border-b border-gray-200 dark:border-gray-700 flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
          <button
            onClick={toggleSidebar}
            className={`flex items-center gap-2 min-w-0 ${isCollapsed ? '' : 'flex-1'} hover:opacity-80 transition-opacity`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Logo size={24} className="text-gray-900 dark:text-white flex-shrink-0" />
            {!isCollapsed && (
              <span className="text-sm font-bold truncate text-gray-900 dark:text-white">{storeName}</span>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto">
          {/* Cashier Selector - Only show for cashier accounts */}
          {userRole === 'Cashier' && cashiers.length > 0 && (
            <div className="mb-3">
              <label className="text-xs mb-1.5 block text-gray-500 dark:text-gray-400">Active Cashier</label>
              <div className="relative">
                <button
                  onClick={() => setShowCashierDropdown(!showCashierDropdown)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 border rounded text-sm transition-colors bg-gray-50 hover:bg-gray-100 border-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:border-gray-700"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <UserIcon size={14} className="text-gray-600 dark:text-gray-400" />
                    <span className="truncate text-gray-700 dark:text-gray-300">
                      {selectedCashier ? selectedCashier.full_name : 'Select Cashier'}
                    </span>
                  </div>
                  <CaretDownIcon size={14} className={`transition-transform text-gray-500 dark:text-gray-400 ${showCashierDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showCashierDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 border rounded z-50 max-h-64 overflow-y-auto bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                    <div
                      onClick={() => {
                        setSelectedCashier(null)
                        localStorage.removeItem('selected_cashier')
                        setShowCashierDropdown(false)
                      }}
                      className="px-3 py-2 cursor-pointer text-sm border-b hover:bg-gray-50 text-gray-500 border-gray-100 dark:hover:bg-gray-700 dark:text-gray-400 dark:border-gray-700"
                    >
                      No Cashier Selected
                    </div>
                    {cashiers.map((cashier) => (
                      <div
                        key={cashier.id}
                        onClick={() => handleCashierSelect(cashier)}
                        className={`px-3 py-2 cursor-pointer transition-colors ${selectedCashier?.id === cashier.id
                            ? 'bg-gray-50 dark:bg-gray-700'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <UserIcon size={14} className="text-gray-600 dark:text-gray-400" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-200">{cashier.full_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{cashier.phone_number}</p>
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
                        ? 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-600/20 dark:text-cyan-400 dark:border-cyan-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-[#2a2a2a] dark:hover:text-white'
                      }
                      ${isCollapsed ? 'justify-center px-0' : ''}
                    `}
                    title={isCollapsed ? item.label : ''}
                  >
                    <Icon
                      size={20}
                      weight={isActive ? 'duotone' : 'regular'}
                      className={`flex-shrink-0 ${isActive
                        ? 'text-cyan-600 dark:text-cyan-400'
                        : 'text-gray-500 dark:text-gray-400 dark:group-hover:text-white'
                        }`}
                    />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-[#151515]">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className={`flex items-center gap-2 w-full px-3 py-2 mb-2 border rounded transition-colors text-sm font-medium bg-white hover:bg-gray-100 border-gray-200 text-gray-700 dark:bg-[#0f0f0f] dark:hover:bg-[#2a2a2a] dark:border-gray-600 dark:text-gray-200 ${isCollapsed ? 'justify-center px-0' : ''}`}
            title={isCollapsed ? (isDarkMode ? 'Light Mode' : 'Dark Mode') : ''}
          >
            {isDarkMode ? <SunIcon size={20} weight="duotone" className="flex-shrink-0 text-yellow-500" /> : <MoonIcon size={20} weight="regular" className="flex-shrink-0 text-blue-500" />}
            {!isCollapsed && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          {!isCollapsed && (
            <div className="mb-2">
              <p className="font-medium text-sm text-gray-900 dark:text-gray-200">{userName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{userRole}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2 w-full px-3 py-2 border rounded transition-colors text-sm font-medium bg-white hover:bg-red-50 border-gray-200 hover:border-red-200 text-gray-700 hover:text-red-600 dark:bg-[#0f0f0f] dark:hover:bg-red-900/20 dark:border-gray-600 dark:hover:border-red-800 dark:text-gray-200 dark:hover:text-red-400 ${isCollapsed ? 'justify-center px-0' : ''}`}
            title={isCollapsed ? 'Logout' : ''}
          >
            <SignOutIcon size={20} weight="regular" className="flex-shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
