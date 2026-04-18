import { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string
  icon: ReactNode
  trend?: number
  trendLabel?: string
  isProfit?: boolean
}

export function StatCard({ title, value, icon, trend, trendLabel, isProfit }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">{title}</p>
        <div className="text-gray-400 dark:text-gray-500">{icon}</div>
      </div>
      <p className={`text-2xl font-bold ${isProfit ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </p>
      {trend !== undefined && trendLabel && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {trend} {trendLabel}
        </p>
      )}
    </div>
  )
}
