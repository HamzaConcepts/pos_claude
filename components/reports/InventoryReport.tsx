import { PackageIcon, CurrencyDollarIcon, ShoppingCartIcon } from '@phosphor-icons/react'
import { StatCard } from './StatCard'

interface InventoryReportProps {
  reportData: any
  formatCurrency: (value: number) => string
}

export function InventoryReport({ reportData, formatCurrency }: InventoryReportProps) {
  if (!reportData) return null

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Stock In"
          value={((reportData.summary?.totalStockIn ?? 0)).toString()}
          icon={<PackageIcon />}
          trendLabel="units"
        />
        <StatCard
          title="Stock Value"
          value={formatCurrency(reportData.summary?.totalStockValue ?? 0)}
          icon={<CurrencyDollarIcon />}
        />
        <StatCard
          title="Remaining"
          value={((reportData.summary?.totalRemaining ?? 0)).toString()}
          icon={<PackageIcon />}
          trendLabel="units"
        />
        <StatCard
          title="Sold"
          value={((reportData.summary?.totalSold ?? 0)).toString()}
          icon={<ShoppingCartIcon />}
          trendLabel="units"
        />
      </div>

      {/* Inventory List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 dark:bg-gray-700 dark:border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Product</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Purchased</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Remaining</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Sold</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Cost Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {Array.isArray(reportData.batches) && reportData.batches.map((batch: any) => (
                <tr key={batch.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{batch.products?.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{batch.products?.sku}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{batch.quantity_purchased}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{batch.quantity_remaining}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">
                    {batch.quantity_purchased - batch.quantity_remaining}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{formatCurrency(batch.cost_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
