'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import MobileBottomNav from '@/components/MobileBottomNav'
import { useSwipeable } from 'react-swipeable'
import { CurrencyProvider } from '@/lib/currency-context'

import Logo from '@/components/Logo'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<{ role: UserRole; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const hasChecked = useRef(false)

  // Define navigation order
  const navOrder = [
    '/dashboard',
    '/dashboard/pos',
    '/dashboard/inventory',
    '/dashboard/sales',
    '/dashboard/expenses',
    '/dashboard/khaata',
    '/dashboard/supplier-khaata',
    '/dashboard/cashiers',
    '/dashboard/store'
  ]

  // Swipe handlers for mobile navigation
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = navOrder.indexOf(pathname)
      if (currentIndex < navOrder.length - 1) {
        router.push(navOrder[currentIndex + 1])
      }
    },
    onSwipedRight: () => {
      const currentIndex = navOrder.indexOf(pathname)
      if (currentIndex > 0) {
        router.push(navOrder[currentIndex - 1])
      }
    },
    trackMouse: false,
    trackTouch: true
  })

  // Listen for dark mode changes
  useEffect(() => {
    const handleDarkModeChange = (e: any) => {
      setIsDarkMode(e.detail.isDarkMode)
    }

    // Check initial dark mode state
    const savedDarkMode = localStorage.getItem('dark_mode')
    if (savedDarkMode) {
      setIsDarkMode(savedDarkMode === 'true')
    }

    window.addEventListener('darkModeChange', handleDarkModeChange)
    return () => window.removeEventListener('darkModeChange', handleDarkModeChange)
  }, [])

  // Sync dark class on <html> element whenever isDarkMode changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasChecked.current) {
      return
    }
    hasChecked.current = true
    
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      // First check for cashier session in localStorage
      const cashierSession = localStorage.getItem('user_session')
      
      if (cashierSession) {
        const session = JSON.parse(cashierSession)
        
        // Also set sessionStorage if not already set (for getStoreId compatibility)
        if (!sessionStorage.getItem('store_id') && session.store_id) {
          sessionStorage.setItem('store_id', session.store_id.toString())
          sessionStorage.setItem('user_type', 'Cashier')
        }
        
        setUser({
          role: session.role as UserRole,
          name: session.full_name,
        })
        setIsAuthenticated(true)
        setLoading(false)
        return
      }

      // Check Supabase Auth for Manager accounts
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session || !session.user) {
        // No valid session, redirect to login
        setIsAuthenticated(false)
        setLoading(false)
        router.replace('/login')
        return
      }

      // Use API endpoint to fetch manager data (bypasses RLS)
      const response = await fetch('/api/auth/check-session', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        // Session check failed
        await supabase.auth.signOut()
        setIsAuthenticated(false)
        setLoading(false)
        if (response.status === 403) {
          // Account or store deactivated
          router.replace('/login?error=' + encodeURIComponent(errorData.error || 'Account deactivated'))
        } else {
          router.replace('/login')
        }
        return
      }

      const userData = await response.json()

      // Set sessionStorage values FIRST before setting user state
      if (userData.store_id) {
        sessionStorage.setItem('store_id', userData.store_id.toString())
        sessionStorage.setItem('user_type', 'Manager')
        sessionStorage.setItem('user_id', userData.user_id)
      }

      // Small delay to ensure sessionStorage is fully written
      await new Promise(resolve => setTimeout(resolve, 100))

      // Set user and stop loading
      setUser({
        role: userData.role as UserRole,
        name: userData.name,
      })
      setIsAuthenticated(true)
      setLoading(false)
    } catch (error) {
      setIsAuthenticated(false)
      setLoading(false)
      router.replace('/login')
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-cyan-50 dark:from-[#0a0a0a] dark:via-[#0f0f0f] dark:to-[#0a1628]">
        <div className="text-center">
          {/* Logo */}
          <div className="mx-auto mb-5 animate-pulse">
            <Logo size={56} className="text-cyan-500 mx-auto" />
          </div>
          {/* Progress bar */}
          <div className="w-56 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mx-auto mb-4">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-600" style={{ animation: 'progressBar 1.5s ease-in-out infinite' }} />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Loading Atom
          </p>
        </div>
      </div>
    )
  }

  // If authentication failed, show nothing (redirect is happening)
  if (!isAuthenticated || !user) {
    return null
  }

  // User is authenticated, show dashboard
  return (
    <CurrencyProvider>
      <div className="flex flex-row min-h-screen transition-colors duration-300 bg-[#F5F5F5] dark:bg-[#0f0f0f]">
        <Sidebar userRole={user.role} userName={user.name} />
        <main 
          {...swipeHandlers}
          className="flex-1 p-4 sm:p-5 md:p-6 pb-20 lg:pb-6 transition-all duration-300 lg:ml-[var(--sidebar-width,13rem)] bg-[#F5F5F5] dark:bg-[#0f0f0f]"
        >
          {children}
        </main>
        <MobileBottomNav userRole={user.role} />
      </div>
    </CurrencyProvider>
  )
}
