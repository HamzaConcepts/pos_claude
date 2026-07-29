import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPurchasedQuantity, getRemainingQuantity } from '@/lib/stock-quantities'
import { getConfiguredTimeZone, getDateStringInTimeZone, getTimeZoneDayBounds } from '@/lib/timezone'

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

async function getOutstandingCustomerDue(storeId: number) {
  const { data, error } = await supabaseAdmin
    .from('partial_payment_customers')
    .select('amount_remaining')
    .eq('store_id', storeId)
    .gt('amount_remaining', 0)

  if (error) throw error

  const rows = data || []
  const total = rows.reduce((sum: number, row: any) => sum + toSafeNumber(row.amount_remaining), 0)

  return {
    total,
    count: rows.length,
  }
}

async function getOutstandingSupplierDue(storeId: number) {
  const { data, error } = await supabaseAdmin
    .from('supplier_khaata')
    .select('amount_remaining')
    .eq('store_id', storeId)
    .gt('amount_remaining', 0)

  if (error) throw error

  const rows = data || []
  const total = rows.reduce((sum: number, row: any) => sum + toSafeNumber(row.amount_remaining), 0)

  return {
    total,
    count: rows.length,
  }
}

async function getReturnFlowImpact(storeId: number, startDate?: string | null, endDate?: string | null) {
  const timeZone = getConfiguredTimeZone()
  let returnsQuery = supabaseAdmin
    .from('returns')
    .select('id, store_id, sale_id, return_type, total_refund_amount, refund_method, return_date, created_at')
    .eq('store_id', storeId)
    .order('return_date', { ascending: false })

  if (startDate) {
    returnsQuery = returnsQuery.gte('return_date', getTimeZoneDayBounds(startDate, timeZone).start)
  }
  if (endDate) {
    returnsQuery = returnsQuery.lte('return_date', getTimeZoneDayBounds(endDate, timeZone).end)
  }

  const [
    { data: returns, error: returnsError },
    { data: saleBankRows, error: saleBankError },
  ] = await Promise.all([
    returnsQuery,
    supabaseAdmin
      .from('sales')
      .select('id, bank_account_name')
      .eq('store_id', storeId),
  ])

  if (returnsError) throw returnsError
  if (saleBankError) throw saleBankError

  const saleBankMap = new Map<number, string>()
  ;(saleBankRows || []).forEach((sale: any) => {
    if (Number.isInteger(sale.id)) {
      saleBankMap.set(sale.id, normalizeBankName(sale.bank_account_name))
    }
  })

  const impact = {
    customerCashOut: 0,
    customerBankOut: 0,
    supplierCashIn: 0,
    supplierBankIn: 0,
    customerDigitalRefunds: [] as Array<{ amount: number; bank_account_name: string; date: string; return_id: number }>,
    supplierDigitalRefunds: [] as Array<{ amount: number; bank_account_name: string; date: string; return_id: number }>,
    customerCashRefunds: [] as Array<{ amount: number; date: string; return_id: number }>,
    supplierCashRefunds: [] as Array<{ amount: number; date: string; return_id: number }>,
  }

  ;(returns || []).forEach((returnRow: any) => {
    const amount = toSafeNumber(returnRow.total_refund_amount)
    const refundMethod = String(returnRow.refund_method || 'Cash')
    const date = returnRow.return_date || returnRow.created_at || new Date().toISOString()

    if (returnRow.return_type === 'customer') {
      if (refundMethod === 'Cash') {
        impact.customerCashOut += amount
        impact.customerCashRefunds.push({ amount, date, return_id: returnRow.id })
      } else if (refundMethod === 'Digital') {
        const bankAccountName = returnRow.sale_id ? saleBankMap.get(returnRow.sale_id) || 'Unassigned' : 'Unassigned'
        impact.customerBankOut += amount
        impact.customerDigitalRefunds.push({ amount, bank_account_name: bankAccountName, date, return_id: returnRow.id })
      }
    }

    if (returnRow.return_type === 'supplier') {
      if (refundMethod === 'Cash') {
        impact.supplierCashIn += amount
        impact.supplierCashRefunds.push({ amount, date, return_id: returnRow.id })
      } else if (refundMethod === 'Digital') {
        impact.supplierBankIn += amount
        impact.supplierDigitalRefunds.push({ amount, bank_account_name: 'Unassigned', date, return_id: returnRow.id })
      }
    }
  })

  return impact
}

