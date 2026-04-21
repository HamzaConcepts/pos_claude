'use client'

import { useEffect, useRef, useState } from 'react'
import { WarningIcon, TrendUpIcon, CurrencyDollarIcon, ShoppingBagIcon, PackageIcon, ArrowsClockwiseIcon } from '@phosphor-icons/react'
import Link from 'next/link'
import type { DashboardStats } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { useCurrency } from '@/lib/currency-context'
import DashboardSkeleton from '@/components/skeletons/DashboardSkeleton'
import { useDashboardStats } from '@/hooks/useStoreData'
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

export default function DashboardPage() {
  const { currency, formatCurrency } = useCurrency()
  const router = useRouter()
  const salesChartContainerRef = useRef<HTMLDivElement | null>(null)
  const [salesChartSize, setSalesChartSize] = useState({ width: 0, height: 0 })

  // SWR-powered data fetching with auto-refresh
  const { data: stats, error: fetchError, isLoading, isValidating, mutate } = useDashboardStats()

  const handleRefresh = () => {
    mutate()
  }

  useEffect(() => {
    const container = salesChartContainerRef.current
    if (!container) return

    const updateChartSize = () => {
      const width = Math.floor(container.clientWidth)
      const height = Math.floor(container.clientHeight)

      if (width <= 0 || height <= 0) {
        return
      }

      setSalesChartSize((previous) => {
        if (previous.width === width && previous.height === height) {
          return previous
        }

        return { width, height }
      })
    }

    updateChartSize()

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => {
        updateChartSize()
      })

      resizeObserver.observe(container)
      return () => resizeObserver.disconnect()
    }

    window.addEventListener('resize', updateChartSize)
    return () => {
      window.removeEventListener('resize', updateChartSize)
    }
  }, [])

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (fetchError || !stats) {
    return (
      <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded">
        {fetchError?.message || 'Failed to load dashboard'}
      </div>
    )
  }

  const salesTrendChartData = stats.salesTrend.map((day: { date: string; revenue: number }) => ({
    ...day,
    dayLabel: new Date(day.date).toLocaleDateString('en-PK', {
      timeZone: 'Asia/Karachi',
      weekday: 'short',
    }),
  }))

  const salesChartWidth = salesChartSize.width > 0 ? salesChartSize.width : 320
  const salesChartHeight = salesChartSize.height > 0 ? salesChartSize.height : 192

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-1 text-gray-900 dark:text-white">Overview</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Welcome back! Here's what's happening today.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isValidating}
          className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors disabled:bg-gray-400"
        >
          <ArrowsClockwiseIcon size={16} className={isValidating ? 'animate-spin' : ''} />
          <span>{isValidating ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Total Sales (Revenue) */}
        <div className="rounded-lg p-4 transition-colors bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-500/20">
              <CurrencyDollarIcon size={18} className="text-cyan-600" />
            </div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Revenue</p>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-200">{formatCurrency(stats.monthlySales.revenue, 2)}</p>
          <p className="text-[10px] mt-1.5 text-gray-500">This month</p>
        </div>

        {/* COGS */}
        <div className="rounded-lg p-4 transition-colors bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-500/20">
              <TrendUpIcon size={18} className="text-orange-600" />
            </div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">COGS</p>
          </div>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(stats.monthlyCOGS || 0, 2)}</p>
          <p className="text-[10px] mt-1.5 text-gray-500">Cost of goods sold</p>
        </div>

        {/* Gross Profit */}
        <div className="rounded-lg p-4 transition-colors bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-500/20">
              <TrendUpIcon size={18} className="text-green-600" />
            </div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Gross Profit</p>
          </div>
          <p className={`text-xl font-bold ${(stats.grossProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(stats.grossProfit || 0, 2)}
          </p>
          <p className="text-[10px] mt-1.5 text-gray-500">Revenue - COGS</p>
        </div>

        {/* Operating Expenses */}
        <div className="rounded-lg p-4 transition-colors bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-lg bg-red-50 dark:bg-red-500/20">
              <TrendUpIcon size={18} className="text-red-600" />
            </div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Expenses</p>
          </div>
          <p className="text-xl font-bold text-red-600">{formatCurrency(stats.monthlyExpenses, 2)}</p>
          <p className="text-[10px] mt-1.5 text-gray-500">{formatCurrency(stats.todayExpenses || 0, 2)} today</p>
        </div>

        {/* Net Profit */}
        <div className="rounded-lg p-4 transition-colors bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/20">
              <TrendUpIcon size={18} className="text-blue-600" />
            </div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Net Profit</p>
          </div>
          <p className={`text-xl font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(stats.netProfit, 2)}
          </p>
          <p className="text-[10px] mt-1.5 text-gray-500">Gross profit - Expenses</p>
        </div>
      </div>

      {/* Quick Stats Row - Orders Count */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg p-4 transition-colors bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-500/20">
              <ShoppingBagIcon size={18} className="text-purple-600" />
            </div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Orders This Month</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-200">{stats.monthlySales.count}</p>
          <p className="text-[10px] mt-1.5 text-gray-500">{stats.todaySales.count} today</p>
        </div>

        <div className="rounded-lg p-4 lg:col-span-3 transition-colors bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-300">Top Expense Categories</p>
            <Link href="/dashboard/expenses" className="text-[10px] text-cyan-600 hover:text-cyan-700">
              View All →
            </Link>
          </div>
          {stats.expensesByCategory && stats.expensesByCategory.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {stats.expensesByCategory.slice(0, 3).map((cat: any) => (
                <div key={cat.category}>
                  <p className="text-[10px] mb-1 text-gray-600 dark:text-gray-500">{cat.category}</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-300">{formatCurrency(cat.total, 2)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No expenses recorded</p>
          )}
        </div>
      </div>

      {/* Low Stock Alert */}
      {stats.lowStockCount > 0 && (
        <div className="p-4 rounded-lg mb-6 flex items-center justify-between bg-orange-50 shadow-sm dark:bg-orange-500/10 dark:shadow-none">
          <div className="flex items-center gap-2">
            <WarningIcon size={18} className="text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
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
        <div className="rounded-lg p-5 transition-colors bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <h2 className="text-sm font-semibold mb-4 text-gray-900 dark:text-gray-300">Sales Trend (Last 7 Days)</h2>
          {stats.salesTrend.length > 0 ? (
            <div ref={salesChartContainerRef} className="h-48 min-w-0">
              <BarChart
                width={salesChartWidth}
                height={salesChartHeight}
                data={salesTrendChartData}
                margin={{ top: 14, right: 6, left: 6, bottom: 0 }}
              >
                <XAxis
                  dataKey="dayLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(Number(value), 0), 'Sales']}
                  cursor={{ fill: 'rgba(8, 145, 178, 0.08)' }}
                />
                <Bar dataKey="revenue" fill="#0891b2" radius={[6, 6, 0, 0]} />
              </BarChart>
            </div>
          ) : (
            <p className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">No sales data available</p>
          )}
        </div>

        {/* Top Products */}
        <div className="rounded-lg p-5 transition-colors bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <h2 className="text-sm font-semibold mb-4 text-gray-900 dark:text-gray-300">Top Products (This Month)</h2>
          {stats.topProducts && stats.topProducts.length > 0 ? (
            <div className="space-y-2">
              {stats.topProducts.map((product: any, index: number) => (
                <div key={product.product_name || index} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/30">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs truncate text-gray-900 dark:text-gray-300">{product.product_name || 'Unknown'}</p>
                    <p className="text-[10px] text-gray-600 dark:text-gray-500">
                      {formatCurrency(Number(product.revenue || 0), 2)} · {product.quantity || 0} sold
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">No sales data available</p>
          )}
        </div>
      </div>

      {/* Recent Sales & Low Stock Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="rounded-lg overflow-hidden transition-colors bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="p-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Recent Sales</h2>
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
                  <div key={sale.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/30 dark:hover:bg-gray-800/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[10px] font-semibold truncate text-gray-900 dark:text-gray-300">{sale.sale_number || `Sale #${sale.id}`}</p>
                      <p className="text-[10px] truncate mt-0.5 text-gray-600 dark:text-gray-500">
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
                      <p className="font-bold text-xs text-gray-900 dark:text-gray-300">{formatCurrency(sale.total_amount, 2)}</p>
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
              <p className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">No recent sales</p>
            )}
          </div>
        </div>

        {/* Low Stock Products */}
        <div className="rounded-lg overflow-hidden transition-colors bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
          <div className="p-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-300">Low Stock Products</h2>
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
                  <div key={product.id} className="flex items-center justify-between p-2.5 rounded-lg bg-orange-50 dark:bg-orange-500/10">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-500/20">
                        <PackageIcon size={16} className="text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-xs truncate text-gray-900 dark:text-gray-300">{product.name}</p>
                        <p className="text-[10px] truncate text-gray-600 dark:text-gray-500">{product.sku}</p>
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <p className="font-bold text-base text-gray-900 dark:text-gray-300">{product.stock_quantity}</p>
                      <p className="text-[10px] text-gray-600 dark:text-gray-500">in stock</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">All products are well stocked</p>
            )}
          </div>
        </div>
      </div>
    </>
    )
}

