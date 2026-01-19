'use client'

import { useEffect, useState } from 'react'
import { Users, DollarSign, TrendingUp, Calendar } from 'lucide-react'
import { getStoreId } from '@/lib/supabase'
import { useDarkMode } from '@/hooks/useDarkMode'

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
  const isDarkMode = useDarkMode()
  const [cashiers, setCashiers] = useState<Cashier[]>([])
  const [stats, setStats] = useState<CashierStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [error, setError] = useState('')

  useEffect(() => {
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${isDarkMode ? 'border-cyan-500' : 'border-black'}`}></div>
          <p className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading cashiers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Staff Performance</h1>
          <p className="text-sm text-gray-600">View cashier performance, salaries, and commissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-gray-500" />
          <label htmlFor="month-selector" className="sr-only">Select Month</label>
          <input
            id="month-selector"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded text-sm focus:border-cyan-600 focus:outline-none transition-colors"
            aria-label="Select month to view cashier statistics"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-gray-200 rounded p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-cyan-50 rounded">
              <Users size={18} className="text-cyan-600" />
            </div>
            <p className="text-gray-600 text-sm font-medium">Active Cashiers</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{cashiers.filter(c => c.is_active).length}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-green-50 rounded">
              <DollarSign size={18} className="text-green-600" />
            </div>
            <p className="text-gray-600 text-sm font-medium">Total Salaries</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">${totalSalaries.toLocaleString()}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-orange-50 rounded">
              <TrendingUp size={18} className="text-orange-600" />
            </div>
            <p className="text-gray-600 text-sm font-medium">Total Commissions</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">${totalCommissions.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-cyan-50 rounded">
              <DollarSign size={18} className="text-cyan-600" />
            </div>
            <p className="text-gray-600 text-sm font-medium">Total Payroll</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">${totalPayroll.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Cashiers Table */}
      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Performance for {new Date(selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        </div>

        {cashiers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No cashiers found</p>
            <p className="text-xs mt-1">Add cashiers in the Settings page</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
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
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-cyan-100 text-cyan-700 rounded-full flex items-center justify-center font-semibold text-sm">
                            {cashier.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-gray-900">{cashier.full_name}</p>
                            <p className="text-xs text-gray-500 md:hidden">{cashier.phone_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-600 text-sm hidden md:table-cell">{cashier.phone_number}</td>
                      <td className="px-3 py-3 text-right font-medium text-sm text-gray-900">
                        ${(cashier.salary || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-gray-700 hidden sm:table-cell">{cashierStats.orders_completed}</td>
                      <td className="px-3 py-3 text-right font-medium text-sm text-gray-700 hidden lg:table-cell">
                        ${cashierStats.total_sales.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-green-600 text-sm">
                        ${cashierStats.total_profit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600 text-sm hidden md:table-cell">
                        {cashier.commission_rate}%
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-orange-600 text-sm">
                        ${cashierStats.commission_earned.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-sm text-gray-900 hidden lg:table-cell">
                        ${totalComp.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${ 
                          cashier.is_active 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {cashier.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-sm text-gray-900">TOTALS</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-900">
                    ${totalSalaries.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-900 hidden sm:table-cell">
                    {stats.reduce((sum, s) => sum + s.orders_completed, 0)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-900 hidden lg:table-cell">
                    ${stats.reduce((sum, s) => sum + s.total_sales, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-green-600 text-sm">
                    ${stats.reduce((sum, s) => sum + s.total_profit, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell"></td>
                  <td className="px-3 py-3 text-right text-orange-600 text-sm">
                    ${totalCommissions.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-900 hidden lg:table-cell">
                    ${totalPayroll.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="mt-5 p-4 bg-cyan-50 border border-cyan-200 rounded">
        <h3 className="font-semibold text-cyan-900 mb-1 text-sm flex items-center gap-1.5">
          <span>ℹ️</span> Commission Calculation
        </h3>
        <p className="text-xs text-cyan-800 leading-relaxed">
          Commissions are calculated as a percentage of the <strong>profit</strong> (not sales revenue) from each sale. 
          Profit = Total Sale Amount - Total Cost Price of Products Sold. The commission rate is set per cashier in the Settings page.
        </p>
      </div>
    </div>
  )
}
