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
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-600">{title}</p>
        <div className="text-gray-400">{icon}</div>
      </div>
      <p className={`text-2xl font-bold ${isProfit ? 'text-green-600' : ''}`}>
        {value}
      </p>
      {trend !== undefined && trendLabel && (
        <p className="text-sm text-gray-500 mt-2">
          {trend} {trendLabel}
        </p>
      )}
    </div>
  )
}
