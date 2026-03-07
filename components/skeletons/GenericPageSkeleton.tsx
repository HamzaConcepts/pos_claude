'use client'

import { Skeleton, SkeletonTable } from '@/components/ui/Skeleton'

export default function GenericPageSkeleton({ title = true }: { title?: boolean }) {
  return (
    <div className="animate-fadeIn">
      {title && (
        <div className="mb-5">
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-52" />
        </div>
      )}

      {/* Content cards */}
      <div className="rounded-lg p-5 mb-4 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 flex-1 rounded" />
            </div>
          ))}
        </div>
      </div>

      <SkeletonTable rows={5} cols={4} />
    </div>
  )
}
