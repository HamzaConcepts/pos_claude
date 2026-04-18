'use client'

import { useEffect, useState } from 'react'
import { PackageIcon, TruckIcon, CalendarIcon, CurrencyDollarIcon, ShoppingCartIcon } from '@phosphor-icons/react'
import { getStoreId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useCurrency } from '@/lib/currency-context'
import GenericPageSkeleton from '@/components/skeletons/GenericPageSkeleton'

interface InventoryPurchase {
  id: number
  description: string
  amount: number
  category: string
  payment_method?: string
  expense_date: string
  recorded_by_name?: string
  product_display?: string
  product_name?: string
  product_sku?: string
  created_at: string
}

// Format category for display
const formatCategory = (category: string): string => {
  const categoryMap: Record<string, string> = {
    'new_product': 'New Product',
    'inventory_restock': 'Restock',
  }
  return categoryMap[category] || category
}

// Get appropriate styling for category badge
const getCategoryStyle = (category: string): string => {
  if (category === 'new_product') {
    return 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
  }
  if (category === 'inventory_restock') {
    return 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400'
  }
  return 'bg-gray-100 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
}

export default function InventoryPurchasesPage() {
  const router = useRouter()
  const { currency, formatCurrency } = useCurrency()
  const [purchases, setPurchases] = useState<InventoryPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPurchases()
  }, [])

  const fetchPurchases = async () => {
    try {
      setLoading(true)
      
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        router.push('/login')
        return
      }

      const response = await fetch(`/api/inventory-purchases?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setPurchases(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to fetch inventory purchases')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOfYear = new Date(today.getFullYear(), 0, 1)

    const todayPurchases = purchases.filter(p => 
      new Date(p.expense_date).toDateString() === today.toDateString()
    )
    const monthPurchases = purchases.filter(p => 
      new Date(p.expense_date) >= startOfMonth
    )
    const yearPurchases = purchases.filter(p => 
      new Date(p.expense_date) >= startOfYear
    )

    return {
      today: todayPurchases.reduce((sum, p) => sum + p.amount, 0),
      month: monthPurchases.reduce((sum, p) => sum + p.amount, 0),
      year: yearPurchases.reduce((sum, p) => sum + p.amount, 0),
      total: purchases.reduce((sum, p) => sum + p.amount, 0)
    }
  }

  const stats = calculateStats()

  if (loading) {
    return <GenericPageSkeleton />
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Inventory Purchases</h1>
        <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
          Track all stock purchases and restocks. These are converted to COGS when items are sold.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm">
          {error}
        </div>
      )}

      {/* Info Banner */}
      <div className="mb-5 p-4 rounded border bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700/50">
        <div className="flex items-start gap-3">
          <ShoppingCartIcon className="flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" size={20} />
          <div>
            <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-300">
              About Inventory Purchases
            </h3>
            <p className="text-xs mt-1 text-blue-700 dark:text-blue-400">
              • Buying inventory increases your stock and decreases cash (or increases supplier dues)
              <br />
              • These purchases do NOT reduce profit immediately
              <br />
              • Cost is recognized as COGS (Cost of Goods Sold) only when items are sold
              <br />
              • This keeps your profit calculations accurate by matching revenue with its related costs
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="p-4 rounded border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Today's Purchases</span>
            <PackageIcon className="text-blue-600 dark:text-blue-400" size={16} />
          </div>
          <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            {formatCurrency(stats.today, 0)}
          </div>
        </div>

        <div className="p-4 rounded border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">This Month</span>
            <CalendarIcon className="text-blue-600 dark:text-blue-400" size={16} />
          </div>
          <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            {formatCurrency(stats.month, 0)}
          </div>
        </div>

        <div className="p-4 rounded border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">This Year</span>
            <TruckIcon className="text-blue-600 dark:text-blue-400" size={16} />
          </div>
          <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            {formatCurrency(stats.year, 0)}
          </div>
        </div>

        <div className="p-4 rounded border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Total Purchases</span>
            <CurrencyDollarIcon className="text-blue-600 dark:text-blue-400" size={16} />
          </div>
          <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            {formatCurrency(stats.total, 0)}
          </div>
        </div>
      </div>

      {/* Purchases List */}
      <div className="rounded border overflow-hidden bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
        <div className="p-4 border-b bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Purchase History</h2>
          <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
            All inventory purchases are automatically tracked when adding stock or restocking products
          </p>
        </div>
        
        {purchases.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            No inventory purchases yet. Add stock in the Products page to see entries here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
                <tr>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Date</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Description</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Type</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Recorded By</th>
                  <th className="px-3 py-2.5 text-right text-sm font-semibold">Amount</th>
                  <th className="px-3 py-2.5 text-center text-sm font-semibold">Payment</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="border-b border-gray-100 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-[#0f0f0f] dark:hover:bg-gray-800"
                  >
                    <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-gray-300">
                      {new Date(purchase.expense_date).toLocaleDateString('en-PK', {
                        timeZone: 'Asia/Karachi',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      <div className="text-gray-900 dark:text-gray-300">{purchase.description}</div>
                      {purchase.product_display && (
                        <div className="text-xs mt-0.5 text-gray-500">
                          Product: {purchase.product_display}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      <span className={`inline-block px-2 py-1 border rounded text-xs ${getCategoryStyle(purchase.category)}`}>
                        {formatCategory(purchase.category)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-gray-300">
                      {purchase.recorded_by_name || 'System'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-semibold text-blue-600 dark:text-blue-400">
                      {formatCurrency(purchase.amount, 0)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        purchase.payment_method === 'Cash' 
                          ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700'
                          : purchase.payment_method === 'Digital' 
                          ? 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
                          : 'bg-gray-100 text-gray-600 border border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600'
                      }`}>
                        {purchase.payment_method || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
