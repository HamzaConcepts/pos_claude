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
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Product</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Purchased</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Remaining</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Sold</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Cost Price</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.isArray(reportData.batches) && reportData.batches.map((batch: any) => (
                <tr key={batch.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{batch.products?.name}</td>
                  <td className="px-4 py-3 text-sm">{batch.products?.sku}</td>
                  <td className="px-4 py-3 text-sm">{batch.quantity_purchased}</td>
                  <td className="px-4 py-3 text-sm">{batch.quantity_remaining}</td>
                  <td className="px-4 py-3 text-sm">
                    {batch.quantity_purchased - batch.quantity_remaining}
                  </td>
                  <td className="px-4 py-3 text-sm">{formatCurrency(batch.cost_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
