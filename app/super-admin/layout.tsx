'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import SuperAdminSidebar from '@/components/SuperAdminSidebar'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const hasChecked = useRef(false)

  useEffect(() => {
    if (hasChecked.current) return
    hasChecked.current = true

    // Skip auth check on the login page
    if (pathname === '/super-admin/login') {
      setLoading(false)
      setAuthenticated(true) // Let the login page render
      return
    }

    const verify = async () => {
      try {
        const res = await fetch('/api/super-admin/verify')
        if (!res.ok) {
          router.replace('/super-admin/login')
          return
        }
        setAuthenticated(true)
      } catch {
        router.replace('/super-admin/login')
      } finally {
        setLoading(false)
      }
    }

    verify()
  }, [pathname, router])

  // Login page renders without layout chrome
  if (pathname === '/super-admin/login') {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f0f0f]">
        <div className="text-center">
          <div className="relative mx-auto w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-gray-900 dark:border-t-white animate-spin" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading Super Admin...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) return null

  return (
    <div className="flex flex-row min-h-screen bg-gray-50 dark:bg-[#0f0f0f]">
      <SuperAdminSidebar />
      <main className="flex-1 p-4 sm:p-5 md:p-6 transition-all duration-300 lg:ml-[var(--sa-sidebar-width,13rem)]">
        {children}
      </main>
    </div>
  )
}
