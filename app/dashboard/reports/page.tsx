'use client'

import { useState, useEffect } from 'react'
import { FileTextIcon, DownloadSimpleIcon, CalendarIcon, FunnelIcon, CaretDownIcon, CaretUpIcon, TrendUpIcon, TrendDownIcon, CurrencyDollarIcon, CreditCardIcon } from '@phosphor-icons/react'
import { getStoreId } from '@/lib/supabase'
import { useDarkMode } from '@/hooks/useDarkMode'
import { getPKTDate } from '@/lib/date-utils'
import { useCurrency } from '@/lib/currency-context'
import { SummaryReport } from '@/components/reports/SummaryReport'
import { SalesReport } from '@/components/reports/SalesReport'
import { ExpensesReport } from '@/components/reports/ExpensesReport'
import { InventoryReport } from '@/components/reports/InventoryReport'
import { ProfitReport } from '@/components/reports/ProfitReport'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ReportFilters {
  type: 'summary' | 'sales' | 'expenses' | 'inventory' | 'profit'
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  startDate: string
  endDate: string
  cashierId: string
  paymentMethod: string
  category: string
}

type QuickPeriod = 'today' | 'week' | 'month' | 'year' | 'custom'

export default function ReportsPage() {
  const isDarkMode = useDarkMode()
  const { currency, formatCurrency: formatCurrencyFromContext } = useCurrency()
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>('month')
  const [showCustomDates, setShowCustomDates] = useState(false)
  const [filters, setFilters] = useState<ReportFilters>({
    type: 'summary',
    period: 'monthly',
    startDate: (() => {
      const pktDate = getPKTDate()
      const [year, month] = pktDate.split('-')
      return `${year}-${month}-01`
    })(),
    endDate: getPKTDate(),
    cashierId: '',
    paymentMethod: '',
    category: ''
  })

  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [cashiers, setCashiers] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    fetchCashiers()
    fetchCategories()
  }, [])

  // Clear report data when report type changes to avoid stale data display
  useEffect(() => {
    setReportData(null)
  }, [filters.type])

  const handleQuickPeriodChange = (period: QuickPeriod) => {
    setQuickPeriod(period)
    const pktDate = getPKTDate()
    let startDate = ''
    let endDate = pktDate

    switch (period) {
      case 'today':
        startDate = endDate
        break
      case 'week':
        // Calculate start of week in PKT
        const [year, month, day] = pktDate.split('-').map(Number)
        const pktToday = new Date(year, month - 1, day)
        const weekStart = new Date(pktToday)
        weekStart.setDate(pktToday.getDate() - pktToday.getDay()) // Start of week (Sunday)
        startDate = weekStart.toISOString().split('T')[0]
        break
      case 'month':
        const [yr, mo] = pktDate.split('-')
        startDate = `${yr}-${mo}-01`
        break
      case 'year':
        const [yearOnly] = pktDate.split('-')
        startDate = `${yearOnly}-01-01`
        break
      case 'custom':
        setShowCustomDates(true)
        return
    }

    setFilters({ ...filters, startDate, endDate })
    setShowCustomDates(false)
  }

  const fetchCashiers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) {
        setCashiers([])
        return
      }
      const response = await fetch(`/api/cashiers?store_id=${storeId}`)
      const data = await response.json()
      if (data.success) {
        setCashiers(data.data || [])
      } else {
        setCashiers([])
      }
    } catch (error) {
      console.error('Error fetching cashiers:', error)
      setCashiers([])
    }
  }

  const fetchCategories = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) {
        setCategories([])
        return
      }
      const response = await fetch(`/api/expenses?store_id=${storeId}`)
      const data = await response.json()
      if (data.success && data.data) {
        const uniqueCategories = [...new Set(data.data.map((exp: any) => exp.category))] as string[]
        setCategories(uniqueCategories)
      } else {
        setCategories([])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
      setCategories([])
    }
  }

  const generateReport = async () => {
    setLoading(true)
    try {
      const storeId = getStoreId()
      if (!storeId) {
        console.error('No store ID found')
        setLoading(false)
        return
      }
      const params = new URLSearchParams({
        store_id: storeId.toString(),
        type: filters.type,
        start_date: filters.startDate,
        end_date: filters.endDate
      })

      if (filters.period) params.append('period', filters.period)
      if (filters.cashierId) params.append('cashier_id', filters.cashierId)
      if (filters.paymentMethod) params.append('payment_method', filters.paymentMethod)
      if (filters.category) params.append('category', filters.category)

      const response = await fetch(`/api/reports?${params}`)
      const data = await response.json()

      if (data.success) {
        setReportData(data.data)
      }
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    alert('PDF export feature coming soon!')
  }

  const handleExportCSV = () => {
    if (!reportData) return

    let csvContent = ''
    let filename = 'report.csv'

    switch (filters.type) {
      case 'sales':
        csvContent = generateSalesCSV(reportData)
        filename = `sales-report-${filters.startDate}-to-${filters.endDate}.csv`
        break
      case 'expenses':
        csvContent = generateExpensesCSV(reportData)
        filename = `expenses-report-${filters.startDate}-to-${filters.endDate}.csv`
        break
      case 'inventory':
        csvContent = generateInventoryCSV(reportData)
        filename = `inventory-report-${filters.startDate}-to-${filters.endDate}.csv`
        break
      default:
        csvContent = generateSummaryCSV(reportData)
        filename = `summary-report-${filters.startDate}-to-${filters.endDate}.csv`
    }

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const generateSalesCSV = (data: any) => {
    let csv = 'Date,Sale ID,Cashier,Total,Payment Method,Status\n'
    data.sales?.forEach((sale: any) => {
      csv += `${new Date(sale.sale_date).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })},${sale.id},${sale.cashier_name || 'N/A'},${sale.total_amount},${sale.payment_method},${sale.payment_status}\n`
    })
    return csv
  }

  const generateExpensesCSV = (data: any) => {
    let csv = 'Date,Category,Description,Amount,Payment Method\n'
    data.expenses?.forEach((exp: any) => {
      csv += `${new Date(exp.expense_date).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })},${exp.category},${exp.description},${exp.amount},${exp.payment_method || 'N/A'}\n`
    })
    return csv
  }

  const generateInventoryCSV = (data: any) => {
    let csv = 'Product,SKU,Purchased,Remaining,Sold,Cost Price\n'
    data.batches?.forEach((batch: any) => {
      const sold = batch.quantity_purchased - batch.quantity_remaining
      csv += `${batch.products?.name},${batch.products?.sku},${batch.quantity_purchased},${batch.quantity_remaining},${sold},${batch.cost_price}\n`
    })
    return csv
  }

  const generateSummaryCSV = (data: any) => {
    let csv = 'Metric,Value\n'
    if (data.sales) {
      csv += `Total Sales,${data.sales.totalSales}\n`
      csv += `Total Revenue,${data.sales.totalRevenue}\n`
      csv += `Cash Sales,${data.sales.totalCash}\n`
      csv += `Digital Sales,${data.sales.totalDigital}\n`
    }
    if (data.expenses) {
      csv += `Total Expenses,${data.expenses.totalAmount}\n`
    }
    if (data.profit) {
      csv += `Net Profit,${data.profit.netProfit}\n`
      csv += `Profit Margin,${data.profit.profitMargin}%\n`
    }
    return csv
  }

  const formatCurrency = (amount: number) => {
    return formatCurrencyFromContext(amount, 0)
  }

  return (
    <div className="animate-fadeIn p-4 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-gray-100">Reports & Analytics</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Comprehensive business insights and reports</p>
      </div>

      {/* Quick Period Buttons */}
      <div className="mb-4 p-3 rounded-lg border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleQuickPeriodChange('today')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              quickPeriod === 'today'
                ? 'bg-black text-white dark:bg-cyan-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => handleQuickPeriodChange('week')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              quickPeriod === 'week'
                ? 'bg-black text-white dark:bg-cyan-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => handleQuickPeriodChange('month')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              quickPeriod === 'month'
                ? 'bg-black text-white dark:bg-cyan-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => handleQuickPeriodChange('year')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              quickPeriod === 'year'
                ? 'bg-black text-white dark:bg-cyan-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            This Year
          </button>
          <button
            onClick={() => handleQuickPeriodChange('custom')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-1 ${
              quickPeriod === 'custom'
                ? 'bg-black text-white dark:bg-cyan-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            More
            {showCustomDates ? <CaretUpIcon className="w-4 h-4" /> : <CaretDownIcon className="w-4 h-4" />}
          </button>
        </div>

        {/* Custom Date Range Section */}
        {showCustomDates && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
            </div>
            <button
              onClick={generateReport}
              disabled={loading}
              className="mt-3 px-4 py-2 text-sm rounded-lg transition-colors bg-black text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-cyan-600 dark:hover:bg-cyan-700"
            >
              {loading ? 'Generating...' : 'Apply Custom Range'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs for Report Type */}
      <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setFilters({ ...filters, type: 'summary' })}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'summary'
                ? 'border-black text-black dark:border-cyan-500 dark:text-cyan-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setFilters({ ...filters, type: 'sales' })}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'sales'
                ? 'border-black text-black dark:border-cyan-500 dark:text-cyan-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Sales
          </button>
          <button
            onClick={() => setFilters({ ...filters, type: 'expenses' })}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'expenses'
                ? 'border-black text-black dark:border-cyan-500 dark:text-cyan-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setFilters({ ...filters, type: 'inventory' })}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'inventory'
                ? 'border-black text-black dark:border-cyan-500 dark:text-cyan-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Inventory
          </button>
          <button
            onClick={() => setFilters({ ...filters, type: 'profit' })}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'profit'
                ? 'border-black text-black dark:border-cyan-500 dark:text-cyan-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Profit & Loss
          </button>
        </div>
      </div>

      {/* Additional Filters - Compact */}
      {(filters.type === 'sales' || filters.type === 'expenses') && (
        <div className="mb-4 p-3 rounded-lg border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(filters.type === 'sales' || filters.type === 'expenses') && (
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Payment Method</label>
                <select
                  value={filters.paymentMethod}
                  onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                >
                  <option value="">All</option>
                  <option value="Cash">Cash</option>
                  <option value="Digital">Digital</option>
                </select>
              </div>
            )}

            {filters.type === 'sales' && (
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Cashier</label>
                <select
                  value={filters.cashierId}
                  onChange={(e) => setFilters({ ...filters, cashierId: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                >
                  <option value="">All</option>
                  {cashiers.map(cashier => (
                    <option key={cashier.id} value={cashier.id}>{cashier.name}</option>
                  ))}
                </select>
              </div>
            )}

            {filters.type === 'expenses' && (
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                >
                  <option value="">All</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-end">
              <button
                onClick={generateReport}
                disabled={loading}
                className="w-full px-3 py-1.5 text-sm rounded transition-colors bg-black text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-cyan-600 dark:hover:bg-cyan-700"
              >
                {loading ? 'Loading...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <button
          onClick={generateReport}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg transition-colors bg-black text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-cyan-600 dark:hover:bg-cyan-700"
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {/* Export Buttons - Compact */}
      {reportData && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-sm border rounded flex items-center gap-1 border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <DownloadSimpleIcon className="w-3 h-3" />
            CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3 py-1.5 text-sm border rounded flex items-center gap-1 border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <FileTextIcon className="w-3 h-3" />
            PDF
          </button>
        </div>
      )}

      {/* Report Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="mx-auto mb-3 animate-pulse">
            <svg width={40} height={Math.round(40 * (1196 / 1061))} viewBox="0 0 1061 1196" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-current text-cyan-500 mx-auto"><path d="M538.795 609.092L871.505 276.381C976.486 372.749 1042.32 511.172 1042.38 664.993C1041.64 664.973 1040.9 664.949 1040.16 664.926C1046.75 665.171 1053.37 665.296 1060.02 665.298C777.219 665.385 546.193 886.933 530.915 1165.94L530.096 1180.67C530.596 1189.81 530.158 1186.07 530.102 1193.71L530.096 1195.39C530.096 1190.47 529.746 1185.56 529.88 1180.67C522.081 894.715 287.839 665.299 0 665.299C6.05981 665.299 12.0958 665.194 18.1064 664.992C18.1652 506.975 88.0333 365.252 198.592 268.889L538.795 609.092ZM674.459 135.664L538.795 271.328L403.132 135.664L538.795 0L674.459 135.664Z" /></svg>
          </div>
          <div className="w-40 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mx-auto mb-3">
            <div className="h-full bg-cyan-500 rounded-full" style={{ animation: 'progressBar 1.5s ease-in-out infinite' }} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Generating report...</p>
        </div>
      ) : reportData ? (
        <div>
          {/* Enhanced Summary Report with Cash In/Out */}
          {filters.type === 'summary' && (
            <div className="space-y-4">
              {/* Cash Flow Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cash In Card */}
                <div className="p-3 rounded-lg border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Cash In (Sales)</h3>
                    <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/30">
                      <TrendUpIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="text-xl font-bold mb-2 text-green-600 dark:text-green-400">
                    {formatCurrency(reportData.sales?.totalRevenue ?? 0)}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="p-1.5 rounded bg-gray-50 dark:bg-gray-700">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Cash</div>
                      <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(reportData.sales?.totalCash ?? 0)}
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-gray-50 dark:bg-gray-700">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Digital</div>
                      <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(reportData.sales?.totalDigital ?? 0)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs mt-1.5 text-gray-600 dark:text-gray-400">
                    {reportData.sales?.totalSales ?? 0} transactions
                  </div>
                </div>

                {/* Cash Out Card */}
                <div className="p-3 rounded-lg border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Cash Out (Expenses)</h3>
                    <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30">
                      <TrendDownIcon className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                  <div className="text-xl font-bold mb-2 text-red-600 dark:text-red-400">
                    {formatCurrency(reportData.expenses?.totalAmount ?? 0)}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="p-1.5 rounded bg-gray-50 dark:bg-gray-700">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Cash</div>
                      <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(reportData.expenses?.totalCash ?? 0)}
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-gray-50 dark:bg-gray-700">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Digital</div>
                      <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(reportData.expenses?.totalDigital ?? 0)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs mt-1.5 text-gray-600 dark:text-gray-400">
                    {reportData.expenses?.totalExpenses ?? 0} transactions
                  </div>
                </div>
              </div>

              {/* Net Position & Inventory */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
                  <h3 className="text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300">Net Profit</h3>
                  <div className={`text-xl font-bold ${reportData.profit?.netProfit >= 0 ? 'text-black dark:text-cyan-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(reportData.profit?.netProfit ?? 0)}
                  </div>
                  <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                    Profit Margin: {reportData.profit?.profitMargin?.toFixed(2) ?? 0}%
                  </div>
                </div>

                <div className="p-3 rounded-lg border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
                  <h3 className="text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300">Stock Value</h3>
                  <div className="text-xl font-bold text-black dark:text-cyan-400">
                    {formatCurrency(reportData.inventory?.totalStockValue ?? 0)}
                  </div>
                  <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                    {reportData.inventory?.totalRemaining ?? 0} items in stock
                  </div>
                </div>
              </div>

              {/* Cash Flow Chart */}
              {reportData.cashFlowTrend && reportData.cashFlowTrend.length > 0 && (
                <div className="p-4 rounded-lg border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
                  <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-100">Cash Flow Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={reportData.cashFlowTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                      <XAxis 
                        dataKey="date" 
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                          border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '8px',
                          color: isDarkMode ? '#f3f4f6' : '#111827'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="cashIn" 
                        stroke={isDarkMode ? '#34d399' : '#10b981'} 
                        name="Cash In"
                        strokeWidth={2}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="cashOut" 
                        stroke={isDarkMode ? '#f87171' : '#ef4444'} 
                        name="Cash Out"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
          
          {filters.type === 'sales' && <SalesReport reportData={reportData} formatCurrency={formatCurrency} />}
          {filters.type === 'expenses' && <ExpensesReport reportData={reportData} formatCurrency={formatCurrency} />}
          {filters.type === 'inventory' && <InventoryReport reportData={reportData} formatCurrency={formatCurrency} />}
          {filters.type === 'profit' && <ProfitReport reportData={reportData} formatCurrency={formatCurrency} />}
        </div>
      ) : (
        <div className="text-center py-12 rounded-lg border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow">
          <FileTextIcon className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
          <p className="text-gray-600 dark:text-gray-400">Select filters and click Generate Report</p>
        </div>
      )}
    </div>
  )
}

