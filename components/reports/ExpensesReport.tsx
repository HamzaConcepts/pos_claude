import { TrendDownIcon, CurrencyDollarIcon, CreditCardIcon } from '@phosphor-icons/react'
import { StatCard } from './StatCard'
import { useDarkMode } from '@/hooks/useDarkMode'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ExpensesReportProps {
  reportData: any
  formatCurrency: (value: number) => string
}

export function ExpensesReport({ reportData, formatCurrency }: ExpensesReportProps) {
  const isDarkMode = useDarkMode()
  if (!reportData) return null

  // Process period data for daily chart
  const expensesTrendData = reportData.periodData && Array.isArray(reportData.periodData) 
    ? reportData.periodData.map((item: any) => ({
        date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        expenses: item.value
      }))
    : []

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Total Expenses</h3>
            <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
              <TrendDownIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(reportData.summary?.totalAmount ?? 0)}
          </div>
          <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">
            {reportData.summary?.totalExpenses ?? 0} transactions
          </div>
        </div>
        
        <div className="p-3 rounded-lg border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Cash Expenses</h3>
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
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Digital Expenses</h3>
            <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
              <CreditCardIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(reportData.summary?.totalDigital ?? 0)}
          </div>
        </div>
      </div>

      {/* Expenses Trend Chart */}
      {expensesTrendData.length > 0 && (
        <div className="p-4 rounded-lg border mb-4 bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-100">Expenses Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={expensesTrendData}>
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
                dataKey="expenses" 
                stroke={isDarkMode ? '#f87171' : '#ef4444'} 
                name="Expenses"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category Breakdown */}
      {reportData.categoryBreakdown && Array.isArray(reportData.categoryBreakdown) && reportData.categoryBreakdown.length > 0 && (
        <div className="p-4 rounded-lg border mb-4 bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-100">Expenses by Category</h3>
          <div className="space-y-2">
            {reportData.categoryBreakdown.map((cat: any, index: number) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{cat.category}</span>
                <div className="text-right">
                  <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{formatCurrency(cat.total)}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{cat.count} expenses</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses List */}
      <div className="rounded-lg border overflow-hidden bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {Array.isArray(reportData.expenses) && reportData.expenses.slice(0, 50).map((expense: any) => (
                <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">
                    {new Date(expense.expense_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{expense.category}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{expense.description}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{expense.payment_method || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
