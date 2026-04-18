interface ProfitReportProps {
  reportData: any
  formatCurrency: (value: number) => string
}

export function ProfitReport({ reportData, formatCurrency }: ProfitReportProps) {
  if (!reportData) return null

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
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Profit Trend</h3>
          <div className="space-y-2">
            {reportData.periodData.map((item: any) => (
              <div key={item.date} className="flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400 w-32">{item.date}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative dark:bg-gray-700">
                  <div
                    className={`rounded-full h-6 flex items-center justify-end pr-2 ${
                      item.value >= 0 ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.min(Math.abs(item.value) / Math.max(...reportData.periodData.map((d: any) => Math.abs(d.value))) * 100, 100)}%`
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
    </div>
  )
}
