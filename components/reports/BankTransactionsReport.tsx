import { TrendDownIcon, TrendUpIcon } from '@phosphor-icons/react'

interface BankTransactionsReportProps {
  reportData: any
  formatCurrency: (value: number) => string
}

export function BankTransactionsReport({ reportData, formatCurrency }: BankTransactionsReportProps) {
  if (!reportData) return null

  const banks = Array.isArray(reportData.banks) ? reportData.banks : []
  const transactions = Array.isArray(reportData.transactions) ? reportData.transactions : []
  const summary = reportData.summary || {}

  const openingTotal = summary.totalOpeningBalance ?? 0
  const netTotal = (summary.totalReceived ?? 0) - (summary.totalPaid ?? 0)

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="p-3 rounded-lg border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Opening Balance</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(openingTotal)}
          </div>
        </div>

        <div className="p-3 rounded-lg border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Bank Received</h3>
            <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/30">
              <TrendUpIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="text-xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(summary.totalReceived ?? 0)}
          </div>
        </div>

        <div className="p-3 rounded-lg border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Bank Paid</h3>
            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30">
              <TrendDownIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="text-xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(summary.totalPaid ?? 0)}
          </div>
        </div>

        <div className="p-3 rounded-lg border bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Net Bank Position</h3>
          </div>
          <div className={`text-xl font-bold ${netTotal >= 0 ? 'text-black dark:text-cyan-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(netTotal)}
          </div>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 mb-4">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Bank Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Bank</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Opening</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Received</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Paid</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Net</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Closing</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {banks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                    No bank transactions found for this period.
                  </td>
                </tr>
              ) : (
                banks.map((bank: any) => (
                  <tr key={bank.bank_account_name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{bank.bank_account_name}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                      {formatCurrency(bank.opening_balance ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                      {formatCurrency(bank.received ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">
                      {formatCurrency(bank.paid ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-gray-200">
                      {formatCurrency(bank.net ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-200">
                      {formatCurrency(bank.closing_balance ?? (bank.opening_balance ?? 0) + (bank.net ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                      {bank.totalCount ?? 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Recent Bank Transactions</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Showing the latest 100 transactions.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Bank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Direction</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                    No transactions recorded.
                  </td>
                </tr>
              ) : (
                transactions.slice(0, 100).map((txn: any, index: number) => (
                  <tr key={`${txn.date}-${txn.bank_account_name}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">
                      {txn.date ? new Date(txn.date).toLocaleString('en-PK', {
                        timeZone: 'Asia/Karachi',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      }) : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">{txn.bank_account_name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        txn.direction === 'received'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                        {txn.direction === 'received' ? 'Received' : 'Paid'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      txn.direction === 'received'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(txn.amount ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{txn.source || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{txn.reference || 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
