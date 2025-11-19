'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<{ role: UserRole; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const hasChecked = useRef(false)

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
    <div className="flex min-h-screen">
      <Sidebar userRole={user.role} userName={user.name} />
      <main className="flex-1 lg:ml-64 p-6 md:p-8 bg-bg-secondary">
        {children}
      </main>
    </div>
  )
}
