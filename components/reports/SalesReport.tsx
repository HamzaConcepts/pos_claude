import { ShoppingCartIcon, CurrencyDollarIcon, CreditCardIcon } from '@phosphor-icons/react'
import { StatCard } from './StatCard'
import { useDarkMode } from '@/hooks/useDarkMode'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface SalesReportProps {
  reportData: any
  formatCurrency: (value: number) => string
}

export function SalesReport({ reportData, formatCurrency }: SalesReportProps) {
  const isDarkMode = useDarkMode()
  if (!reportData) return null

  // Process period data for daily chart
  const salesTrendData = reportData.periodData && Array.isArray(reportData.periodData) 
    ? reportData.periodData.map((item: any) => ({
        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sales: item.value
      }))
    : []

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Total Sales</h3>
            <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
              <ShoppingCartIcon className="w-4 h-4 text-gray-700 dark:text-cyan-400" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {reportData.summary?.totalSales ?? 0}
          </div>
          <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">
            {formatCurrency(reportData.summary?.totalRevenue ?? 0)}
          </div>
        </div>
        
        <div className="p-3 rounded-lg border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Cash Sales</h3>
            <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
              <CurrencyDollarIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(reportData.summary?.totalCash ?? 0)}
          </div>
        </div>
        
        <div className="p-3 rounded-lg border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Digital Sales</h3>
            <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
              <CreditCardIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(reportData.summary?.totalDigital ?? 0)}
          </div>
        </div>
      </div>

      {/* Sales Trend Chart */}
      {salesTrendData.length > 0 && (
        <div className="p-4 rounded-lg border mb-4 bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-100">Sales Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
              <XAxis 
                dataKey="date" 
                stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                  border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  color: isDarkMode ? '#f3f4f6' : '#111827'
                }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="sales" 
                stroke={isDarkMode ? '#22d3ee' : '#0891b2'} 
                name="Sales"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Products */}
      {reportData.topProducts && Array.isArray(reportData.topProducts) && reportData.topProducts.length > 0 && (
        <div className="p-4 rounded-lg border mb-4 bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-100">Top Products</h3>
          <div className="space-y-2">
            {reportData.topProducts.map((product: any, index: number) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{product.name}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{product.quantity} units sold</p>
                </div>
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{formatCurrency(product.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales List */}
      <div className="rounded-lg border overflow-hidden bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Cashier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {Array.isArray(reportData.sales) && reportData.sales.slice(0, 50).map((sale: any) => (
                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">
                    {new Date(sale.sale_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{sale.cashier_name || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(sale.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{sale.payment_method}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      sale.payment_status === 'Paid' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                        : sale.payment_status === 'Partial' 
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                    }`}>
                      {sale.payment_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
