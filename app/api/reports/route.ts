import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPurchasedQuantity, getRemainingQuantity } from '@/lib/stock-quantities'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

function toSafeNumber(value: any): number {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function getReceivedAmount(sale: any): number {
  const paidAmount = toSafeNumber(sale.amount_paid)
  if (paidAmount > 0) {
    return paidAmount
  }

  const paymentStatus = String(sale.payment_status || '').toLowerCase()
  if (paymentStatus === 'paid') {
    return toSafeNumber(sale.total_amount)
  }

  return 0
}

// GET - Generate comprehensive reports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')
    const reportType = searchParams.get('type') // sales, expenses, inventory, profit
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const period = searchParams.get('period') // daily, weekly, monthly, yearly
    const cashierId = searchParams.get('cashier_id')
    const paymentMethod = searchParams.get('payment_method')
    const category = searchParams.get('category')

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    let reportData: any = {}

    switch (reportType) {
      case 'sales':
        reportData = await generateSalesReport(storeId, { startDate, endDate, period, cashierId, paymentMethod })
        break
      case 'expenses':
        reportData = await generateExpensesReport(storeId, { startDate, endDate, period, category, paymentMethod })
        break
      case 'inventory':
        reportData = await generateInventoryReport(storeId, { startDate, endDate })
        break
      case 'profit':
        reportData = await generateProfitReport(storeId, { startDate, endDate, period })
        break
      case 'summary':
        reportData = await generateSummaryReport(storeId, { startDate, endDate, period, cashierId, paymentMethod })
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid report type' },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true, data: reportData })
  } catch (error: any) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

async function generateSalesReport(storeId: string, filters: any) {
  let query = supabaseAdmin
    .from('sales')
    .select(`
      *,
      sale_items (*),
      partial_payment_customers!partial_payment_customers_sale_id_fkey (*)
    `)
    .eq('store_id', parseInt(storeId))
    .order('sale_date', { ascending: false })

  if (filters.startDate) {
    query = query.gte('sale_date', filters.startDate)
  }
  if (filters.endDate) {
    const endDateTime = new Date(filters.endDate)
    endDateTime.setHours(23, 59, 59, 999)
    query = query.lte('sale_date', endDateTime.toISOString())
  }
  if (filters.cashierId) {
    const cashierRefId = Number.parseInt(filters.cashierId, 10)
    if (!Number.isNaN(cashierRefId)) {
      query = query.eq('cashier_ref_id', cashierRefId)
    }
  }
  if (filters.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod)
  }

  const { data: sales, error } = await query

  if (error) throw error

  const salesRows = sales || []
  const cashierRefIds = [...new Set(salesRows.map((sale: any) => sale.cashier_ref_id).filter((id: any) => Number.isInteger(id)))]
  const managerIds = [...new Set(salesRows.map((sale: any) => sale.cashier_id).filter((id: any) => typeof id === 'string' && id.trim().length > 0))]

  const cashierNameMap = new Map<number, string>()
  const managerNameMap = new Map<string, string>()

  if (cashierRefIds.length > 0) {
    const { data: cashiers, error: cashiersError } = await supabaseAdmin
      .from('cashiers')
      .select('id, full_name')
      .in('id', cashierRefIds)

    if (cashiersError) throw cashiersError

    ;(cashiers || []).forEach((cashier: any) => {
      cashierNameMap.set(cashier.id, cashier.full_name)
    })
  }

  if (managerIds.length > 0) {
    const { data: managers, error: managersError } = await supabaseAdmin
      .from('managers')
      .select('id, full_name')
      .in('id', managerIds)

    if (managersError) throw managersError

    ;(managers || []).forEach((manager: any) => {
      managerNameMap.set(manager.id, manager.full_name)
    })
  }

  const enrichedSales = salesRows.map((sale: any) => {
    const cashierName = sale.cashier_name
      || (Number.isInteger(sale.cashier_ref_id) ? cashierNameMap.get(sale.cashier_ref_id) : null)
      || (typeof sale.cashier_id === 'string' ? managerNameMap.get(sale.cashier_id) : null)
      || null

    return {
      ...sale,
      cashier_name: cashierName,
    }
  })

  // Calculate statistics
  const totalSales = enrichedSales.length || 0
  const totalRevenue = enrichedSales.reduce((sum, sale) => sum + toSafeNumber(sale.total_amount), 0)
  const totalCash = enrichedSales
    .filter((sale: any) => sale.payment_method === 'Cash')
    .reduce((sum: number, sale: any) => sum + getReceivedAmount(sale), 0)
  const totalDigital = enrichedSales
    .filter((sale: any) => sale.payment_method === 'Digital')
    .reduce((sum: number, sale: any) => sum + getReceivedAmount(sale), 0)
  const totalReceived = enrichedSales.reduce((sum, sale) => sum + getReceivedAmount(sale), 0)
  const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0

  // Group by period if specified
  let periodData: any[] = []
  if (filters.period && enrichedSales.length > 0) {
    periodData = groupByPeriod(enrichedSales, filters.period, 'sale_date', 'total_amount')
  }

  // Top products
  const productSales: any = {}
  enrichedSales.forEach(sale => {
    sale.sale_items?.forEach((item: any) => {
      if (!productSales[item.product_name]) {
        productSales[item.product_name] = { quantity: 0, revenue: 0 }
      }
      productSales[item.product_name].quantity += item.quantity
      productSales[item.product_name].revenue += item.subtotal
    })
  })

  const topProducts = Object.entries(productSales)
    .map(([name, data]: [string, any]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return {
    summary: {
      totalSales,
      totalRevenue,
      totalReceived,
      totalCash,
      totalDigital,
      avgOrderValue,
      paidCount: enrichedSales.filter((sale: any) => sale.payment_status === 'Paid').length || 0,
      partialCount: enrichedSales.filter((sale: any) => sale.payment_status === 'Partial').length || 0
    },
    sales: enrichedSales,
    periodData,
    topProducts
  }
}

async function generateExpensesReport(storeId: string, filters: any) {
  let query = supabaseAdmin
    .from('expenses')
    .select('*')
    .eq('store_id', parseInt(storeId))
    .order('expense_date', { ascending: false })
    // Exclude inventory purchase expenses - they're tracked through COGS
    .not('category', 'in', '("new_product","inventory_restock")')

  if (filters.startDate) {
    query = query.gte('expense_date', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('expense_date', filters.endDate)
  }
  if (filters.category) {
    query = query.eq('category', filters.category)
  }
  if (filters.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod)
  }

  const { data: expenses, error } = await query

  if (error) throw error

  // Calculate statistics
  const totalExpenses = expenses?.length || 0
  const totalAmount = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0
  const totalCash = expenses?.filter(e => e.payment_method === 'Cash').reduce((sum, e) => sum + e.amount, 0) || 0
  const totalDigital = expenses?.filter(e => e.payment_method === 'Digital').reduce((sum, e) => sum + e.amount, 0) || 0

  // Group by category
  const categoryStats: any = {}
  expenses?.forEach(exp => {
    const categoryName = exp.category || 'Uncategorized'
    if (!categoryStats[categoryName]) {
      categoryStats[categoryName] = {
        total: 0,
        count: 0,
      }
    }
    categoryStats[categoryName].total += exp.amount
    categoryStats[categoryName].count += 1
  })

  const categoryBreakdown = Object.entries(categoryStats)
    .map(([category, stats]: [string, any]) => ({
      category,
      total: stats.total,
      count: stats.count,
    }))
    .sort((a, b) => b.total - a.total)

  const byCategory: any = {}
  categoryBreakdown.forEach((entry: any) => {
    byCategory[entry.category] = entry.total
  })

  // Group by period if specified
  let periodData: any[] = []
  if (filters.period && expenses) {
    periodData = groupByPeriod(expenses, filters.period, 'expense_date', 'amount')
  }

  return {
    summary: {
      totalExpenses,
      totalAmount,
      totalCash,
      totalDigital
    },
    expenses: expenses || [],
    categoryBreakdown,
    byCategory,
    periodData
  }
}

async function generateInventoryReport(storeId: string, filters: any) {
  let query = supabaseAdmin
    .from('stock_batches')
    .select(`
      *,
      products (
        id,
        name,
        sku,
        categories (name)
      )
    `)
    .eq('store_id', parseInt(storeId))
    .order('purchase_date', { ascending: false })

  if (filters.startDate) {
    query = query.gte('purchase_date', filters.startDate)
  }
  if (filters.endDate) {
    const endDateTime = new Date(filters.endDate)
    endDateTime.setHours(23, 59, 59, 999)
    query = query.lte('purchase_date', endDateTime.toISOString())
  }

  const { data: batches, error } = await query

  if (error) throw error

  const totalStockIn = batches?.reduce((sum, batch) => sum + getPurchasedQuantity(batch), 0) || 0
  const totalStockValue = batches?.reduce((sum, batch) => sum + ((Number(batch.cost_price) || 0) * getRemainingQuantity(batch)), 0) || 0
  const totalRemaining = batches?.reduce((sum, batch) => sum + getRemainingQuantity(batch), 0) || 0
  const totalSold = batches?.reduce((sum, batch) => sum + (getPurchasedQuantity(batch) - getRemainingQuantity(batch)), 0) || 0

  return {
    summary: {
      totalStockIn,
      totalStockValue,
      totalRemaining,
      totalSold
    },
    batches: batches || []
  }
}

async function generateProfitReport(storeId: string, filters: any) {
  const salesReport = await generateSalesReport(storeId, filters)
  const expensesReport = await generateExpensesReport(storeId, filters)

  // Calculate cost of goods sold
  let cogsQuery = supabaseAdmin
    .from('sale_items')
    .select('cost_price_snapshot, quantity, subtotal, sales!inner(store_id, sale_date)')
    .eq('sales.store_id', parseInt(storeId))

  if (filters.startDate) {
    cogsQuery = cogsQuery.gte('sales.sale_date', filters.startDate)
  }

  if (filters.endDate) {
    const endDateTime = new Date(filters.endDate)
    endDateTime.setHours(23, 59, 59, 999)
    cogsQuery = cogsQuery.lte('sales.sale_date', endDateTime.toISOString())
  }

  const { data: salesWithCost, error: salesWithCostError } = await cogsQuery

  if (salesWithCostError) throw salesWithCostError

  let cogs = 0
  if (salesWithCost) {
    salesWithCost.forEach((item: any) => {
      cogs += toSafeNumber(item.cost_price_snapshot) * toSafeNumber(item.quantity)
    })
  }

  const salesTrend = salesReport.periodData || []
  const expensesTrend = expensesReport.periodData || []
  const trendMap = new Map<string, { sales: number; expenses: number }>()

  salesTrend.forEach((point: any) => {
    const existing = trendMap.get(point.date) || { sales: 0, expenses: 0 }
    existing.sales = toSafeNumber(point.value)
    trendMap.set(point.date, existing)
  })

  expensesTrend.forEach((point: any) => {
    const existing = trendMap.get(point.date) || { sales: 0, expenses: 0 }
    existing.expenses = toSafeNumber(point.value)
    trendMap.set(point.date, existing)
  })

  const periodData = Array.from(trendMap.entries())
    .map(([date, values]) => ({
      date,
      value: values.sales - values.expenses,
      sales: values.sales,
      expenses: values.expenses,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const grossProfit = salesReport.summary.totalRevenue - cogs
  const netProfit = grossProfit - expensesReport.summary.totalAmount
  const profitMargin = salesReport.summary.totalRevenue > 0 ? (netProfit / salesReport.summary.totalRevenue) * 100 : 0

  return {
    summary: {
      totalRevenue: salesReport.summary.totalRevenue,
      cogs,
      grossProfit,
      totalExpenses: expensesReport.summary.totalAmount,
      netProfit,
      profitMargin
    },
    periodData,
    salesData: salesReport.periodData,
    expensesData: expensesReport.periodData
  }
}

async function generateSummaryReport(storeId: string, filters: any) {
  const sales = await generateSalesReport(storeId, filters)
  const expenses = await generateExpensesReport(storeId, filters)
  const inventory = await generateInventoryReport(storeId, {})
  const profit = await generateProfitReport(storeId, filters)

  // Calculate cash present (Cash sales - Cash expenses)
  const cashPresent = sales.summary.totalCash - expenses.summary.totalCash

  // Generate cash flow trend data - pass the full reports
  const cashFlowTrend = generateCashFlowTrend(sales, expenses, filters)

  return {
    sales: sales.summary,
    expenses: expenses.summary,
    inventory: inventory.summary,
    profit: profit.summary,
    cashPresent, // Add cash present to summary
    cashFlowTrend
  }
}

function generateCashFlowTrend(salesReport: any, expensesReport: any, filters: any) {
  const salesData = salesReport.sales || []
  const expensesData = expensesReport.expenses || []

  const transactionDates = [
    ...salesData.map((sale: any) => new Date(sale.sale_date)),
    ...expensesData.map((expense: any) => new Date(expense.expense_date))
  ].filter((date: Date) => !Number.isNaN(date.getTime()))

  let startDate = filters.startDate ? new Date(filters.startDate) : null
  let endDate = filters.endDate ? new Date(filters.endDate) : null

  if (!startDate && transactionDates.length > 0) {
    startDate = new Date(Math.min(...transactionDates.map(date => date.getTime())))
  }

  if (!endDate && transactionDates.length > 0) {
    endDate = new Date(Math.max(...transactionDates.map(date => date.getTime())))
  }

  if (!startDate) {
    startDate = new Date()
  }

  if (!endDate) {
    endDate = new Date()
  }

  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)

  // Create daily entries for the entire range
  const trendMap: any = {}

  // Fill in all dates in the range with zero values
  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0]
    trendMap[dateStr] = { date: dateStr, cashIn: 0, cashOut: 0 }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Add sales data
  salesData.forEach((sale: any) => {
    const date = new Date(sale.sale_date).toISOString().split('T')[0]
    if (trendMap[date]) {
      trendMap[date].cashIn += getReceivedAmount(sale)
    }
  })

  // Add expenses data
  expensesData.forEach((expense: any) => {
    const date = new Date(expense.expense_date).toISOString().split('T')[0]
    if (trendMap[date]) {
      trendMap[date].cashOut += expense.amount
    }
  })

  // Convert to array and sort by date
  return Object.values(trendMap)
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
}

function groupByPeriod(data: any[], period: string, dateField: string, valueField: string) {
  const grouped: any = {}

  data.forEach(item => {
    const date = new Date(item[dateField])
    let key: string

    switch (period) {
      case 'daily':
        key = date.toISOString().split('T')[0]
        break
      case 'weekly':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split('T')[0]
        break
      case 'monthly':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        break
      case 'yearly':
        key = date.getFullYear().toString()
        break
      default:
        key = date.toISOString().split('T')[0]
    }

    if (!grouped[key]) {
      grouped[key] = 0
    }
    grouped[key] += item[valueField]
  })

  return Object.entries(grouped)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
