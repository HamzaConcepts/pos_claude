'use client'

import { useEffect, useState } from 'react'
import { PackageIcon, TruckIcon, CalendarIcon, CurrencyDollarIcon, ShoppingCartIcon } from '@phosphor-icons/react'
import { getStoreId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useCurrency } from '@/lib/currency-context'

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
const getCategoryStyle = (category: string, isDark: boolean): string => {
  if (category === 'new_product') {
    return isDark 
      ? 'bg-green-900/30 border-green-700 text-green-400' 
      : 'bg-green-100 border-green-300 text-green-700'
  }
  if (category === 'inventory_restock') {
    return isDark 
      ? 'bg-blue-900/30 border-blue-700 text-blue-400' 
      : 'bg-blue-100 border-blue-300 text-blue-700'
  }
  return isDark 
    ? 'bg-gray-800 border-gray-600 text-gray-300' 
    : 'bg-gray-100 border-gray-200 text-gray-700'
}

export default function InventoryPurchasesPage() {
  const router = useRouter()
  const isDarkMode = useDarkMode()
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${isDarkMode ? 'border-cyan-500' : 'border-black'}`}></div>
          <p className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading inventory purchases...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-5">
        <h1 className={`text-xl md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Inventory Purchases</h1>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Track all stock purchases and restocks. These are converted to COGS when items are sold.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm">
          {error}
        </div>
      )}

      {/* Info Banner */}
      <div className={`mb-5 p-4 rounded border ${isDarkMode ? 'bg-blue-900/20 border-blue-700/50' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex items-start gap-3">
          <ShoppingCartIcon className={`flex-shrink-0 mt-0.5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} size={20} />
          <div>
            <h3 className={`font-semibold text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-900'}`}>
              About Inventory Purchases
            </h3>
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
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
        <div className={`p-4 rounded border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Today's Purchases</span>
            <PackageIcon className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} size={16} />
          </div>
          <div className={`text-lg font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            {formatCurrency(stats.today, 0)}
          </div>
        </div>

        <div className={`p-4 rounded border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>This Month</span>
            <CalendarIcon className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} size={16} />
          </div>
          <div className={`text-lg font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            {formatCurrency(stats.month, 0)}
          </div>
        </div>

        <div className={`p-4 rounded border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>This Year</span>
            <TruckIcon className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} size={16} />
          </div>
          <div className={`text-lg font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            {formatCurrency(stats.year, 0)}
          </div>
        </div>

        <div className={`p-4 rounded border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Investment</span>
            <CurrencyDollarIcon className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} size={16} />
          </div>
          <div className={`text-lg font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            {formatCurrency(stats.total, 0)}
          </div>
        </div>
      </div>

      {/* Purchases List */}
      <div className={`rounded border overflow-hidden ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className={`p-4 border-b ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
          <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Purchase History</h2>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
              <thead className={`border-b ${isDarkMode ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
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
                    className={`border-b ${isDarkMode ? 'border-gray-700 bg-[#0f0f0f] hover:bg-gray-800' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
                  >
                    <td className={`px-3 py-2.5 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                      {new Date(purchase.expense_date).toLocaleDateString('en-PK', {
                        timeZone: 'Asia/Karachi',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      <div className={isDarkMode ? 'text-gray-300' : 'text-gray-900'}>{purchase.description}</div>
                      {purchase.product_display && (
                        <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          Product: {purchase.product_display}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      <span className={`inline-block px-2 py-1 border rounded text-xs ${getCategoryStyle(purchase.category, isDarkMode)}`}>
                        {formatCategory(purchase.category)}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                      {purchase.recorded_by_name || 'System'}
                    </td>
                    <td className={`px-3 py-2.5 text-sm text-right font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      {formatCurrency(purchase.amount, 0)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        purchase.payment_method === 'Cash' 
                          ? isDarkMode ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-green-100 text-green-700 border border-green-300'
                          : purchase.payment_method === 'Digital' 
                          ? isDarkMode ? 'bg-blue-900/30 text-blue-400 border border-blue-700' : 'bg-blue-100 text-blue-700 border border-blue-300'
                          : isDarkMode ? 'bg-gray-800 text-gray-400 border border-gray-600' : 'bg-gray-100 text-gray-600 border border-gray-300'
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
