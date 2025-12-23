'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import MobileBottomNav from '@/components/MobileBottomNav'
import { useSwipeable } from 'react-swipeable'

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

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasChecked.current) {
      console.log('[DASHBOARD] Already checked, skipping...')
      return
    }
    hasChecked.current = true
    
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      console.log('[DASHBOARD] === Starting authentication check ===')
      
      // First check for cashier session in localStorage
      const cashierSession = localStorage.getItem('user_session')
      console.log('[DASHBOARD] Cashier session check:', cashierSession ? 'Found' : 'Not found')
      
      if (cashierSession) {
        const session = JSON.parse(cashierSession)
        console.log('[DASHBOARD] ✓ Cashier authenticated:', session.full_name)
        
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
      console.log('[DASHBOARD] Checking Supabase auth session...')
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      console.log('[DASHBOARD] Session check result:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        error: sessionError
      })

      if (sessionError || !session || !session.user) {
        console.log('[DASHBOARD] ❌ REDIRECT → /login (Reason: No valid session)')
        // No valid session, redirect to login
        setIsAuthenticated(false)
        setLoading(false)
        router.replace('/login')
        return
      }

      console.log('[DASHBOARD] Valid session found, calling API...')
      // Use API endpoint to fetch manager data (bypasses RLS)
      const response = await fetch('/api/auth/check-session', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      console.log('[DASHBOARD] API response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.log('[DASHBOARD] ❌ REDIRECT → /login (Reason: API check failed)', errorText)
        // Session check failed
        await supabase.auth.signOut()
        setIsAuthenticated(false)
        setLoading(false)
        router.replace('/login')
        return
      }

      const userData = await response.json()
      console.log('[DASHBOARD] User data received:', userData)

      // Set sessionStorage values FIRST before setting user state
      if (userData.store_id) {
        console.log('[DASHBOARD] Setting sessionStorage...')
        sessionStorage.setItem('store_id', userData.store_id.toString())
        sessionStorage.setItem('user_type', 'Manager')
        sessionStorage.setItem('user_id', userData.user_id)
        
        // Verify it was set
        const verifyStoreId = sessionStorage.getItem('store_id')
        console.log('[DASHBOARD] SessionStorage verified, store_id:', verifyStoreId)
      }

      // Small delay to ensure sessionStorage is fully written
      await new Promise(resolve => setTimeout(resolve, 100))

      // Set user and stop loading
      console.log('[DASHBOARD] ✓ Authentication successful, setting user state')
      setUser({
        role: userData.role as UserRole,
        name: userData.name,
      })
      setIsAuthenticated(true)
      setLoading(false)
      console.log('[DASHBOARD] === Authentication complete ===')
    } catch (error) {
      console.error('[DASHBOARD] ❌ REDIRECT → /login (Reason: Exception caught)', error)
      setIsAuthenticated(false)
      setLoading(false)
      router.replace('/login')
    }
  }

  // Show loading state
  if (loading) {
    console.log('[DASHBOARD] Rendering: Loading state')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  // If authentication failed, show nothing (redirect is happening)
  if (!isAuthenticated || !user) {
    console.log('[DASHBOARD] Rendering: Null (redirect in progress)', { isAuthenticated, hasUser: !!user })
    return null
  }

  // User is authenticated, show dashboard
  console.log('[DASHBOARD] Rendering: Dashboard with user:', user.name)
  return (
    <div className={`flex flex-row min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-[#F5F5F5]'}`}>
      <Sidebar userRole={user.role} userName={user.name} />
      <main 
        {...swipeHandlers}
        className={`flex-1 lg:ml-56 p-5 md:p-6 pb-20 lg:pb-6 transition-colors duration-300 ${isDarkMode ? 'bg-gray-900' : 'bg-[#F5F5F5]'}`}
      >
        {children}
      </main>
      <MobileBottomNav userRole={user.role} />
    </div>
  )
}
