'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/login')
        return
      }

      // Fetch user details from users table
      const { data: userData, error } = await supabase
        .from('users')
        .select('role, full_name')
        .eq('id', authUser.id)
        .single()

      if (error || !userData) {
        router.push('/login')
        return
      }

      setUser({
        role: userData.role as UserRole,
        name: userData.full_name,
      })

      // Redirect Cashier to POS page if on dashboard root
      if (userData.role === 'Cashier' && window.location.pathname === '/dashboard') {
        router.push('/dashboard/pos')
      }
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar userRole={user.role} userName={user.name} />
      <main className="flex-1 lg:ml-64 p-6 md:p-8 bg-bg-secondary">
        {children}
      </main>
    </div>
  )
}
