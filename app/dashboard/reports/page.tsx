'use client'

import { useState, useEffect } from 'react'
import { FileTextIcon, DownloadSimpleIcon, CalendarIcon, FunnelIcon, CaretDownIcon, CaretUpIcon, TrendUpIcon, TrendDownIcon, CurrencyDollarIcon, CreditCardIcon } from '@phosphor-icons/react'
import { getStoreId } from '@/lib/supabase'
import { useDarkMode } from '@/hooks/useDarkMode'
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
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>('month')
  const [showCustomDates, setShowCustomDates] = useState(false)
  const [filters, setFilters] = useState<ReportFilters>({
    type: 'summary',
    period: 'monthly',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    cashierId: '',
    paymentMethod: '',
    category: ''
  })

  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [cashiers, setCashiers] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])

  // Auto-generate report when quick period changes
  useEffect(() => {
    if (quickPeriod !== 'custom') {
      generateReport()
    }
  }, [quickPeriod])

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
    const today = new Date()
    let startDate = ''
    let endDate = today.toISOString().split('T')[0]

    switch (period) {
      case 'today':
        startDate = endDate
        break
      case 'week':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay()) // Start of week (Sunday)
        startDate = weekStart.toISOString().split('T')[0]
        break
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
        break
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0]
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
      csv += `${new Date(sale.sale_date).toLocaleDateString()},${sale.id},${sale.cashier_name || 'N/A'},${sale.total_amount},${sale.payment_method},${sale.payment_status}\n`
    })
    return csv
  }

  const generateExpensesCSV = (data: any) => {
    let csv = 'Date,Category,Description,Amount,Payment Method\n'
    data.expenses?.forEach((exp: any) => {
      csv += `${new Date(exp.expense_date).toLocaleDateString()},${exp.category},${exp.description},${exp.amount},${exp.payment_method || 'N/A'}\n`
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
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className={`animate-fadeIn p-4 max-w-7xl mx-auto ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className="mb-4">
        <h1 className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Reports & Analytics</h1>
        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Comprehensive business insights and reports</p>
      </div>

      {/* Quick Period Buttons */}
      <div className={`mb-4 p-3 rounded-lg border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleQuickPeriodChange('today')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              quickPeriod === 'today'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-black text-white')
                : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
            }`}
          >
            Today
          </button>
          <button
            onClick={() => handleQuickPeriodChange('week')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              quickPeriod === 'week'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-black text-white')
                : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => handleQuickPeriodChange('month')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              quickPeriod === 'month'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-black text-white')
                : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => handleQuickPeriodChange('year')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              quickPeriod === 'year'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-black text-white')
                : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
            }`}
          >
            This Year
          </button>
          <button
            onClick={() => handleQuickPeriodChange('custom')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center gap-1 ${
              quickPeriod === 'custom'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-black text-white')
                : (isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
            }`}
          >
            More
            {showCustomDates ? <CaretUpIcon className="w-4 h-4" /> : <CaretDownIcon className="w-4 h-4" />}
          </button>
        </div>

        {/* Custom Date Range Section */}
        {showCustomDates && (
          <div className={`mt-3 pt-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
            </div>
            <button
              onClick={generateReport}
              disabled={loading}
              className={`mt-3 px-4 py-2 text-sm rounded-lg transition-colors ${
                isDarkMode 
                  ? 'bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50' 
                  : 'bg-black text-white hover:bg-gray-800 disabled:opacity-50'
              }`}
            >
              {loading ? 'Generating...' : 'Apply Custom Range'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs for Report Type */}
      <div className={`mb-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setFilters({ ...filters, type: 'summary' })}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'summary'
                ? (isDarkMode ? 'border-cyan-500 text-cyan-400' : 'border-black text-black')
                : (isDarkMode ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setFilters({ ...filters, type: 'sales' })}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'sales'
                ? (isDarkMode ? 'border-cyan-500 text-cyan-400' : 'border-black text-black')
                : (isDarkMode ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
            }`}
          >
            Sales
          </button>
          <button
            onClick={() => setFilters({ ...filters, type: 'expenses' })}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'expenses'
                ? (isDarkMode ? 'border-cyan-500 text-cyan-400' : 'border-black text-black')
                : (isDarkMode ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setFilters({ ...filters, type: 'inventory' })}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'inventory'
                ? (isDarkMode ? 'border-cyan-500 text-cyan-400' : 'border-black text-black')
                : (isDarkMode ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
            }`}
          >
            Inventory
          </button>
          <button
            onClick={() => setFilters({ ...filters, type: 'profit' })}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'profit'
                ? (isDarkMode ? 'border-cyan-500 text-cyan-400' : 'border-black text-black')
                : (isDarkMode ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
            }`}
          >
            Profit & Loss
          </button>
        </div>
      </div>

      {/* Additional Filters - Compact */}
      {(filters.type === 'sales' || filters.type === 'expenses') && (
        <div className={`mb-4 p-3 rounded-lg border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(filters.type === 'sales' || filters.type === 'expenses') && (
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Payment Method</label>
                <select
                  value={filters.paymentMethod}
                  onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
                  className={`w-full border rounded px-2 py-1.5 text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300'}`}
                >
                  <option value="">All</option>
                  <option value="Cash">Cash</option>
                  <option value="Digital">Digital</option>
                </select>
              </div>
            )}

            {filters.type === 'sales' && (
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Cashier</label>
                <select
                  value={filters.cashierId}
                  onChange={(e) => setFilters({ ...filters, cashierId: e.target.value })}
                  className={`w-full border rounded px-2 py-1.5 text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300'}`}
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
                <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className={`w-full border rounded px-2 py-1.5 text-sm ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300'}`}
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
                className={`w-full px-3 py-1.5 text-sm rounded transition-colors ${
                  isDarkMode 
                    ? 'bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50' 
                    : 'bg-black text-white hover:bg-gray-800 disabled:opacity-50'
                }`}
              >
                {loading ? 'Loading...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Buttons - Compact */}
      {reportData && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleExportCSV}
            className={`px-3 py-1.5 text-sm border rounded flex items-center gap-1 ${
              isDarkMode 
                ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <DownloadSimpleIcon className="w-3 h-3" />
            CSV
          </button>
          <button
            onClick={handleExportPDF}
            className={`px-3 py-1.5 text-sm border rounded flex items-center gap-1 ${
              isDarkMode 
                ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <FileTextIcon className="w-3 h-3" />
            PDF
          </button>
        </div>
      )}

      {/* Report Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${isDarkMode ? 'border-cyan-500' : 'border-black'}`}></div>
          <p className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Generating report...</p>
        </div>
      ) : reportData ? (
        <div>
          {/* Enhanced Summary Report with Cash In/Out */}
          {filters.type === 'summary' && (
            <div className="space-y-4">
              {/* Cash Flow Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cash In Card */}
                <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Cash In (Sales)</h3>
                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-green-900/30' : 'bg-green-50'}`}>
                      <TrendUpIcon className={`w-4 h-4 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />
                    </div>
                  </div>
                  <div className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                    {formatCurrency(reportData.sales?.totalRevenue ?? 0)}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className={`p-1.5 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-0.5`}>Cash</div>
                      <div className={`text-xs font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                        {formatCurrency(reportData.sales?.totalCash ?? 0)}
                      </div>
                    </div>
                    <div className={`p-1.5 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-0.5`}>Digital</div>
                      <div className={`text-xs font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                        {formatCurrency(reportData.sales?.totalDigital ?? 0)}
                      </div>
                    </div>
                  </div>
                  <div className={`text-xs mt-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {reportData.sales?.totalSales ?? 0} transactions
                  </div>
                </div>

                {/* Cash Out Card */}
                <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-xs font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Cash Out (Expenses)</h3>
                    <div className={`p-1.5 rounded-lg ${isDarkMode ? 'bg-red-900/30' : 'bg-red-50'}`}>
                      <TrendDownIcon className={`w-4 h-4 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                    </div>
                  </div>
                  <div className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                    {formatCurrency(reportData.expenses?.totalAmount ?? 0)}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className={`p-1.5 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-0.5`}>Cash</div>
                      <div className={`text-xs font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                        {formatCurrency(reportData.expenses?.totalCash ?? 0)}
                      </div>
                    </div>
                    <div className={`p-1.5 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-0.5`}>Digital</div>
                      <div className={`text-xs font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                        {formatCurrency(reportData.expenses?.totalDigital ?? 0)}
                      </div>
                    </div>
                  </div>
                  <div className={`text-xs mt-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {reportData.expenses?.totalExpenses ?? 0} transactions
                  </div>
                </div>
              </div>

              {/* Net Position & Inventory */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <h3 className={`text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Net Profit</h3>
                  <div className={`text-xl font-bold ${reportData.profit?.netProfit >= 0 ? (isDarkMode ? 'text-cyan-400' : 'text-black') : (isDarkMode ? 'text-red-400' : 'text-red-600')}`}>
                    {formatCurrency(reportData.profit?.netProfit ?? 0)}
                  </div>
                  <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Profit Margin: {reportData.profit?.profitMargin?.toFixed(2) ?? 0}%
                  </div>
                </div>

                <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <h3 className={`text-xs font-semibold mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Stock Value</h3>
                  <div className={`text-xl font-bold ${isDarkMode ? 'text-cyan-400' : 'text-black'}`}>
                    {formatCurrency(reportData.inventory?.totalStockValue ?? 0)}
                  </div>
                  <div className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {reportData.inventory?.totalRemaining ?? 0} items in stock
                  </div>
                </div>
              </div>

              {/* Cash Flow Chart */}
              {reportData.cashFlowTrend && reportData.cashFlowTrend.length > 0 && (
                <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
                  <h3 className={`text-sm font-semibold mb-3 ${isDarkMode ? 'text-gray-100' : 'text-gray-700'}`}>Cash Flow Trend</h3>
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
        <div className={`text-center py-12 rounded-lg border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
          <FileTextIcon className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Select a period to view reports</p>
        </div>
      )}
    </div>
  )
}

