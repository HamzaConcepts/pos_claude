'use client'

import { useEffect, useState } from 'react'
import { StorefrontIcon, UsersIcon, UserListIcon, ClockIcon, ClockCountdownIcon } from '@phosphor-icons/react'
import Link from 'next/link'

interface Stats {
  stores: { total: number; active: number; inactive: number }
  managers: { total: number; active: number; inactive: number }
  cashierAccounts: { total: number; active: number; inactive: number }
  pendingSignups: number
  pendingJoinRequests: number
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/super-admin/stats')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-6 animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const cards = [
    {
      title: 'Pending Approvals',
      value: stats?.pendingSignups ?? 0,
      sub: 'New store signups awaiting review',
      icon: <ClockCountdownIcon size={24} />,
      color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
      href: '/super-admin/approvals',
      urgent: (stats?.pendingSignups ?? 0) > 0,
    },
    {
      title: 'Total Stores',
      value: stats?.stores.total ?? 0,
      sub: `${stats?.stores.active ?? 0} active · ${stats?.stores.inactive ?? 0} inactive`,
      icon: <StorefrontIcon size={24} />,
      color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
      href: '/super-admin/stores',
      urgent: false,
    },
    {
      title: 'Total Managers',
      value: stats?.managers.total ?? 0,
      sub: `${stats?.managers.active ?? 0} active · ${stats?.managers.inactive ?? 0} inactive`,
      icon: <UsersIcon size={24} />,
      color: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
      href: '/super-admin/managers',
      urgent: false,
    },
    {
      title: 'Cashier Accounts',
      value: stats?.cashierAccounts.total ?? 0,
      sub: `${stats?.cashierAccounts.active ?? 0} active · ${stats?.cashierAccounts.inactive ?? 0} inactive`,
      icon: <UserListIcon size={24} />,
      color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
      href: '/super-admin/cashiers',
      urgent: false,
    },
    {
      title: 'Pending Join Requests',
      value: stats?.pendingJoinRequests ?? 0,
      sub: 'Cashiers waiting to join a store',
      icon: <ClockIcon size={24} />,
      color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
      href: '/super-admin/stores',
      urgent: false,
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className={`bg-white dark:bg-[#1a1a1a] border rounded-lg p-6 block hover:shadow-md transition-shadow ${
              card.urgent
                ? 'border-amber-300 dark:border-amber-700 ring-1 ring-amber-200 dark:ring-amber-800'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">{card.title}</p>
              <div className={`p-2 rounded-lg ${card.color}`}>{card.icon}</div>
            </div>
            <p className={`text-3xl font-bold ${card.urgent && card.value > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
              {card.value}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.sub}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
