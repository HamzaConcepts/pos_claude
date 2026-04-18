'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  const clearClientAuthState = async () => {
    localStorage.removeItem('user_session')
    sessionStorage.removeItem('store_id')
    sessionStorage.removeItem('user_type')
    sessionStorage.removeItem('user_id')

    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // Ignore sign-out errors; state is already cleared.
    }
  }

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      // Check cashier session shape before redirecting.
      const cashierSession = localStorage.getItem('user_session')
      if (cashierSession) {
        const parsed = JSON.parse(cashierSession)
        if (parsed?.id && parsed?.store_id) {
          router.replace('/dashboard/pos')
          return
        }

        await clearClientAuthState()
      }

      // Check manager session and validate token before redirecting.
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const response = await fetch('/api/auth/check-session', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (response.ok) {
          router.replace('/dashboard')
          return
        }

        await clearClientAuthState()
      }

      router.replace('/login')
    } catch {
      await clearClientAuthState()
      router.replace('/login')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-xl">Loading...</div>
    </div>
  )
}
