'use client'

import { useEffect, useState } from 'react'
import { WarningIcon, TrendUpIcon, CurrencyDollarIcon, ShoppingBagIcon, PackageIcon, ArrowsClockwiseIcon } from '@phosphor-icons/react'
import Link from 'next/link'
import type { DashboardStats } from '@/lib/types'
import { getStoreId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useCurrency } from '@/lib/currency-context'

export default function DashboardPage() {
  const { currency, formatCurrency } = useCurrency()
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
        await new Promise(resolve => setTimeout(resolve, 300))
        storeId = getStoreId()
        retries++
      }
      
      if (!storeId) {
        setError('No store ID found. Please login again.')
        router.push('/login')
        return
      }
      
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
          <ArrowsClockwiseIcon size={16} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Total Sales (Revenue) */}
        <div className={`rounded-lg p-4 transition-colors ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-50'}`}>
              <CurrencyDollarIcon size={18} className="text-cyan-600" />
            </div>
            <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Revenue</p>
          </div>
          <p className={`text-xl font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{formatCurrency(stats.monthlySales.revenue, 2)}</p>
          <p className={`text-[10px] mt-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>This month</p>
        </div>

        {/* COGS */}
        <div className={`rounded-lg p-4 transition-colors ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-orange-500/20' : 'bg-orange-50'}`}>
              <TrendUpIcon size={18} className="text-orange-600" />
            </div>
            <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>COGS</p>
          </div>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(stats.monthlyCOGS || 0, 2)}</p>
          <p className={`text-[10px] mt-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Cost of goods sold</p>
        </div>

        {/* Gross Profit */}
        <div className={`rounded-lg p-4 transition-colors ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-green-500/20' : 'bg-green-50'}`}>
              <TrendUpIcon size={18} className="text-green-600" />
            </div>
            <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Gross Profit</p>
          </div>
          <p className={`text-xl font-bold ${(stats.grossProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(stats.grossProfit || 0, 2)}
          </p>
          <p className={`text-[10px] mt-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Revenue - COGS</p>
        </div>

        {/* Operating Expenses */}
        <div className={`rounded-lg p-4 transition-colors ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-red-500/20' : 'bg-red-50'}`}>
              <TrendUpIcon size={18} className="text-red-600" />
            </div>
            <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Expenses</p>
          </div>
          <p className="text-xl font-bold text-red-600">{formatCurrency(stats.monthlyExpenses, 2)}</p>
          <p className={`text-[10px] mt-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>{formatCurrency(stats.todayExpenses || 0, 2)} today</p>
        </div>

        {/* Net Profit */}
        <div className={`rounded-lg p-4 transition-colors ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
              <TrendUpIcon size={18} className="text-blue-600" />
            </div>
            <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Net Profit</p>
          </div>
          <p className={`text-xl font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(stats.netProfit, 2)}
          </p>
          <p className={`text-[10px] mt-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Gross profit - Expenses</p>
        </div>
      </div>

      {/* Quick Stats Row - Orders Count */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className={`rounded-lg p-4 transition-colors ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
          <div className="flex items-center gap-2.5 mb-2">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-50'}`}>
              <ShoppingBagIcon size={18} className="text-purple-600" />
            </div>
            <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Orders This Month</p>
          </div>
          <p className={`text-2xl font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{stats.monthlySales.count}</p>
          <p className={`text-[10px] mt-1.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>{stats.todaySales.count} today</p>
        </div>

        <div className={`rounded-lg p-4 lg:col-span-3 transition-colors ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Top Expense Categories</p>
            <Link href="/dashboard/expenses" className="text-[10px] text-cyan-600 hover:text-cyan-700">
              View All →
            </Link>
          </div>
          {stats.expensesByCategory && stats.expensesByCategory.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {stats.expensesByCategory.slice(0, 3).map((cat: any) => (
                <div key={cat.category}>
                  <p className={`text-[10px] mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{cat.category}</p>
                  <p className={`text-base font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{formatCurrency(cat.total, 2)}</p>
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
        <div className={`p-4 rounded-lg mb-6 flex items-center justify-between ${isDarkMode ? 'bg-orange-500/10' : 'bg-orange-50 shadow-sm'}`}>
          <div className="flex items-center gap-2">
            <WarningIcon size={18} className={isDarkMode ? 'text-orange-400' : 'text-orange-600'} />
            <span className={`text-sm font-medium ${isDarkMode ? 'text-orange-300' : 'text-orange-800'}`}>
              {stats.lowStockCount} {stats.lowStockCount === 1 ? 'product is' : 'products are'} running low on stock
            </span>
          </div>
          <Link
            href="/dashboard/inventory?low_stock=true"
            className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700 transition-colors font-medium"
          >
            View Inventory
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sales Bar Chart */}
        <div className={`rounded-lg p-5 transition-colors ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
          <h2 className={`text-sm font-semibold mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Sales Trend (Last 7 Days)</h2>
          {stats.salesTrend.length > 0 ? (
            <div className="flex items-end justify-between gap-2 h-48">
              {stats.salesTrend.map((day) => {
                const maxRevenue = Math.max(...stats.salesTrend.map(d => d.revenue))
                const heightPercentage = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                    <div className="relative w-full" style={{ height: `${Math.max(heightPercentage, 5)}%` }}>
                      <div className="absolute bottom-0 w-full bg-gradient-to-t from-cyan-600 to-cyan-500 rounded-t-lg hover:from-cyan-500 hover:to-cyan-400 transition-all cursor-pointer" style={{ height: '100%' }}>
                        {day.revenue > 0 && (
                          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-[10px] font-semibold whitespace-nowrap">
                            <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{formatCurrency(day.revenue, 0)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className={`text-[10px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {new Date(day.date).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi', weekday: 'short' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className={`text-center py-8 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No sales data available</p>
          )}
        </div>

        {/* Top Products */}
        <div className={`rounded-lg p-5 transition-colors ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
          <h2 className={`text-sm font-semibold mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Top Products (This Month)</h2>
          {stats.topProducts && stats.topProducts.length > 0 ? (
            <div className="space-y-2">
              {stats.topProducts.map((product: any, index: number) => (
                <div key={product.product_name || index} className={`flex items-center gap-3 p-2.5 rounded-lg ${isDarkMode ? 'bg-gray-800/30' : 'bg-gray-50'}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${isDarkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700'}`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-xs truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{product.product_name || 'Unknown'}</p>
                    <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                      {formatCurrency(Number(product.revenue || 0), 2)} · {product.quantity || 0} sold
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-center py-8 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No sales data available</p>
          )}
        </div>
      </div>

      {/* Recent Sales & Low Stock Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className={`rounded-lg overflow-hidden transition-colors ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
          <div className="p-4 flex items-center justify-between">
            <h2 className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Recent Sales</h2>
            {stats.recentSales.length > 0 && (
              <Link href="/dashboard/sales" className="text-xs text-cyan-600 hover:text-cyan-700 font-medium">
                View All →
              </Link>
            )}
          </div>
          <div className="px-4 pb-4">
            {stats.recentSales.length > 0 ? (
              <div className="space-y-2">
                {stats.recentSales.slice(0, 5).map((sale: any) => (
                  <div key={sale.id} className={`flex items-center justify-between p-2.5 rounded-lg ${isDarkMode ? 'bg-gray-800/30 hover:bg-gray-800/40' : 'bg-gray-50 hover:bg-gray-100'} transition-colors`}>
                    <div className="flex-1 min-w-0">
                      <p className={`font-mono text-[10px] font-semibold truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{sale.sale_number || `Sale #${sale.id}`}</p>
                      <p className={`text-[10px] truncate mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                        {new Date(sale.sale_date).toLocaleDateString('en-PK', { 
                          timeZone: 'Asia/Karachi',
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} · {sale.cashier_name || 'Unknown'}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className={`font-bold text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{formatCurrency(sale.total_amount, 2)}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-0.5 inline-block ${
                        sale.payment_status === 'Paid' ? 'bg-green-500/20 text-green-600' :
                        sale.payment_status === 'Partial' ? 'bg-red-500/20 text-red-600' :
                        'bg-yellow-500/20 text-yellow-600'
                      }`}>
                        {sale.payment_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-center py-8 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No recent sales</p>
            )}
          </div>
        </div>

        {/* Low Stock Products */}
        <div className={`rounded-lg overflow-hidden transition-colors ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
          <div className="p-4 flex items-center justify-between">
            <h2 className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Low Stock Products</h2>
            {stats.lowStockCount > 0 && (
              <span className="bg-orange-500/20 text-orange-600 px-2.5 py-1 rounded-full text-xs font-bold">
                {stats.lowStockCount}
              </span>
            )}
          </div>
          <div className="px-4 pb-4">
            {stats.lowStockProducts && stats.lowStockProducts.length > 0 ? (
              <div className="space-y-2">
                {stats.lowStockProducts.map((product: any) => (
                  <div key={product.id} className={`flex items-center justify-between p-2.5 rounded-lg ${isDarkMode ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-orange-500/20' : 'bg-orange-100'}`}>
                        <PackageIcon size={16} className="text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <p className={`font-medium text-xs truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{product.name}</p>
                        <p className={`text-[10px] truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <p className={`font-bold text-base ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{product.stock_quantity}</p>
                      <p className={`text-[10px] ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>in stock</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-center py-8 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>All products are well stocked</p>
            )}
          </div>
        </div>
      </div>
    </>
    )
}