const normalizeBankName = (value: any): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return 'Unassigned'
}

const applyTimestampRange = (query: any, field: string, startDate?: string | null, endDate?: string | null) => {
  const timeZone = getConfiguredTimeZone()
  let next = query
  if (startDate) {
    next = next.gte(field, getTimeZoneDayBounds(startDate, timeZone).start)
  }
  if (endDate) {
    next = next.lte(field, getTimeZoneDayBounds(endDate, timeZone).end)
  }
  return next
}

const applyDateRange = (query: any, field: string, startDate?: string | null, endDate?: string | null) => {
  let next = query
  if (startDate) {
    next = next.gte(field, startDate)
  }
  if (endDate) {
    next = next.lte(field, endDate)
  }
  return next
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
      case 'bank-transactions':
        reportData = await generateBankTransactionsReport(storeId, { startDate, endDate })
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
  const timeZone = getConfiguredTimeZone()
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
    query = query.gte('sale_date', getTimeZoneDayBounds(filters.startDate, timeZone).start)
  }
  if (filters.endDate) {
    query = query.lte('sale_date', getTimeZoneDayBounds(filters.endDate, timeZone).end)
  }
  if (filters.cashierId) {
    const cashierRefId = Number.parseInt(filters.cashierId, 10)
    if (!Number.isNaN(cashierRefId)) {
      query = query.eq('cashier_ref_id', cashierRefId)
    }
  }
  const { data: sales, error } = await query

  if (error) throw error

  const salesRows = sales || []
  const saleIds = salesRows.map((sale: any) => sale.id).filter((id: any) => Number.isInteger(id))
  const paymentTotals = new Map<number, { cash: number; digital: number }>()

  if (saleIds.length > 0) {
    const { data: paymentRows, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('sale_id, amount, payment_method')
      .in('sale_id', saleIds)

    if (paymentError) throw paymentError

    ;(paymentRows || []).forEach((payment: any) => {
      if (!Number.isInteger(payment.sale_id)) return
      if (payment.payment_method !== 'Cash' && payment.payment_method !== 'Digital') return

      const current = paymentTotals.get(payment.sale_id) || { cash: 0, digital: 0 }
      const amount = toSafeNumber(payment.amount)

      if (payment.payment_method === 'Cash') {
        current.cash += amount
      } else {
        current.digital += amount
      }

      paymentTotals.set(payment.sale_id, current)
    })
  }
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

  let enrichedSales = salesRows.map((sale: any) => {
    const cashierName = sale.cashier_name
      || (Number.isInteger(sale.cashier_ref_id) ? cashierNameMap.get(sale.cashier_ref_id) : null)
      || (typeof sale.cashier_id === 'string' ? managerNameMap.get(sale.cashier_id) : null)
      || null

    const totals = paymentTotals.get(sale.id)
    const cashPaid = totals?.cash || 0
    const digitalPaid = totals?.digital || 0

    return {
      ...sale,
      cashier_name: cashierName,
      cash_paid: cashPaid,
      digital_paid: digitalPaid,
    }
  })

  if (filters.paymentMethod) {
    enrichedSales = enrichedSales.filter((sale: any) => {
      const cashPaid = toSafeNumber(sale.cash_paid)
      const digitalPaid = toSafeNumber(sale.digital_paid)

      if (filters.paymentMethod === 'Cash') {
        return cashPaid > 0 || (cashPaid === 0 && digitalPaid === 0 && sale.payment_method === 'Cash')
      }

      if (filters.paymentMethod === 'Digital') {
        return digitalPaid > 0 || (cashPaid === 0 && digitalPaid === 0 && sale.payment_method === 'Digital')
      }

      if (filters.paymentMethod === 'Mixed') {
        return cashPaid > 0 && digitalPaid > 0
      }

      return sale.payment_method === filters.paymentMethod
    })
  }

  // Calculate statistics
  const totalSales = enrichedSales.length || 0
  const totalRevenue = enrichedSales.reduce((sum, sale) => sum + toSafeNumber(sale.total_amount), 0)
  const totalCash = enrichedSales.reduce((sum: number, sale: any) => {
    const cashPaid = toSafeNumber(sale.cash_paid)
    const digitalPaid = toSafeNumber(sale.digital_paid)

    if (cashPaid > 0 || digitalPaid > 0) {
      return sum + cashPaid
    }

    return sale.payment_method === 'Cash' ? sum + getReceivedAmount(sale) : sum
  }, 0)
  const totalDigital = enrichedSales.reduce((sum: number, sale: any) => {
    const cashPaid = toSafeNumber(sale.cash_paid)
    const digitalPaid = toSafeNumber(sale.digital_paid)

    if (cashPaid > 0 || digitalPaid > 0) {
      return sum + digitalPaid
    }

    return sale.payment_method === 'Digital' ? sum + getReceivedAmount(sale) : sum
  }, 0)
  const totalReceived = enrichedSales.reduce((sum: number, sale: any) => {
    const cashPaid = toSafeNumber(sale.cash_paid)
    const digitalPaid = toSafeNumber(sale.digital_paid)
    if (cashPaid > 0 || digitalPaid > 0) {
      return sum + cashPaid + digitalPaid
    }
    return sum + getReceivedAmount(sale)
  }, 0)
  const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0

  // Group by period if specified
  let periodData: any[] = []
  if (filters.period && enrichedSales.length > 0) {
    periodData = groupByPeriod(enrichedSales, filters.period, 'sale_date', 'total_amount', timeZone)
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
  const timeZone = getConfiguredTimeZone()
  let query = supabaseAdmin
    .from('expenses')
    .select('*')
    .eq('store_id', parseInt(storeId))
    .order('expense_date', { ascending: false })
    // Exclude inventory purchase expenses - they're tracked through COGS
    .not('category', 'in', '("new_product","inventory_restock")')

  if (filters.startDate) {
    query = query.gte('expense_date', getDateStringInTimeZone(new Date(`${filters.startDate}T00:00:00`), timeZone))
  }
  if (filters.endDate) {
    query = query.lte('expense_date', getDateStringInTimeZone(new Date(`${filters.endDate}T00:00:00`), timeZone))
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
    periodData = groupByPeriod(expenses, filters.period, 'expense_date', 'amount', timeZone)
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
  const timeZone = getConfiguredTimeZone()
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
    query = query.gte('purchase_date', getTimeZoneDayBounds(filters.startDate, timeZone).start)
  }
  if (filters.endDate) {
    query = query.lte('purchase_date', getTimeZoneDayBounds(filters.endDate, timeZone).end)
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
  const period = filters.period || 'monthly'
  const timeZone = getConfiguredTimeZone()
  const storeIdNumber = parseInt(storeId, 10)
  const customerDue = await getOutstandingCustomerDue(storeIdNumber)
  const supplierDue = await getOutstandingSupplierDue(storeIdNumber)
  const showDueCards = !filters.startDate && !filters.endDate

  // Calculate cost of goods sold from the same filtered sales rows used for revenue
  let cogs = 0

  const trendMap = new Map<string, { sales: number; expenses: number; cogs: number }>()

  const ensureBucket = (date: string) => {
    if (!trendMap.has(date)) {
      trendMap.set(date, { sales: 0, expenses: 0, cogs: 0 })
    }
    return trendMap.get(date)!
  }

  ;(salesReport.sales || []).forEach((sale: any) => {
    const saleDate = sale.sale_date
    if (!saleDate) return

    const bucket = ensureBucket(getPeriodKey(new Date(saleDate), period, timeZone))
    bucket.sales += toSafeNumber(sale.total_amount)

    const saleItems = Array.isArray(sale.sale_items) ? sale.sale_items : []
    saleItems.forEach((item: any) => {
      const amount = toSafeNumber(item.cost_price_snapshot) * toSafeNumber(item.quantity)
      cogs += amount
      bucket.cogs += amount
    })
  })

  ;(expensesReport.expenses || []).forEach((expense: any) => {
    const expenseDate = expense.expense_date
    if (!expenseDate) return

    const bucket = ensureBucket(getPeriodKey(new Date(expenseDate), period, timeZone))
    bucket.expenses += toSafeNumber(expense.amount)
  })

  const periodData = Array.from(trendMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => {
      const sales = toSafeNumber(values.sales)
      const cogs = toSafeNumber(values.cogs)
      const expenses = toSafeNumber(values.expenses)
      const grossProfit = sales - cogs
      const netProfit = grossProfit - expenses

      return {
        date,
        value: netProfit,
        netProfit,
        grossProfit,
        sales,
        expenses,
        cogs,
      }
    })

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
      profitMargin,
      customerDue: showDueCards ? customerDue.total : 0,
      supplierDue: showDueCards ? supplierDue.total : 0,
      showDueCards,
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
  const returnFlow = await getReturnFlowImpact(parseInt(storeId, 10), filters.startDate, filters.endDate)
  const storeIdNumber = parseInt(storeId, 10)
  const customerDue = await getOutstandingCustomerDue(storeIdNumber)
  const supplierDue = await getOutstandingSupplierDue(storeIdNumber)

  // Calculate cash present (Cash sales - Cash expenses)
  const cashPresent = sales.summary.totalCash - expenses.summary.totalCash - returnFlow.customerCashOut + returnFlow.supplierCashIn

  // Generate cash flow trend data - pass the full reports
  const cashFlowTrend = generateCashFlowTrend(sales, expenses, filters, returnFlow)

  return {
    sales: sales.summary,
    expenses: expenses.summary,
    inventory: inventory.summary,
    profit: profit.summary,
    cashPresent, // Add cash present to summary
    returns: returnFlow,
    cashFlowTrend
  }
}

async function generateBankTransactionsReport(storeId: string, filters: any) {
  const parsedStoreId = parseInt(storeId, 10)
  const { startDate, endDate } = filters || {}
  const returnFlow = await getReturnFlowImpact(parsedStoreId, startDate, endDate)

  const bankAccountsQuery = supabaseAdmin
    .from('store_bank_accounts')
    .select('id, account_name')
    .eq('store_id', parsedStoreId)
    .order('account_name', { ascending: true })

  const bankBalancesQuery = supabaseAdmin
    .from('store_bank_balances')
    .select('bank_account_id, opening_balance')
    .eq('store_id', parsedStoreId)

  const paymentsQuery = applyTimestampRange(
    supabaseAdmin
      .from('payments')
      .select('sale_id, amount, payment_method, bank_account_name, payment_date')
      .eq('store_id', parsedStoreId),
    'payment_date',
    startDate,
    endDate
  )

  const salesQuery = applyTimestampRange(
    supabaseAdmin
      .from('sales')
      .select('id, amount_paid, total_amount, payment_method, bank_account_name, sale_date')
      .eq('store_id', parsedStoreId),
    'sale_date',
    startDate,
    endDate
  )

  const customerPaymentsQuery = applyTimestampRange(
    supabaseAdmin
      .from('customer_payments')
      .select('payment_amount, payment_method, bank_account_name, payment_date, customer_name')
      .eq('store_id', parsedStoreId),
    'payment_date',
    startDate,
    endDate
  )

  const supplierKhaataPaymentsQuery = applyTimestampRange(
    supabaseAdmin
      .from('supplier_khaata_payments')
      .select('payment_amount, payment_method, bank_account_name, payment_date, supplier_name')
      .eq('store_id', parsedStoreId),
    'payment_date',
    startDate,
    endDate
  )

  const supplierPaymentsQuery = applyTimestampRange(
    supabaseAdmin
      .from('supplier_payments')
      .select('amount, payment_method, bank_account_name, payment_date, supplier_id')
      .eq('store_id', parsedStoreId),
    'payment_date',
    startDate,
    endDate
  )

  const expensesQuery = applyDateRange(
    supabaseAdmin
      .from('expenses')
      .select('amount, payment_method, bank_account_name, expense_date, description')
      .eq('store_id', parsedStoreId),
    'expense_date',
    startDate,
    endDate
  )

  const inventoryPaymentsQuery = applyTimestampRange(
    supabaseAdmin
      .from('inventory_purchase_payments')
      .select('amount, payment_method, bank_account_name, created_at, stock_batch_id')
      .eq('store_id', parsedStoreId),
    'created_at',
    startDate,
    endDate
  )

  const cashTransfersQuery = applyDateRange(
    supabaseAdmin
      .from('cash_transfers')
      .select('transfer_amount, bank_name, transfer_date, transfer_direction')
      .eq('store_id', parsedStoreId),
    'transfer_date',
    startDate,
    endDate
  )

  const [
    { data: bankAccounts, error: bankAccountsError },
    { data: payments, error: paymentsError },
    { data: sales, error: salesError },
    { data: customerPayments, error: customerPaymentsError },
    { data: supplierKhaataPayments, error: supplierKhaataPaymentsError },
    { data: supplierPayments, error: supplierPaymentsError },
    { data: expenses, error: expensesError },
    { data: inventoryPayments, error: inventoryPaymentsError },
    { data: cashTransfers, error: cashTransfersError },
    { data: bankBalances, error: bankBalancesError },
  ] = await Promise.all([
    bankAccountsQuery,
    paymentsQuery,
    salesQuery,
    customerPaymentsQuery,
    supplierKhaataPaymentsQuery,
    supplierPaymentsQuery,
    expensesQuery,
    inventoryPaymentsQuery,
    cashTransfersQuery,
    bankBalancesQuery,
  ])

  if (bankAccountsError) throw bankAccountsError
  if (paymentsError) throw paymentsError
  if (salesError) throw salesError
  if (customerPaymentsError) throw customerPaymentsError
  if (supplierKhaataPaymentsError) throw supplierKhaataPaymentsError
  if (supplierPaymentsError) throw supplierPaymentsError
  if (expensesError) throw expensesError
  if (inventoryPaymentsError) throw inventoryPaymentsError
  if (cashTransfersError) throw cashTransfersError
  if (bankBalancesError) throw bankBalancesError

  const openingBalanceByAccountId = new Map<number, number>()
  ;(bankBalances || []).forEach((row: any) => {
    if (!Number.isFinite(row.bank_account_id)) return
    openingBalanceByAccountId.set(row.bank_account_id, toSafeNumber(row.opening_balance))
  })

  const openingBalanceByName = new Map<string, number>()
  ;(bankAccounts || []).forEach((account: any) => {
    const name = normalizeBankName(account.account_name)
    openingBalanceByName.set(name, openingBalanceByAccountId.get(account.id) ?? 0)
  })

  const bankTotals = new Map<string, { received: number; paid: number; receivedCount: number; paidCount: number; openingBalance: number }>()
  const transactions: Array<{ bank_account_name: string; direction: 'received' | 'paid'; amount: number; date: string; source: string; reference?: string | null }> = []

  const seedBank = (name: string, openingBalance?: number) => {
    if (!bankTotals.has(name)) {
      bankTotals.set(name, { received: 0, paid: 0, receivedCount: 0, paidCount: 0, openingBalance: openingBalance ?? 0 })
      return
    }

    if (openingBalance !== undefined) {
      const existing = bankTotals.get(name)!
      if (!Number.isFinite(existing.openingBalance) || existing.openingBalance === 0) {
        existing.openingBalance = openingBalance
      }
    }
  }

  ;(bankAccounts || []).forEach((account: any) => {
    const normalizedName = normalizeBankName(account.account_name)
    seedBank(normalizedName, openingBalanceByName.get(normalizedName) ?? 0)
  })

  const addTransaction = (input: { bankName: any; direction: 'received' | 'paid'; amount: number; date: any; source: string; reference?: string | null }) => {
    if (!Number.isFinite(input.amount) || input.amount <= 0) return
    const bankName = normalizeBankName(input.bankName)
    seedBank(bankName, openingBalanceByName.get(bankName) ?? 0)
    const summary = bankTotals.get(bankName)!

    if (input.direction === 'received') {
      summary.received += input.amount
      summary.receivedCount += 1
    } else {
      summary.paid += input.amount
      summary.paidCount += 1
    }

    transactions.push({
      bank_account_name: bankName,
      direction: input.direction,
      amount: input.amount,
      date: input.date ? new Date(input.date).toISOString() : new Date().toISOString(),
      source: input.source,
      reference: input.reference || null,
    })
  }

  const paymentsBySale = new Set<number>()
  ;(payments || []).forEach((payment: any) => {
    const method = payment.payment_method
    if (method === 'Digital') {
      addTransaction({
        bankName: payment.bank_account_name,
        direction: 'received',
        amount: toSafeNumber(payment.amount),
        date: payment.payment_date,
        source: 'Sale Payment',
        reference: payment.sale_id ? `Sale #${payment.sale_id}` : null,
      })
    }

    const saleId = Number(payment.sale_id)
    if (Number.isFinite(saleId)) {
      paymentsBySale.add(saleId)
    }
  })

  ;(sales || []).forEach((sale: any) => {
    const saleId = Number(sale.id)
    if (Number.isFinite(saleId) && paymentsBySale.has(saleId)) return

    if (sale.payment_method === 'Digital') {
      addTransaction({
        bankName: sale.bank_account_name,
        direction: 'received',
        amount: getReceivedAmount(sale),
        date: sale.sale_date,
        source: 'Sale',
        reference: sale.id ? `Sale #${sale.id}` : null,
      })
    }
  })

  ;(customerPayments || []).forEach((payment: any) => {
    if (payment.payment_method !== 'Digital') return
    addTransaction({
      bankName: payment.bank_account_name,
      direction: 'received',
      amount: toSafeNumber(payment.payment_amount),
      date: payment.payment_date,
      source: 'Customer Ledger',
      reference: payment.customer_name || null,
    })
  })

  ;(supplierKhaataPayments || []).forEach((payment: any) => {
    if (payment.payment_method !== 'Digital') return
    addTransaction({
      bankName: payment.bank_account_name,
      direction: 'paid',
      amount: toSafeNumber(payment.payment_amount),
      date: payment.payment_date,
      source: 'Supplier Ledger',
      reference: payment.supplier_name || null,
    })
  })

  ;(supplierPayments || []).forEach((payment: any) => {
    if (payment.payment_method !== 'Digital') return
    addTransaction({
      bankName: payment.bank_account_name,
      direction: 'paid',
      amount: toSafeNumber(payment.amount),
      date: payment.payment_date,
      source: 'Supplier Payment',
      reference: payment.supplier_id ? `Supplier #${payment.supplier_id}` : null,
    })
  })

  ;(expenses || []).forEach((expense: any) => {
    if (expense.payment_method !== 'Digital') return
    addTransaction({
      bankName: expense.bank_account_name,
      direction: 'paid',
      amount: toSafeNumber(expense.amount),
      date: expense.expense_date,
      source: 'Expense',
      reference: expense.description || null,
    })
  })

  ;(inventoryPayments || []).forEach((payment: any) => {
    if (payment.payment_method !== 'Digital') return
    addTransaction({
      bankName: payment.bank_account_name,
      direction: 'paid',
      amount: toSafeNumber(payment.amount),
      date: payment.created_at,
      source: 'Inventory Purchase',
      reference: payment.stock_batch_id ? `Batch #${payment.stock_batch_id}` : null,
    })
  })

  ;(cashTransfers || []).forEach((transfer: any) => {
    const direction = transfer.transfer_direction === 'bank_to_cash' ? 'bank_to_cash' : 'cash_to_bank'
    addTransaction({
      bankName: transfer.bank_name,
      direction: direction === 'bank_to_cash' ? 'paid' : 'received',
      amount: toSafeNumber(transfer.transfer_amount),
      date: transfer.transfer_date,
      source: 'Cash Transfer',
    })
  })

  ;(returnFlow.customerDigitalRefunds || []).forEach((refund) => {
    addTransaction({
      bankName: refund.bank_account_name,
      direction: 'paid',
      amount: refund.amount,
      date: refund.date,
      source: 'Customer Return',
      reference: `Return #${refund.return_id}`,
    })
  })

  ;(returnFlow.supplierDigitalRefunds || []).forEach((refund) => {
    addTransaction({
      bankName: refund.bank_account_name,
      direction: 'received',
      amount: refund.amount,
      date: refund.date,
      source: 'Supplier Return',
      reference: `Return #${refund.return_id}`,
    })
  })

  const banks = Array.from(bankTotals.entries()).map(([bankName, totals]) => ({
    bank_account_name: bankName,
    opening_balance: totals.openingBalance ?? 0,
    received: totals.received,
    paid: totals.paid,
    net: totals.received - totals.paid,
    closing_balance: (totals.openingBalance ?? 0) + totals.received - totals.paid,
    receivedCount: totals.receivedCount,
    paidCount: totals.paidCount,
    totalCount: totals.receivedCount + totals.paidCount,
  }))

  banks.sort((a, b) => a.bank_account_name.localeCompare(b.bank_account_name))

  const totalReceived = banks.reduce((sum, row) => sum + row.received, 0)
  const totalPaid = banks.reduce((sum, row) => sum + row.paid, 0)
  const totalOpeningBalance = banks.reduce((sum, row) => sum + (row.opening_balance ?? 0), 0)
  const totalClosingBalance = totalOpeningBalance + totalReceived - totalPaid

  transactions.sort((a, b) => b.date.localeCompare(a.date))

  return {
    summary: {
      totalReceived,
      totalPaid,
      net: totalReceived - totalPaid,
      totalOpeningBalance,
      totalClosingBalance,
    },
    banks,
    transactions,
  }
}

function generateCashFlowTrend(salesReport: any, expensesReport: any, filters: any, returnFlow?: any) {
  const salesData = salesReport.sales || []
  const expensesData = expensesReport.expenses || []
  const customerCashRefunds = returnFlow?.customerCashRefunds || []
  const supplierCashRefunds = returnFlow?.supplierCashRefunds || []

  const transactionDates = [
    ...salesData.map((sale: any) => new Date(sale.sale_date)),
    ...expensesData.map((expense: any) => new Date(expense.expense_date)),
    ...customerCashRefunds.map((refund: any) => new Date(refund.date)),
    ...supplierCashRefunds.map((refund: any) => new Date(refund.date)),
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

  customerCashRefunds.forEach((refund: any) => {
    const date = new Date(refund.date).toISOString().split('T')[0]
    if (trendMap[date]) {
      trendMap[date].cashOut += refund.amount
    }
  })

  supplierCashRefunds.forEach((refund: any) => {
    const date = new Date(refund.date).toISOString().split('T')[0]
    if (trendMap[date]) {
      trendMap[date].cashIn += refund.amount
    }
  })

  // Convert to array and sort by date
  return Object.values(trendMap)
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
}

function getPeriodKey(date: Date, period: string, timeZone: string) {
  const localDate = getDateStringInTimeZone(date, timeZone)
  const [year, month, day] = localDate.split('-').map(Number)
  const localDateAtMidnight = new Date(Date.UTC(year, month - 1, day))

  switch (period) {
    case 'daily':
      return localDate
    case 'weekly': {
      const weekStart = new Date(localDateAtMidnight)
      weekStart.setUTCDate(localDateAtMidnight.getUTCDate() - localDateAtMidnight.getUTCDay())
      return getDateStringInTimeZone(weekStart, timeZone)
    }
    case 'monthly':
      return `${year}-${String(month).padStart(2, '0')}`
    case 'yearly':
      return year.toString()
    default:
      return localDate
  }
}

function groupByPeriod(data: any[], period: string, dateField: string, valueField: string, timeZone = getConfiguredTimeZone()) {
  const grouped: any = {}

  data.forEach(item => {
    const date = new Date(item[dateField])
    const key = getPeriodKey(date, period, timeZone)

    if (!grouped[key]) {
      grouped[key] = 0
    }
    grouped[key] += item[valueField]
  })

  return Object.entries(grouped)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
