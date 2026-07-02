import { useEffect, useMemo, useState } from 'react'
import { PackageIcon, CurrencyDollarIcon, ShoppingCartIcon } from '@phosphor-icons/react'
import { StatCard } from './StatCard'

const INVENTORY_PAGE_SIZE = 15

interface InventoryReportProps {
  reportData: any
  formatCurrency: (value: number) => string
}

export function InventoryReport({ reportData, formatCurrency }: InventoryReportProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  if (!reportData) return null

  const batches = Array.isArray(reportData.batches) ? reportData.batches : []

  const filteredBatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return batches

    return batches.filter((batch: any) => {
      const productName = String(batch.products?.name || '').toLowerCase()
      const sku = String(batch.products?.sku || '').toLowerCase()
      return productName.includes(query) || sku.includes(query)
    })
  }, [batches, searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, reportData])

  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / INVENTORY_PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const visibleBatches = filteredBatches.slice((safeCurrentPage - 1) * INVENTORY_PAGE_SIZE, safeCurrentPage * INVENTORY_PAGE_SIZE)
  const pageStartIndex = filteredBatches.length === 0 ? 0 : (safeCurrentPage - 1) * INVENTORY_PAGE_SIZE + 1
  const pageEndIndex = Math.min(safeCurrentPage * INVENTORY_PAGE_SIZE, filteredBatches.length)

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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Search Product</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name or SKU"
              className="w-full md:w-80 px-3 py-2 border border-gray-300 rounded text-sm bg-white text-gray-900 focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Showing {filteredBatches.length === 0 ? 0 : pageStartIndex}-{pageEndIndex} of {filteredBatches.length} records
          </div>
        </div>

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
              {visibleBatches.length > 0 ? (
                visibleBatches.map((batch: any) => (
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
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {searchQuery.trim() ? 'No inventory records match your search.' : 'No inventory records found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Page {safeCurrentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safeCurrentPage <= 1}
              className="px-3 py-1.5 text-xs rounded border border-gray-300 bg-white text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="px-3 py-1.5 text-xs rounded border border-gray-300 bg-white text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
