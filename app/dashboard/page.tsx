'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, TrendingUp, DollarSign, ShoppingBag, Package } from 'lucide-react'
import Link from 'next/link'
import type { DashboardStats } from '@/lib/types'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard/stats')
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
    }
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
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded border-2 border-black">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-text-secondary">Today's Sales</h3>
            <ShoppingBag size={20} className="text-text-secondary" />
          </div>
          <p className="text-3xl font-bold">${stats.todaySales.revenue.toFixed(2)}</p>
          <p className="text-sm text-text-secondary mt-1">
            {stats.todaySales.count} {stats.todaySales.count === 1 ? 'sale' : 'sales'}
          </p>
        </div>

        <div className="bg-white p-6 rounded border-2 border-black">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-text-secondary">Monthly Sales</h3>
            <TrendingUp size={20} className="text-text-secondary" />
          </div>
          <p className="text-3xl font-bold">${stats.monthlySales.revenue.toFixed(2)}</p>
          <p className="text-sm text-text-secondary mt-1">
            {stats.monthlySales.count} {stats.monthlySales.count === 1 ? 'sale' : 'sales'}
          </p>
        </div>

        <div className="bg-white p-6 rounded border-2 border-black">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-text-secondary">Monthly Expenses</h3>
            <DollarSign size={20} className="text-text-secondary" />
          </div>
          <p className="text-3xl font-bold">${stats.monthlyExpenses.toFixed(2)}</p>
          <p className="text-sm text-text-secondary mt-1">This month</p>
        </div>

        <div className="bg-white p-6 rounded border-2 border-black">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-text-secondary">Net Profit</h3>
            <DollarSign size={20} className="text-text-secondary" />
          </div>
          <p className="text-3xl font-bold">${stats.netProfit.toFixed(2)}</p>
          <p className="text-sm text-text-secondary mt-1">Monthly</p>
        </div>
      </div>

      {/* Low Stock Alert */}
      {stats.lowStockCount > 0 && (
        <div className="bg-status-warning text-white p-4 rounded border-2 border-black mb-8">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={24} />
            <h3 className="font-bold text-lg">Low Stock Alert</h3>
          </div>
          <p className="mb-3">
            {stats.lowStockCount} {stats.lowStockCount === 1 ? 'product is' : 'products are'} running low on stock
          </p>
          <Link
            href="/dashboard/inventory?low_stock=true"
            className="inline-block bg-white text-black px-4 py-2 rounded hover:bg-gray-100 transition-colors font-medium"
          >
            View Inventory
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sales Trend */}
        <div className="bg-white p-6 rounded border-2 border-black">
          <h2 className="text-xl font-bold mb-4">Sales Trend (Last 7 Days)</h2>
          {stats.salesTrend.length > 0 ? (
            <div className="space-y-2">
              {stats.salesTrend.map((day) => (
                <div key={day.date} className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-2 flex-1 mx-4">
                    <div className="flex-1 bg-bg-secondary rounded-full h-2">
                      <div
                        className="bg-black h-2 rounded-full"
                        style={{
                          width: `${Math.min((day.revenue / Math.max(...stats.salesTrend.map(d => d.revenue))) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                  <span className="font-bold">${day.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary text-center py-4">No sales data available</p>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-white p-6 rounded border-2 border-black">
          <h2 className="text-xl font-bold mb-4">Top Products (This Month)</h2>
          {stats.topProducts.length > 0 ? (
            <div className="space-y-3">
              {stats.topProducts.map((product, index) => (
                <div key={product.product_name} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{product.product_name}</p>
                    <p className="text-sm text-text-secondary">
                      Revenue: ${product.revenue.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary text-center py-4">No sales data available</p>
          )}
        </div>
      </div>

      {/* Recent Sales & Low Stock Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="bg-white rounded border-2 border-black">
          <div className="p-4 bg-black text-white">
            <h2 className="text-xl font-bold">Recent Sales</h2>
          </div>
          <div className="p-4">
            {stats.recentSales.length > 0 ? (
              <div className="space-y-3">
                {stats.recentSales.slice(0, 5).map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between p-3 border-2 border-black rounded">
                    <div className="flex-1">
                      <p className="font-mono text-sm">{sale.sale_number}</p>
                      <p className="text-sm text-text-secondary">
                        {new Date(sale.sale_date).toLocaleString()} • {sale.users?.full_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${sale.total_amount.toFixed(2)}</p>
                      <p className="text-xs text-text-secondary">{sale.payment_method}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-center py-8">No recent sales</p>
            )}
            {stats.recentSales.length > 0 && (
              <Link
                href="/sales"
                className="block mt-4 text-center py-2 border-2 border-black rounded hover:bg-bg-secondary transition-colors"
              >
                View All Sales
              </Link>
            )}
          </div>
        </div>

        {/* Low Stock Products */}
        <div className="bg-white rounded border-2 border-black">
          <div className="p-4 bg-black text-white flex items-center justify-between">
            <h2 className="text-xl font-bold">Low Stock Products</h2>
            {stats.lowStockCount > 0 && (
              <span className="bg-white text-black px-2 py-1 rounded text-sm font-bold">
                {stats.lowStockCount}
              </span>
            )}
          </div>
          <div className="p-4">
            {stats.lowStockProducts && stats.lowStockProducts.length > 0 ? (
              <div className="space-y-3">
                {stats.lowStockProducts.map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between p-3 border-2 border-status-warning rounded">
                    <div className="flex items-center gap-2">
                      <Package size={20} className="text-text-secondary" />
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-text-secondary">{product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{product.stock_quantity}</p>
                      <p className="text-xs text-text-secondary">in stock</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary text-center py-8">All products are well stocked</p>
            )}
            {stats.lowStockCount > 5 && (
              <Link
                href="/dashboard/inventory?low_stock=true"
                className="block mt-4 text-center py-2 border-2 border-black rounded hover:bg-bg-secondary transition-colors"
              >
                View All Low Stock Items
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
