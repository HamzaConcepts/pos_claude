'use client'

import { SkeletonCard, Skeleton, SkeletonListItem } from '@/components/ui/Skeleton'

export default function DashboardSkeleton() {
  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-24 rounded" />
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <SkeletonCard />
        <div className="rounded-lg p-4 lg:col-span-3 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-2.5 w-16 mb-2" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sales Trend Chart */}
        <div className="rounded-lg p-5 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <Skeleton className="h-4 w-44 mb-4" />
          <div className="flex items-end justify-between gap-2 h-48">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <Skeleton
                  className="w-full rounded-t-lg"
                  height={`${30 + Math.random() * 60}%`}
                />
                <Skeleton className="h-2.5 w-8" />
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="rounded-lg p-5 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <Skeleton className="h-4 w-44 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonListItem key={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Recent Sales & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg overflow-hidden bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="p-4 flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="px-4 pb-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonListItem key={i} />
            ))}
          </div>
        </div>
        <div className="rounded-lg overflow-hidden bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="p-4 flex items-center justify-between">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-5 w-8 rounded-full" />
          </div>
          <div className="px-4 pb-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonListItem key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
