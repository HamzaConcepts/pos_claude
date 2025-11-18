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
      // First check for cashier session in localStorage
      const cashierSession = localStorage.getItem('user_session')
      if (cashierSession) {
        const session = JSON.parse(cashierSession)
        setUser({
          role: session.role as UserRole,
          name: session.full_name,
        })
        setLoading(false)
        return
      }

      // Check Supabase Auth for Manager accounts
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        router.push('/login')
        return
      }

      // Fetch manager details from managers table
      const { data: managerData, error } = await supabase
        .from('managers')
        .select('full_name')
        .eq('id', authUser.id)
        .single()

      if (error || !managerData) {
        router.push('/login')
        return
      }

      setUser({
        role: 'Manager' as UserRole,
        name: managerData.full_name,
      })
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
