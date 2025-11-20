'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    // Check for cashier session
    const cashierSession = localStorage.getItem('user_session')
    if (cashierSession) {
      router.replace('/dashboard/pos')
      return
    }

    // Check for manager session
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-xl">Loading...</div>
    </div>
  )
}
