'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

// Cache to store visited pages
const pageCache = new Set<string>()

export default function NavigationHandler() {
  const pathname = usePathname()

  useEffect(() => {
    // Add current page to cache
    pageCache.add(pathname)
  }, [pathname])

  return null
}

// Custom hook to check if a page has been visited
export function usePageCache() {
  const pathname = usePathname()
  return pageCache.has(pathname)
}
