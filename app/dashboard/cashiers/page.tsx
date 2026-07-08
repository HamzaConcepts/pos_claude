'use client'

import { useEffect, useState } from 'react'
import { UsersIcon, CurrencyDollarIcon, TrendUpIcon, CalendarIcon } from '@phosphor-icons/react'
import { getStoreId } from '@/lib/supabase'
import { getBrowserTimeZone, getDateStringInTimeZone } from '@/lib/timezone'
import { useCurrency } from '@/lib/currency-context'
import CashiersSkeleton from '@/components/skeletons/CashiersSkeleton'

interface Cashier {
  id: number
  full_name: string
  phone_number: string
  commission_rate: number
  salary: number
  is_active: boolean
}

interface CashierStats {
  cashier_id: number
  cashier_name: string
  total_sales: number
  total_profit: number
  commission_earned: number
  orders_completed: number
}

export default function CashiersManagementPage() {
  const { currency, formatCurrency } = useCurrency()
  const [timeZone, setTimeZone] = useState('UTC')
  const [cashiers, setCashiers] = useState<Cashier[]>([])
  const [stats, setStats] = useState<CashierStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const resolvedTimeZone = getBrowserTimeZone()
    setTimeZone(resolvedTimeZone)
    setSelectedMonth(getDateStringInTimeZone(new Date(), resolvedTimeZone).slice(0, 7))
  }, [])

  useEffect(() => {
    if (!selectedMonth) return
    fetchData()
  }, [selectedMonth])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError('')
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found')
        return
      }

      // Fetch cashiers
      const cashiersRes = await fetch(`/api/cashiers?store_id=${storeId}`)
      const cashiersData = await cashiersRes.json()

      if (cashiersData.success) {
        setCashiers(cashiersData.data || [])
      }

      // Fetch cashier stats for selected month
      const statsRes = await fetch(
        `/api/cashiers/stats?store_id=${storeId}&month=${selectedMonth}`
      )
      const statsData = await statsRes.json()

      if (statsData.success) {
        setStats(statsData.data || [])
      } else {
        setError(statsData.error)
      }
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load cashier data')
    } finally {
      setLoading(false)
    }
  }

  const getCashierStats = (cashierId: number) => {
    return stats.find(s => s.cashier_id === cashierId) || {
      cashier_id: cashierId,
      cashier_name: '',
      total_sales: 0,
      total_profit: 0,
      commission_earned: 0,
      orders_completed: 0,
    }
  }

  const totalCommissions = stats.reduce((sum, s) => sum + s.commission_earned, 0)
  const totalSalaries = cashiers.reduce((sum, c) => sum + (c.salary || 0), 0)
  const totalPayroll = totalSalaries + totalCommissions

  if (loading) {
    return <CashiersSkeleton />
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1">Staff Performance</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">View cashier performance, salaries, and commissions</p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarIcon size={18} className="text-gray-500 dark:text-gray-400" />
          <label htmlFor="month-selector" className="sr-only">Select Month</label>
          <input
            id="month-selector"
            type="text"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            placeholder="YYYY-MM"
            inputMode="numeric"
            pattern="\\d{4}-\\d{2}"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:border-cyan-600 focus:outline-none transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            aria-label="Select month to view cashier statistics"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="border rounded p-4 bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-cyan-50 rounded">
              <UsersIcon size={18} className="text-cyan-600" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Active Cashiers</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{cashiers.filter(c => c.is_active).length}</p>
        </div>

        <div className="border rounded p-4 bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-green-50 rounded">
              <CurrencyDollarIcon size={18} className="text-green-600" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total Salaries</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalSalaries, 0)}</p>
        </div>

        <div className="border rounded p-4 bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-orange-50 rounded">
              <TrendUpIcon size={18} className="text-orange-600" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total Commissions</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalCommissions, 2)}</p>
        </div>

        <div className="border rounded p-4 bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-cyan-50 rounded">
              <CurrencyDollarIcon size={18} className="text-cyan-600" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total Payroll</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalPayroll, 2)}</p>
        </div>
      </div>

      {/* Cashiers Table */}
      <div className="border rounded overflow-hidden bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Performance for {new Date(selectedMonth).toLocaleDateString('en-PK', { timeZone, month: 'long', year: 'numeric' })}</h2>
        </div>

        {cashiers.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <UsersIcon size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No cashiers found</p>
            <p className="text-xs mt-1">Add cashiers in the Settings page</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Cashier</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold hidden md:table-cell">Contact</th>
                  <th className="px-3 py-2.5 text-right text-sm font-semibold">Salary</th>
                  <th className="px-3 py-2.5 text-right text-sm font-semibold hidden sm:table-cell">Orders</th>
                  <th className="px-3 py-2.5 text-right text-sm font-semibold hidden lg:table-cell">Sales</th>
                  <th className="px-3 py-2.5 text-right text-sm font-semibold">Profit</th>
                  <th className="px-3 py-2.5 text-right text-sm font-semibold hidden md:table-cell">Rate</th>
                  <th className="px-3 py-2.5 text-right text-sm font-semibold">Commission</th>
                  <th className="px-3 py-2.5 text-right text-sm font-semibold hidden lg:table-cell">Total</th>
                  <th className="px-3 py-2.5 text-center text-sm font-semibold hidden sm:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {cashiers.map((cashier) => {
                  const cashierStats = getCashierStats(cashier.id)
                  const totalComp = (cashier.salary || 0) + cashierStats.commission_earned

                  return (
                    <tr 
                      key={cashier.id} 
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-full flex items-center justify-center font-semibold text-sm">
                            {cashier.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">{cashier.full_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 md:hidden">{cashier.phone_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-400 text-sm hidden md:table-cell">{cashier.phone_number}</td>
                      <td className="px-3 py-3 text-right font-medium text-sm text-gray-900 dark:text-white">
                        {formatCurrency(cashier.salary || 0, 0)}
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-gray-700 dark:text-gray-300 hidden sm:table-cell">{cashierStats.orders_completed}</td>
                      <td className="px-3 py-3 text-right font-medium text-sm text-gray-700 dark:text-gray-300 hidden lg:table-cell">
                        {formatCurrency(cashierStats.total_sales, 0)}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-green-600 text-sm">
                        {formatCurrency(cashierStats.total_profit, 2)}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-400 text-sm hidden md:table-cell">
                        {cashier.commission_rate}%
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-orange-600 text-sm">
                        {formatCurrency(cashierStats.commission_earned, 2)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-sm text-gray-900 dark:text-white hidden lg:table-cell">
                        {formatCurrency(totalComp, 2)}
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${ 
                          cashier.is_active 
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' 
                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                        }`}>
                          {cashier.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-800 font-semibold border-t border-gray-200 dark:border-gray-700">
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-sm text-gray-900 dark:text-white">TOTALS</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-900 dark:text-white">
                    {formatCurrency(totalSalaries, 0)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-900 dark:text-white hidden sm:table-cell">
                    {stats.reduce((sum, s) => sum + s.orders_completed, 0)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-900 dark:text-white hidden lg:table-cell">
                    {formatCurrency(stats.reduce((sum, s) => sum + s.total_sales, 0), 0)}
                  </td>
                  <td className="px-3 py-3 text-right text-green-600 text-sm">
                    {formatCurrency(stats.reduce((sum, s) => sum + s.total_profit, 0), 2)}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell"></td>
                  <td className="px-3 py-3 text-right text-orange-600 text-sm">
                    {formatCurrency(totalCommissions, 2)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-900 dark:text-white hidden lg:table-cell">
                    {formatCurrency(totalPayroll, 2)}
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="mt-5 p-4 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded">
        <h3 className="font-semibold text-cyan-900 dark:text-cyan-300 mb-1 text-sm flex items-center gap-1.5">
          <span>ℹ️</span> Commission Calculation
        </h3>
        <p className="text-xs text-cyan-800 dark:text-cyan-400 leading-relaxed">
          Commissions are calculated as a percentage of the <strong>profit</strong> (not sales revenue) from each sale. 
          Profit = Total Sale Amount - Total Cost Price of Products Sold. The commission rate is set per cashier in the Settings page.
        </p>
      </div>
    </div>
  )
}
