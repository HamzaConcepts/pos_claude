'use client'

import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton'

export default function InventorySkeleton() {
  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <Skeleton className="h-7 w-36 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded" />
          <Skeleton className="h-9 w-32 rounded" />
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-lg p-4 mb-4 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-9 flex-1 rounded" />
          <Skeleton className="h-9 w-36 rounded" />
          <Skeleton className="h-9 w-36 rounded" />
          <Skeleton className="h-9 w-28 rounded" />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg p-3 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>

      {/* Table */}
      <SkeletonTable rows={8} cols={6} />
    </div>
  )
}
