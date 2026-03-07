'use client'

import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton'

export default function KhaataSkeleton() {
  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <Skeleton className="h-7 w-36 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-9 w-28 rounded" />
        <Skeleton className="h-9 w-28 rounded" />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg p-3 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>

      {/* Search */}
      <Skeleton className="h-9 w-full rounded mb-4" />

      {/* Customer/Supplier Cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg p-4 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-32 mb-1.5" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="text-right">
                <Skeleton className="h-5 w-20 mb-1" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
