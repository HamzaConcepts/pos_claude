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
        reportData = await generateSummaryReport(storeId, { startDate, endDate, period })
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
    query = query.eq('cashier_id', filters.cashierId)
  }
  if (filters.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod)
  }

  const { data: sales, error } = await query

  if (error) throw error

  // Calculate statistics
  const totalSales = sales?.length || 0
  const totalRevenue = sales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0
  const totalCash = sales?.filter(s => s.payment_method === 'Cash').reduce((sum, s) => sum + s.total_amount, 0) || 0
  const totalDigital = sales?.filter(s => s.payment_method === 'Digital').reduce((sum, s) => sum + s.total_amount, 0) || 0
  const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0

  // Group by period if specified
  let periodData: any[] = []
  if (filters.period && sales) {
    periodData = groupByPeriod(sales, filters.period, 'sale_date', 'total_amount')
  }

  // Top products
  const productSales: any = {}
  sales?.forEach(sale => {
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
      totalCash,
      totalDigital,
      avgOrderValue,
      paidCount: sales?.filter(s => s.payment_status === 'Paid').length || 0,
      partialCount: sales?.filter(s => s.payment_status === 'Partial').length || 0
    },
    sales: sales || [],
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
    const endDateTime = new Date(filters.endDate)
    endDateTime.setHours(23, 59, 59, 999)
    query = query.lte('expense_date', endDateTime.toISOString())
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
  const byCategory: any = {}
  expenses?.forEach(exp => {
    if (!byCategory[exp.category]) {
      byCategory[exp.category] = 0
    }
    byCategory[exp.category] += exp.amount
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
    query = query.lte('purchase_date', filters.endDate)
  }

  const { data: batches, error } = await query

  if (error) throw error

  const totalStockIn = batches?.reduce((sum, batch) => sum + getPurchasedQuantity(batch), 0) || 0
  const totalStockValue = batches?.reduce((sum, batch) => sum + ((Number(batch.cost_price) || 0) * getPurchasedQuantity(batch)), 0) || 0
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
  const { data: salesWithCost } = await supabaseAdmin
    .from('sale_items')
    .select('cost_price_snapshot, quantity, subtotal, sales!inner(store_id, sale_date)')
    .eq('sales.store_id', parseInt(storeId))

  let cogs = 0
  if (salesWithCost) {
    const endDateTime = filters.endDate ? new Date(filters.endDate) : null
    if (endDateTime) {
      endDateTime.setHours(23, 59, 59, 999)
    }

    salesWithCost.forEach((item: any) => {
      if (filters.startDate && new Date(item.sales.sale_date) < new Date(filters.startDate)) return
      if (endDateTime && new Date(item.sales.sale_date) > endDateTime) return
      cogs += (item.cost_price_snapshot || 0) * item.quantity
    })
  }

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
    salesData: salesReport.periodData,
    expensesData: expensesReport.periodData
  }
}

async function generateSummaryReport(storeId: string, filters: any) {
  const sales = await generateSalesReport(storeId, filters)
  const expenses = await generateExpensesReport(storeId, filters)
  const inventory = await generateInventoryReport(storeId, filters)
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
  // Determine date range
  const startDate = filters.startDate ? new Date(filters.startDate) : new Date()
  const endDate = filters.endDate ? new Date(filters.endDate) : new Date()
  
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
  const salesData = salesReport.sales || []
  salesData.forEach((sale: any) => {
    const date = new Date(sale.sale_date).toISOString().split('T')[0]
    if (trendMap[date]) {
      trendMap[date].cashIn += sale.total_amount
    }
  })

  // Add expenses data
  const expensesData = expensesReport.expenses || []
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
