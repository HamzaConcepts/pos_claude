'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, TrendingUp, DollarSign, ShoppingBag, Package, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import type { DashboardStats } from '@/lib/types'
import { getStoreId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const router = useRouter()

  // Listen for dark mode changes from sidebar
  useEffect(() => {
    const handleDarkModeChange = (event: any) => {
      setIsDarkMode(event.detail.isDarkMode)
    }

    // Check initial dark mode state
    const savedDarkMode = localStorage.getItem('dark_mode')
    if (savedDarkMode) {
      setIsDarkMode(savedDarkMode === 'true')
    }

    window.addEventListener('darkModeChange', handleDarkModeChange)
    return () => window.removeEventListener('darkModeChange', handleDarkModeChange)
  }, [])

  useEffect(() => {
    fetchDashboardStats()
    
    // // Auto-refresh every 30 seconds
    // const interval = setInterval(() => {
    //   fetchDashboardStats(true)
    // }, 30000)

    // return () => clearInterval(interval)
  }, [])

  const fetchDashboardStats = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      // Wait a moment for sessionStorage to be set by layout
      let storeId = getStoreId()
      let retries = 0
      
      while (!storeId && retries < 5) {
        console.log(`[DASHBOARD PAGE] Waiting for store_id... attempt ${retries + 1}`)
        await new Promise(resolve => setTimeout(resolve, 300))
        storeId = getStoreId()
        retries++
      }
      
      if (!storeId) {
        console.log('[DASHBOARD PAGE] No store ID found after retries, redirecting to login')
        setError('No store ID found. Please login again.')
        router.push('/login')
        return
      }

      console.log('[DASHBOARD PAGE] Store ID found:', storeId)
      
      const response = await fetch(`/api/dashboard/stats?store_id=${storeId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const result = await response.json()

      if (result.success) {
        setStats(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to fetch dashboard stats')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchDashboardStats()
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center min-h-[400px] ${isDarkMode ? 'bg-gray-900' : ''}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${isDarkMode ? 'border-cyan-500' : 'border-black'}`}></div>
          <p className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded">
        {error || 'Failed to load dashboard'}
      </div>
    )
  }

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className={`text-xl md:text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Overview</h1>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Welcome back! Here's what's happening today.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors disabled:bg-gray-400"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {/* Total Sales */}
        <div className={`rounded p-4 transition-colors ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded ${isDarkMode ? 'bg-cyan-900/50' : 'bg-cyan-50'}`}>
              <DollarSign size={18} className="text-cyan-600" />
            </div>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Total Sales</p>
          </div>
          <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {stats.monthlySales.revenue.toFixed(2)}</p>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>This month</p>
        </div>

        {/* Orders Completed */}
        <div className={`rounded p-4 transition-colors ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded ${isDarkMode ? 'bg-blue-900/50' : 'bg-blue-50'}`}>
              <ShoppingBag size={18} className="text-blue-600" />
            </div>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Orders</p>
          </div>
          <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.monthlySales.count}</p>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{stats.todaySales.count} today</p>
        </div>

        {/* Monthly Expenses */}
        <div className={`rounded p-4 transition-colors ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded ${isDarkMode ? 'bg-red-900/50' : 'bg-red-50'}`}>
              <TrendingUp size={18} className="text-red-600" />
            </div>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Expenses</p>
          </div>
          <p className="text-2xl font-bold text-red-600">Rs. {stats.monthlyExpenses.toFixed(2)}</p>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Rs. {stats.todayExpenses?.toFixed(2) || '0.00'} today</p>
        </div>

        {/* Net Profit */}
        <div className={`rounded p-4 transition-colors ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded ${isDarkMode ? 'bg-green-900/50' : 'bg-green-50'}`}>
              <TrendingUp size={18} className="text-green-600" />
            </div>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Net Profit</p>
          </div>
          <p className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            Rs. {stats.netProfit.toFixed(2)}
          </p>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>This month</p>
        </div>
      </div>

      {/* Quick Stats & Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className={`p-4 rounded transition-colors ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <p className={`text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Low Stock Items</p>
          <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.lowStockCount}</p>
        </div>

        <div className={`p-4 rounded lg:col-span-2 transition-colors ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Top Expense Categories</p>
            <Link href="/dashboard/expenses" className="text-xs text-cyan-600 hover:text-cyan-700">
              View All →
            </Link>
          </div>
          {stats.expensesByCategory && stats.expensesByCategory.length > 0 ? (
            <div className="flex gap-4">
              {stats.expensesByCategory.slice(0, 3).map((cat: any) => (
                <div key={cat.category} className="flex-1">
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{cat.category}</p>
                  <p className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {cat.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>No expenses recorded</p>
          )}
        </div>
      </div>

      {/* Low Stock Alert */}
      {stats.lowStockCount > 0 && (
        <div className={`p-4 rounded mb-5 flex items-center justify-between ${isDarkMode ? 'bg-orange-900/30 border border-orange-800 text-orange-300' : 'bg-orange-50 border border-orange-200 text-orange-800'}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className={isDarkMode ? 'text-orange-400' : 'text-orange-600'} />
            <span className="text-sm font-medium">
              {stats.lowStockCount} {stats.lowStockCount === 1 ? 'product is' : 'products are'} running low on stock
            </span>
          </div>
          <Link
            href="/dashboard/inventory?low_stock=true"
            className="bg-orange-600 text-white px-3 py-1.5 rounded text-sm hover:bg-orange-700 transition-colors"
          >
            View Inventory
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
        {/* Sales Trend */}
        <div className={`p-4 rounded transition-colors ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <h2 className={`text-base font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Sales Trend (Last 7 Days)</h2>
          {stats.salesTrend.length > 0 ? (
            <div className="space-y-2">
              {stats.salesTrend.map((day) => (
                <div key={day.date} className="flex items-center justify-between">
                  <span className={`text-xs w-16 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className={`flex-1 mx-3 rounded-full h-2 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <div
                      className="bg-cyan-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min((day.revenue / Math.max(...stats.salesTrend.map(d => d.revenue))) * 100, 100)}%`
                      }}
                    />
                  </div>
                  <span className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Rs. {day.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-center py-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No sales data available</p>
          )}
        </div>

        {/* Top Products */}
        <div className={`p-4 rounded transition-colors ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <h2 className={`text-base font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Top Products (This Month)</h2>
          {stats.topProducts && stats.topProducts.length > 0 ? (
            <div className="space-y-2">
              {stats.topProducts.map((product: any, index: number) => (
                <div key={product.product_name || index} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${isDarkMode ? 'bg-cyan-900/50 text-cyan-400' : 'bg-cyan-100 text-cyan-700'}`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{product.product_name || 'Unknown'}</p>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      ${Number(product.revenue || 0).toFixed(2)} · {product.quantity || 0} sold
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-center py-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No sales data available</p>
          )}
        </div>
      </div>

      {/* Recent Sales & Low Stock Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Recent Sales */}
        <div className={`rounded overflow-hidden transition-colors ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'bg-gray-750 border-gray-700' : 'bg-[#F5F5F5] border-gray-200'}`}>
            <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Recent Sales</h2>
            {stats.recentSales.length > 0 && (
              <Link href="/dashboard/sales" className="text-xs text-cyan-600 hover:text-cyan-700">
                View All →
              </Link>
            )}
          </div>
          <div className="p-3">
            {stats.recentSales.length > 0 ? (
              <div className="space-y-2">
                {stats.recentSales.slice(0, 5).map((sale: any) => (
                  <div key={sale.id} className={`flex items-center justify-between p-2 rounded ${isDarkMode ? 'border border-gray-700 hover:bg-gray-700' : 'border border-gray-200 hover:bg-[#F5F5F5]'}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`font-mono text-xs font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{sale.sale_number || `Sale #${sale.id}`}</p>
                      <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {new Date(sale.sale_date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        {sale.cashier_name || 'Unknown Cashier'}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>${sale.total_amount.toFixed(2)}</p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{sale.payment_method}</p>
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                        sale.payment_status === 'Paid' ? 'bg-green-50 text-green-700 border-green-200' :
                        sale.payment_status === 'Partial' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }`}>
                        {sale.payment_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-center py-6 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No recent sales</p>
            )}
          </div>
        </div>

        {/* Low Stock Products */}
        <div className={`rounded overflow-hidden transition-colors ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'bg-gray-750 border-gray-700' : 'bg-[#F5F5F5] border-gray-200'}`}>
            <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Low Stock Products</h2>
            {stats.lowStockCount > 0 && (
              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-semibold border border-orange-200">
                {stats.lowStockCount}
              </span>
            )}
          </div>
          <div className="p-3">
            {stats.lowStockProducts && stats.lowStockProducts.length > 0 ? (
              <div className="space-y-2">
                {stats.lowStockProducts.map((product: any) => (
                  <div key={product.id} className={`flex items-center justify-between p-2 rounded ${isDarkMode ? 'border border-orange-800 bg-orange-900/20' : 'border border-orange-200 bg-orange-50'}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Package size={16} className={isDarkMode ? 'text-orange-400' : 'text-orange-600'} />
                      <div className="min-w-0">
                        <p className={`font-medium text-sm truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{product.name}</p>
                        <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <p className={`font-semibold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{product.stock_quantity}</p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>in stock</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-center py-6 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>All products are well stocked</p>
            )}
          </div>
        </div>
      </div>
    </>
    )
}

