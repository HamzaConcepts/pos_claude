'use client'

import { Skeleton } from '@/components/ui/Skeleton'

export default function StoreSkeleton() {
  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-5">
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Store Info Card */}
      <div className="rounded-lg p-5 mb-6 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
        <div className="flex items-center gap-4 mb-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* Settings Sections */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg p-5 mb-4 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-9 w-full rounded" />
            <Skeleton className="h-9 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
