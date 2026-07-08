import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConfiguredTimeZone, getDateStringInTimeZone, getStartOfMonthInTimeZone, getTimeZoneDayBounds } from '@/lib/timezone'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Create admin client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export async function GET(request: Request) {
  try {
    // Get store_id from query params
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    const timeZone = getConfiguredTimeZone()
    const today = getDateStringInTimeZone(new Date(), timeZone)
    const startOfToday = getTimeZoneDayBounds(today, timeZone).start
    const startOfMonth = getStartOfMonthInTimeZone(today, timeZone)

    // Today's sales
    const { data: todaySales } = await supabaseAdmin
      .from('sales')
      .select('id, total_amount')
      .eq('store_id', parseInt(storeId))
      .gte('sale_date', startOfToday)

    const todaySalesCount = todaySales?.length || 0
    const todayRevenue = todaySales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0

    // Monthly sales
    const { data: monthlySales } = await supabaseAdmin
      .from('sales')
      .select('id, total_amount, sale_date')
      .eq('store_id', parseInt(storeId))
      .gte('sale_date', startOfMonth)

    const monthlySalesCount = monthlySales?.length || 0
    const monthlyRevenue = monthlySales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0

    // Low stock products
    const { data: allProducts } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        name,
        is_active,
        aggregated_stock (
          aggregated_selling_price,
          total_quantity_remaining,
          low_stock_threshold
        )
      `)
      .eq('store_id', parseInt(storeId))
      .eq('is_active', true)

    const lowStockProducts = allProducts?.filter(p => {
      const aggStock = (p as any).aggregated_stock?.[0]
      const stockQty = aggStock?.total_quantity_remaining || 0
      const threshold = aggStock?.low_stock_threshold || 10
      return stockQty <= threshold
    }).map(p => {
      const aggStock = (p as any).aggregated_stock?.[0]
      return {
        id: p.id,
        name: p.name,
        price: aggStock?.aggregated_selling_price || 0,
        stock_quantity: aggStock?.total_quantity_remaining || 0,
        low_stock_threshold: aggStock?.low_stock_threshold || 10
      }
    }).slice(0, 5) || []
    
    const lowStockCount = allProducts?.filter(p => {
      const aggStock = (p as any).aggregated_stock?.[0]
      const stockQty = aggStock?.total_quantity_remaining || 0
      const threshold = aggStock?.low_stock_threshold || 10
      return stockQty <= threshold
    }).length || 0

    // Recent sales
    const { data: recentSales } = await supabaseAdmin
      .from('sales')
      .select('id, sale_number, total_amount, sale_date, payment_method, payment_status, cashier_id')
      .eq('store_id', parseInt(storeId))
      .order('sale_date', { ascending: false })
      .limit(10)

    const todaySaleIds = (todaySales || []).map((sale: any) => sale.id).filter((id: any) => Number.isInteger(id))
    const monthlySaleIds = (monthlySales || []).map((sale: any) => sale.id).filter((id: any) => Number.isInteger(id))
    const recentSaleIds = (recentSales || []).map((sale: any) => sale.id).filter((id: any) => Number.isInteger(id))
    const allSaleIds = Array.from(new Set([...todaySaleIds, ...monthlySaleIds, ...recentSaleIds]))
    const paymentTotals = new Map<number, { cash: number; digital: number }>()

    if (allSaleIds.length > 0) {
      const { data: paymentRows, error: paymentError } = await supabaseAdmin
        .from('payments')
        .select('sale_id, amount, payment_method')
        .in('sale_id', allSaleIds)

      if (paymentError) throw paymentError

      ;(paymentRows || []).forEach((payment: any) => {
        if (!Number.isInteger(payment.sale_id)) return
        if (payment.payment_method !== 'Cash' && payment.payment_method !== 'Digital') return

        const current = paymentTotals.get(payment.sale_id) || { cash: 0, digital: 0 }
        const amount = Number(payment.amount) || 0

        if (payment.payment_method === 'Cash') {
          current.cash += amount
        } else {
          current.digital += amount
        }

        paymentTotals.set(payment.sale_id, current)
      })
    }

    // Fetch cashier names for recent sales
    if (recentSales && recentSales.length > 0) {
      const cashierIds = [...new Set(recentSales.map(s => s.cashier_id).filter(Boolean))]
      
      if (cashierIds.length > 0) {
        // Separate UUIDs (managers) from integers (cashiers)
        const managerIds = cashierIds.filter(id => typeof id === 'string' && id.includes('-'))
        const cashierAccountIds = cashierIds.filter(id => typeof id === 'number' || (typeof id === 'string' && !id.includes('-')))
        
        const nameMap = new Map()
        
        // Fetch managers
        if (managerIds.length > 0) {
          const { data: managers } = await supabaseAdmin
            .from('managers')
            .select('id, full_name')
            .in('id', managerIds)
          
          managers?.forEach(m => nameMap.set(m.id, m.full_name))
        }
        
        // Fetch cashiers
        if (cashierAccountIds.length > 0) {
          const { data: cashiers } = await supabaseAdmin
            .from('cashier_accounts')
            .select('id, full_name')
            .in('id', cashierAccountIds)
          
          cashiers?.forEach(c => nameMap.set(c.id, c.full_name))
        }
        
        // Add cashier names to sales
        recentSales.forEach(sale => {
          if (sale.cashier_id) {
            ;(sale as any).cashier_name = nameMap.get(sale.cashier_id) || 'Unknown'
          }
        })
      }
    }

    if (recentSales && recentSales.length > 0) {
      recentSales.forEach((sale: any) => {
        const totals = paymentTotals.get(sale.id)
        sale.cash_paid = totals?.cash || 0
        sale.digital_paid = totals?.digital || 0
      })
    }

    // Monthly expenses (excluding inventory purchases)
    const { data: expenses } = await supabaseAdmin
      .from('expenses')
      .select('amount, category')
      .eq('store_id', parseInt(storeId))
      .gte('expense_date', startOfMonth.slice(0, 10))
      .not('category', 'in', '("new_product","inventory_restock")')

    const monthlyExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0

    // Today's expenses (excluding inventory purchases)
    const { data: todayExpensesData } = await supabaseAdmin
      .from('expenses')
      .select('amount')
      .eq('store_id', parseInt(storeId))
      .gte('expense_date', today)
      .not('category', 'in', '("new_product","inventory_restock")')

    const todayExpenses = todayExpensesData?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0

    // Expenses by category
    const categoryTotals: { [key: string]: number } = {}
    expenses?.forEach((exp: any) => {
      const category = exp.category || 'Miscellaneous'
      categoryTotals[category] = (categoryTotals[category] || 0) + Number(exp.amount)
    })

    const expensesByCategory = Object.entries(categoryTotals)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)

    // Sales trend (last 7 days)
    const salesTrend = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = getDateStringInTimeZone(date, timeZone)

      const daySales = monthlySales?.filter((sale) => {
        const saleDate = new Date(sale.sale_date).toISOString().split('T')[0]
        return saleDate === dateStr
      })

      const revenue = daySales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0

      salesTrend.push({
        date: dateStr,
        revenue: revenue,
      })
    }

    // Top products (this month)
    const { data: saleItems } = await supabaseAdmin
      .from('sale_items')
      .select('product_name, subtotal, quantity, sale_id')

    // Get sale dates for filtering by store and month
    const saleIds = saleItems?.map(item => item.sale_id) || []
    const { data: salesDates } = await supabaseAdmin
      .from('sales')
      .select('id, sale_date, store_id')
      .in('id', saleIds)
      .eq('store_id', parseInt(storeId))
      .gte('sale_date', startOfMonth)

    const monthlySaleIdSet = new Set(salesDates?.map(s => s.id) || [])
    const monthlyItems = saleItems?.filter(item => monthlySaleIdSet.has(item.sale_id)) || []

    const productStats: { [key: string]: { revenue: number, quantity: number } } = {}
    monthlyItems.forEach((item: any) => {
      const name = item.product_name || 'Unknown'
      if (!productStats[name]) {
        productStats[name] = { revenue: 0, quantity: 0 }
      }
      productStats[name].revenue += Number(item.subtotal)
      productStats[name].quantity += Number(item.quantity)
    })

    const topProducts = Object.entries(productStats)
      .map(([name, stats]) => ({ 
        product_name: name, 
        revenue: stats.revenue,
        quantity: stats.quantity 
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Calculate COGS for monthly sales
    const { data: monthlySaleItems } = await supabaseAdmin
      .from('sale_items')
      .select('cost_price_snapshot, quantity, sales!inner(store_id, sale_date)')
      .eq('sales.store_id', parseInt(storeId))
      .gte('sales.sale_date', startOfMonth)

    const monthlyCOGS = monthlySaleItems?.reduce(
      (sum, item) => sum + (item.cost_price_snapshot || 0) * item.quantity,
      0
    ) || 0

    // Calculate correct profit: Gross Profit = Revenue - COGS, Net Profit = Gross Profit - Operating Expenses
    const grossProfit = monthlyRevenue - monthlyCOGS
    const netProfit = grossProfit - monthlyExpenses

    return NextResponse.json({
      success: true,
      data: {
        todaySales: {
          count: todaySalesCount,
          revenue: todayRevenue,
        },
        monthlySales: {
          count: monthlySalesCount,
          revenue: monthlyRevenue,
        },
        todayExpenses,
        monthlyExpenses,
        expensesByCategory,
        monthlyCOGS,
        grossProfit,
        netProfit,
        lowStockCount,
        lowStockProducts: lowStockProducts || [],
        recentSales: recentSales || [],
        topProducts,
        salesTrend,
      },
    })
  } catch (error: any) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch dashboard stats',
      },
      { status: 500 }
    )
  }
}
