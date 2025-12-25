import { TrendingDown, DollarSign, CreditCard } from 'lucide-react'
import { StatCard } from './StatCard'

interface ExpensesReportProps {
  reportData: any
  formatCurrency: (value: number) => string
}

export function ExpensesReport({ reportData, formatCurrency }: ExpensesReportProps) {
  if (!reportData) return null

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Expenses"
          value={formatCurrency(reportData.summary?.totalAmount ?? 0)}
          icon={<TrendingDown />}
          trend={reportData.summary?.totalExpenses ?? 0}
          trendLabel="expenses"
        />
        <StatCard
          title="Cash Expenses"
          value={formatCurrency(reportData.summary?.totalCash ?? 0)}
          icon={<DollarSign />}
        />
        <StatCard
          title="Digital Expenses"
          value={formatCurrency(reportData.summary?.totalDigital ?? 0)}
          icon={<CreditCard />}
        />
      </div>

      {/* Period Chart */}
      {reportData.periodData && Array.isArray(reportData.periodData) && reportData.periodData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Expenses Trend</h3>
          <div className="space-y-2">
            {reportData.periodData.map((item: any) => (
              <div key={item.date} className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-32">{item.date}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                  <div
                    className="bg-red-500 rounded-full h-6 flex items-center justify-end pr-2"
                    style={{
                      width: `${Math.min((item.value / Math.max(...reportData.periodData.map((d: any) => d.value))) * 100, 100)}%`
                    }}
                  >
                    <span className="text-xs text-white font-medium">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {reportData.categoryBreakdown && Array.isArray(reportData.categoryBreakdown) && reportData.categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Expenses by Category</h3>
          <div className="space-y-2">
            {reportData.categoryBreakdown.map((cat: any, index: number) => (
              <div key={index} className="flex items-center justify-between py-2 border-b">
                <span className="font-medium">{cat.category}</span>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(cat.total)}</p>
                  <p className="text-sm text-gray-600">{cat.count} expenses</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Category</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.isArray(reportData.expenses) && reportData.expenses.slice(0, 50).map((expense: any) => (
                <tr key={expense.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    {new Date(expense.expense_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm">{expense.category}</td>
                  <td className="px-4 py-3 text-sm">{expense.description}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm">{expense.payment_method || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
