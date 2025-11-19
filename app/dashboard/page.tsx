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
  const router = useRouter()

  useEffect(() => {
    fetchDashboardStats()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardStats(true)
    }, 30000)

    return () => clearInterval(interval)
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Loading dashboard...</div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="p-4 bg-status-error text-white rounded">
        {error || 'Failed to load dashboard'}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-text-secondary">Welcome back! Here's what's happening today.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors disabled:bg-gray-400"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Big Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total Sales */}
        <div className="bg-black text-white p-6 rounded shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign size={24} />
            <p className="text-sm opacity-80">Total Sales</p>
          </div>
          <p className="text-3xl font-bold mb-1">${stats.monthlySales.revenue.toFixed(2)}</p>
          <p className="text-xs opacity-70">This month</p>
        </div>

        {/* Orders Completed */}
        <div className="bg-white p-6 rounded border-2 border-black shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag size={24} />
            <p className="text-sm text-text-secondary">Orders</p>
          </div>
          <p className="text-3xl font-bold mb-1">{stats.monthlySales.count}</p>
          <p className="text-xs text-text-secondary">{stats.todaySales.count} today</p>
        </div>

        {/* Monthly Expenses */}
        <div className="bg-white p-6 rounded border-2 border-black shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={24} className="text-status-error" />
            <p className="text-sm text-text-secondary">Expenses</p>
          </div>
          <p className="text-3xl font-bold text-status-error mb-1">${stats.monthlyExpenses.toFixed(2)}</p>
          <p className="text-xs text-text-secondary">${stats.todayExpenses?.toFixed(2) || '0.00'} today</p>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-6 rounded border-2 border-black shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={24} />
            <p className="text-sm text-text-secondary">Net Profit</p>
          </div>
          <p className={`text-3xl font-bold mb-1 ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${stats.netProfit.toFixed(2)}
          </p>
          <p className="text-xs text-text-secondary">This month</p>
        </div>
      </div>

      {/* Quick Stats & Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded border-2 border-black">
          <p className="text-xs text-text-secondary mb-1">Low Stock Items</p>
          <p className="text-2xl font-bold">{stats.lowStockCount}</p>
        </div>

        <div className="bg-white p-4 rounded border-2 border-black lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">Top Expense Categories</p>
            <Link href="/dashboard/expenses" className="text-xs text-black hover:underline">
              View All →
            </Link>
          </div>
          {stats.expensesByCategory && stats.expensesByCategory.length > 0 ? (
            <div className="flex gap-4">
              {stats.expensesByCategory.slice(0, 3).map((cat: any) => (
                <div key={cat.category} className="flex-1">
                  <p className="text-xs text-text-secondary">{cat.category}</p>
                  <p className="text-lg font-bold">${cat.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary">No expenses recorded</p>
          )}
        </div>
      </div>

      {/* Low Stock Alert */}
      {stats.lowStockCount > 0 && (
        <div className="bg-status-warning text-white p-4 rounded border-2 border-black mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} />
            <span className="font-medium">
              {stats.lowStockCount} {stats.lowStockCount === 1 ? 'product is' : 'products are'} running low on stock
            </span>
          </div>
          <Link
            href="/dashboard/inventory?low_stock=true"
            className="bg-white text-black px-4 py-2 rounded hover:bg-gray-100 transition-colors font-medium text-sm"
          >
            View Inventory
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Sales Trend */}
        <div className="bg-white p-4 rounded border-2 border-black">
          <h2 className="text-lg font-bold mb-3">Sales Trend (Last 7 Days)</h2>
          {stats.salesTrend.length > 0 ? (
            <div className="space-y-2">
              {stats.salesTrend.map((day) => (
                <div key={day.date} className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary w-16">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex-1 mx-3 bg-bg-secondary rounded-full h-2">
                    <div
                      className="bg-black h-2 rounded-full"
                      style={{
                        width: `${Math.min((day.revenue / Math.max(...stats.salesTrend.map(d => d.revenue))) * 100, 100)}%`
                      }}
                    />
                  </div>
                  <span className="font-bold text-sm">${day.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary text-center py-4 text-sm">No sales data available</p>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-white p-4 rounded border-2 border-black">
          <h2 className="text-lg font-bold mb-3">Top Products (This Month)</h2>
          {stats.topProducts.length > 0 ? (
            <div className="space-y-2">
              {stats.topProducts.map((product, index) => (
                <div key={product.product_name} className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{product.product_name}</p>
                    <p className="text-xs text-text-secondary">
                      ${product.revenue.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary text-center py-4 text-sm">No sales data available</p>
          )}
        </div>
      </div>

      {/* Recent Sales & Low Stock Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Sales */}
        <div className="bg-white rounded border-2 border-black">
          <div className="p-3 bg-black text-white flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent Sales</h2>
            {stats.recentSales.length > 0 && (
              <Link href="/dashboard/sales" className="text-xs hover:underline">
                View All →
              </Link>
            )}
          </div>
          <div className="p-3">
            {stats.recentSales.length > 0 ? (
              <div className="space-y-2">
                {stats.recentSales.slice(0, 5).map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between p-2 border border-black rounded">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs truncate">{sale.sale_number}</p>
                      <p className="text-xs text-text-secondary truncate">
                        {new Date(sale.sale_date).toLocaleDateString()} • {sale.managers?.full_name || 'Cashier'}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="font-bold text-sm">${sale.total_amount.toFixed(2)}</p>
                      <p className="text-xs text-text-secondary">{sale.payment_method}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-center py-6 text-sm">No recent sales</p>
            )}
          </div>
        </div>

        {/* Low Stock Products */}
        <div className="bg-white rounded border-2 border-black">
          <div className="p-3 bg-black text-white flex items-center justify-between">
            <h2 className="text-lg font-bold">Low Stock Products</h2>
            {stats.lowStockCount > 0 && (
              <span className="bg-white text-black px-2 py-1 rounded text-xs font-bold">
                {stats.lowStockCount}
              </span>
            )}
          </div>
          <div className="p-3">
            {stats.lowStockProducts && stats.lowStockProducts.length > 0 ? (
              <div className="space-y-2">
                {stats.lowStockProducts.map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between p-2 border border-status-warning rounded">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Package size={16} className="text-text-secondary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-text-secondary truncate">{product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <p className="font-bold text-sm">{product.stock_quantity}</p>
                      <p className="text-xs text-text-secondary">in stock</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-center py-6 text-sm">All products are well stocked</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
