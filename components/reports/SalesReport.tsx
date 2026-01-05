import { ShoppingCart, DollarSign, CreditCard } from 'lucide-react'
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
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Total Sales</h3>
            <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <ShoppingCart className={`w-4 h-4 ${isDarkMode ? 'text-cyan-400' : 'text-gray-700'}`} />
            </div>
          </div>
          <div className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            {reportData.summary?.totalSales ?? 0}
          </div>
          <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {formatCurrency(reportData.summary?.totalRevenue ?? 0)}
          </div>
        </div>
        
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Cash Sales</h3>
            <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <DollarSign className={`w-4 h-4 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
            </div>
          </div>
          <div className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            {formatCurrency(reportData.summary?.totalCash ?? 0)}
          </div>
        </div>
        
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Digital Sales</h3>
            <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <CreditCard className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
          </div>
          <div className={`text-xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            {formatCurrency(reportData.summary?.totalDigital ?? 0)}
          </div>
        </div>
      </div>

      {/* Sales Trend Chart */}
      {salesTrendData.length > 0 && (
        <div className={`p-4 rounded-lg border mb-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-gray-100' : 'text-gray-700'}`}>Sales Trend</h3>
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
        <div className={`p-4 rounded-lg border mb-4 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-gray-100' : 'text-gray-700'}`}>Top Products</h3>
          <div className="space-y-2">
            {reportData.topProducts.map((product: any, index: number) => (
              <div key={index} className={`flex items-center justify-between py-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div>
                  <p className={`font-medium text-sm ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{product.name}</p>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{product.quantity} units sold</p>
                </div>
                <p className={`font-semibold text-sm ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{formatCurrency(product.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales List */}
      <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`border-b ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Date</th>
                <th className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Cashier</th>
                <th className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Total</th>
                <th className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Payment</th>
                <th className={`px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Status</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {Array.isArray(reportData.sales) && reportData.sales.slice(0, 50).map((sale: any) => (
                <tr key={sale.id} className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                  <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                    {new Date(sale.sale_date).toLocaleDateString()}
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{sale.cashier_name || 'N/A'}</td>
                  <td className={`px-4 py-3 text-sm font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    {formatCurrency(sale.total_amount)}
                  </td>
                  <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{sale.payment_method}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      sale.payment_status === 'Paid' 
                        ? (isDarkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-800')
                        : sale.payment_status === 'Partial' 
                        ? (isDarkMode ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-800')
                        : (isDarkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-red-800')
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
