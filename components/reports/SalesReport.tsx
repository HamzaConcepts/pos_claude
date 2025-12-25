import { ShoppingCart, DollarSign, CreditCard } from 'lucide-react'
import { StatCard } from './StatCard'

interface SalesReportProps {
  reportData: any
  formatCurrency: (value: number) => string
}

export function SalesReport({ reportData, formatCurrency }: SalesReportProps) {
  if (!reportData) return null

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Sales"
          value={((reportData.summary?.totalSales ?? 0)).toString()}
          icon={<ShoppingCart />}
          trend={reportData.summary?.totalRevenue ?? 0}
          trendLabel={formatCurrency(reportData.summary?.totalRevenue ?? 0)}
        />
        <StatCard
          title="Cash Sales"
          value={formatCurrency(reportData.summary?.totalCash ?? 0)}
          icon={<DollarSign />}
        />
        <StatCard
          title="Digital Sales"
          value={formatCurrency(reportData.summary?.totalDigital ?? 0)}
          icon={<CreditCard />}
        />
      </div>

      {/* Period Chart */}
      {reportData.periodData && Array.isArray(reportData.periodData) && reportData.periodData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Sales Trend</h3>
          <div className="space-y-2">
            {reportData.periodData.map((item: any) => (
              <div key={item.date} className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-32">{item.date}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                  <div
                    className="bg-black rounded-full h-6 flex items-center justify-end pr-2"
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

      {/* Top Products */}
      {reportData.topProducts && Array.isArray(reportData.topProducts) && reportData.topProducts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Top Products</h3>
          <div className="space-y-2">
            {reportData.topProducts.map((product: any, index: number) => (
              <div key={index} className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-gray-600">{product.quantity} units sold</p>
                </div>
                <p className="font-semibold">{formatCurrency(product.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Cashier</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Total</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Payment</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.isArray(reportData.sales) && reportData.sales.slice(0, 50).map((sale: any) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    {new Date(sale.sale_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm">{sale.cashier_name || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {formatCurrency(sale.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-sm">{sale.payment_method}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      sale.payment_status === 'Paid' ? 'bg-green-100 text-green-800' :
                      sale.payment_status === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
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
