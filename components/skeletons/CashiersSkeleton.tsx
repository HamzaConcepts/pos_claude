'use client'

import { Skeleton } from '@/components/ui/Skeleton'

export default function CashiersSkeleton() {
  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <Skeleton className="h-7 w-28 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-32 rounded" />
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg p-4 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-28 mb-1.5" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="space-y-2 mb-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 flex-1 rounded" />
              <Skeleton className="h-8 flex-1 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
