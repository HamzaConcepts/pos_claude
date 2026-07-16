import { UsersThreeIcon, TruckIcon } from '@phosphor-icons/react'

interface ProfitReportProps {
  reportData: any
  formatCurrency: (value: number) => string
}

export function ProfitReport({ reportData, formatCurrency }: ProfitReportProps) {
  if (!reportData) return null

  const maxTrendMagnitude = reportData.periodData && Array.isArray(reportData.periodData) && reportData.periodData.length > 0
    ? Math.max(...reportData.periodData.map((d: any) => Math.abs(d.netProfit ?? d.value ?? 0)))
    : 0

  const trendWidthClasses = [
    'w-0',
    'w-[5%]',
    'w-[10%]',
    'w-[15%]',
    'w-[20%]',
    'w-[25%]',
    'w-[30%]',
    'w-[35%]',
    'w-[40%]',
    'w-[45%]',
    'w-[50%]',
    'w-[55%]',
    'w-[60%]',
    'w-[65%]',
    'w-[70%]',
    'w-[75%]',
    'w-[80%]',
    'w-[85%]',
    'w-[90%]',
    'w-[95%]',
    'w-full'
  ]

  const getTrendWidthClass = (value: number) => {
    if (maxTrendMagnitude <= 0) return trendWidthClasses[0]

    const ratio = Math.min(Math.abs(value) / maxTrendMagnitude, 1)
    const bucket = Math.round(ratio * (trendWidthClasses.length - 1))
    return trendWidthClasses[bucket]
  }

  const showDueCards = reportData.summary?.showDueCards ?? false

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Total Revenue</h3>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(reportData.summary?.totalRevenue ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Cost of Goods Sold</h3>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {formatCurrency(reportData.summary?.cogs ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Gross Profit</h3>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(reportData.summary?.grossProfit ?? 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Operating Expenses</h3>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(reportData.summary?.totalExpenses ?? 0)}
          </p>
        </div>
        {showDueCards ? (
          <>
            <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">Customer Due</h3>
                <UsersThreeIcon className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(reportData.summary?.customerDue ?? 0)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">Supplier Due</h3>
                <TruckIcon className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(reportData.summary?.supplierDue ?? 0)}
              </p>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700 md:col-span-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Due balances</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Due values are only shown for the All Time range.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Net Profit</h3>
          <p className={`text-2xl font-bold ${(reportData.summary?.netProfit ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(reportData.summary?.netProfit ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Profit Margin</h3>
          <p className={`text-2xl font-bold ${(reportData.summary?.profitMargin ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {(reportData.summary?.profitMargin ?? 0).toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 dark:bg-gray-800 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Profit & Loss Statement</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="font-medium text-gray-900 dark:text-gray-100">Revenue</span>
            <span className="text-green-600 dark:text-green-400 font-semibold">
              +{formatCurrency(reportData.summary?.totalRevenue ?? 0)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="font-medium pl-4 text-gray-900 dark:text-gray-100">- Cost of Goods Sold</span>
            <span className="text-red-600 dark:text-red-400 font-semibold">
              -{formatCurrency(reportData.summary?.cogs ?? 0)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200 bg-gray-50 px-2 dark:border-gray-700 dark:bg-gray-700/50">
            <span className="font-semibold text-gray-900 dark:text-gray-100">= Gross Profit</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(reportData.summary?.grossProfit ?? 0)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="font-medium pl-4 text-gray-900 dark:text-gray-100">- Operating Expenses</span>
            <span className="text-red-600 dark:text-red-400 font-semibold">
              -{formatCurrency(reportData.summary?.totalExpenses ?? 0)}
            </span>
          </div>
          <div className="flex justify-between py-3 bg-gray-100 px-2 rounded dark:bg-gray-700">
            <span className="font-bold text-lg text-gray-900 dark:text-gray-100">= Net Profit</span>
            <span className={`font-bold text-lg ${(reportData.summary?.netProfit ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(reportData.summary?.netProfit ?? 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Profit Trend */}
      {reportData.periodData && Array.isArray(reportData.periodData) && reportData.periodData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Net Profit Trend</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Each bar below shows the net profit for one period in the selected range. The total at the top is the combined net profit for the full range.
            </p>
          </div>
          <div className="space-y-2">
            {reportData.periodData.map((item: any) => {
              const trendValue = item.netProfit ?? item.value ?? 0
              return (
                <div
                  key={item.date}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                    trendValue >= 0
                      ? 'border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/20'
                      : 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`h-6 w-1 rounded-full ${
                        trendValue >= 0 ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item.date}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div
                        className={`h-2.5 rounded-full ${
                          trendValue >= 0 ? 'bg-green-500' : 'bg-red-500'
                        } ${getTrendWidthClass(trendValue || 0)}`}
                      />
                    </div>
                    <span className={`text-sm font-semibold ${trendValue >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                      {formatCurrency(trendValue)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
