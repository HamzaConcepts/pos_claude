'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Calendar, Filter } from 'lucide-react'
import { getStoreId } from '@/lib/supabase'
import { useDarkMode } from '@/hooks/useDarkMode'
import { SummaryReport } from '@/components/reports/SummaryReport'
import { SalesReport } from '@/components/reports/SalesReport'
import { ExpensesReport } from '@/components/reports/ExpensesReport'
import { InventoryReport } from '@/components/reports/InventoryReport'
import { ProfitReport } from '@/components/reports/ProfitReport'

interface ReportFilters {
  type: 'summary' | 'sales' | 'expenses' | 'inventory' | 'profit'
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
  startDate: string
  endDate: string
  cashierId: string
  paymentMethod: string
  category: string
}

export default function ReportsPage() {
  const isDarkMode = useDarkMode()
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

  useEffect(() => {
    fetchCashiers()
    fetchCategories()
  }, [])

  // Clear report data when report type changes to avoid stale data display
  useEffect(() => {
    setReportData(null)
  }, [filters.type])

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
    <div className={`p-6 max-w-7xl mx-auto ${isDarkMode ? 'bg-gray-900 text-white' : ''}`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : ''}`}>Reports & Analytics</h1>
        <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Comprehensive business insights and reports</p>
      </div>

      {/* Tabs for Report Type */}
      <div className={`mb-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setFilters({ ...filters, type: 'summary' })}
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'summary'
                ? (isDarkMode ? 'border-cyan-500 text-cyan-400' : 'border-black text-black')
                : (isDarkMode ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setFilters({ ...filters, type: 'sales' })}
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'sales'
                ? (isDarkMode ? 'border-cyan-500 text-cyan-400' : 'border-black text-black')
                : (isDarkMode ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
            }`}
          >
            Sales
          </button>
          <button
            onClick={() => setFilters({ ...filters, type: 'expenses' })}
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'expenses'
                ? (isDarkMode ? 'border-cyan-500 text-cyan-400' : 'border-black text-black')
                : (isDarkMode ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setFilters({ ...filters, type: 'inventory' })}
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'inventory'
                ? (isDarkMode ? 'border-cyan-500 text-cyan-400' : 'border-black text-black')
                : (isDarkMode ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
            }`}
          >
            Inventory
          </button>
          <button
            onClick={() => setFilters({ ...filters, type: 'profit' })}
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap border-b-2 ${
              filters.type === 'profit'
                ? (isDarkMode ? 'border-cyan-500 text-cyan-400' : 'border-black text-black')
                : (isDarkMode ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')
            }`}
          >
            Profit & Loss
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-lg border p-6 mb-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5" />
          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : ''}`}>Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{/* Period */}
          {(filters.type === 'sales' || filters.type === 'expenses' || filters.type === 'profit') && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : ''}`}>Group By</label>
              <select
                value={filters.period || ''}
                onChange={(e) => setFilters({ ...filters, period: e.target.value as any || null })}
                className={`w-full border rounded px-3 py-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}>
              >
                <option value="">No Grouping</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          )}

          {/* Start Date */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : ''}`}>Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className={`w-full border rounded px-3 py-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
            />
          </div>

          {/* End Date */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : ''}`}>End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className={`w-full border rounded px-3 py-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
            />
          </div>

          {/* Payment Method */}
          {(filters.type === 'sales' || filters.type === 'expenses') && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : ''}`}>Payment Method</label>
              <select
                value={filters.paymentMethod}
                onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
                className={`w-full border rounded px-3 py-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
              >
                <option value="">All</option>
                <option value="Cash">Cash</option>
                <option value="Digital">Digital</option>
              </select>
            </div>
          )}

          {/* Cashier Filter */}
          {filters.type === 'sales' && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : ''}`}>Cashier</label>
              <select
                value={filters.cashierId}
                onChange={(e) => setFilters({ ...filters, cashierId: e.target.value })}
                className={`w-full border rounded px-3 py-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
              >
                <option value="">All Cashiers</option>
                {cashiers.map(cashier => (
                  <option key={cashier.id} value={cashier.id}>{cashier.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Category Filter */}
          {filters.type === 'expenses' && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : ''}`}>Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className={`w-full border rounded px-3 py-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={generateReport}
            disabled={loading}
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!reportData}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!reportData}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Generating report...</p>
        </div>
      ) : reportData ? (
        <div>
          {filters.type === 'summary' && <SummaryReport reportData={reportData} formatCurrency={formatCurrency} />}
          {filters.type === 'sales' && <SalesReport reportData={reportData} formatCurrency={formatCurrency} />}
          {filters.type === 'expenses' && <ExpensesReport reportData={reportData} formatCurrency={formatCurrency} />}
          {filters.type === 'inventory' && <InventoryReport reportData={reportData} formatCurrency={formatCurrency} />}
          {filters.type === 'profit' && <ProfitReport reportData={reportData} formatCurrency={formatCurrency} />}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Select filters and click "Generate Report" to view data</p>
        </div>
      )}
    </div>
  )
}
