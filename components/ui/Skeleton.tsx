'use client'

interface SkeletonProps {
  className?: string
  width?: string
  height?: string
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-800 ${className}`}
      style={{ width, height }}
    />
  )
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg p-4 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow ${className}`}>
      <div className="flex items-center gap-2.5 mb-3">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-7 w-28 mb-2" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  )
}

export function SkeletonTableRow({ cols = 5, className = '' }: { cols?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-4 p-3 border-gray-100 dark:border-gray-800 border-b ${className}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 flex-1"
          width={i === 0 ? '30%' : undefined}
        />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 5, className = '' }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={`rounded-lg overflow-hidden bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-800 border-b">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
    </div>
  )
}

export function SkeletonListItem({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/30 ${className}`}>
      <div className="flex items-center gap-3 flex-1">
        <Skeleton className="w-7 h-7 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-3.5 w-32 mb-1.5" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  )
}
