import useSWR, { SWRConfiguration} from 'swr'
import { getStoreId } from '@/lib/supabase'

const fetcher = async (url: string) => {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  })
  
  if (!res.ok) {
    const error = new Error('Failed to fetch data')
    throw error
  }
  
  const json = await res.json()
  
  if (!json.success) {
    throw new Error(json.error || 'API returned an error')
  }
  
  return json.data
}

/**
 * Generic SWR hook for API routes that return { success: true, data: ... }
 * Automatically prepends store_id to the URL.
 */
export function useStoreData<T = any>(
  endpoint: string | null,
  config?: SWRConfiguration
) {
  const storeId = typeof window !== 'undefined' ? getStoreId() : null
  
  // Only fetch if we have a store ID and endpoint
  const key = storeId && endpoint 
    ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}store_id=${storeId}`
    : null

  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,       // Dedupe requests within 5s
      errorRetryCount: 2,
      ...config
    }
  )

  return {
    data,
    error,
    isLoading,              // True on first load only
    isValidating,           // True on revalidation (background refresh)
    mutate,                 // Force revalidation
    isEmpty: !isLoading && !data
  }
}

/**
 * Dashboard stats hook with auto-refresh every 60 seconds
 */
export function useDashboardStats() {
  return useStoreData('/api/dashboard/stats', {
    refreshInterval: 60000,    // Refresh every 60 seconds
    revalidateOnFocus: true,   // Refresh when tab regains focus
  })
}

/**
 * Products list hook
 */
export function useProducts() {
  return useStoreData('/api/products', {
    dedupingInterval: 10000,   // Cache products for 10 seconds
  })
}

/**
 * Sales hook
 */
export function useSales() {
  return useStoreData('/api/sales', {
    dedupingInterval: 5000,
  })
}
