import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Today's sales
    const { data: todaySales } = await supabaseAdmin
      .from('sales')
      .select('total_amount')
      .eq('store_id', parseInt(storeId))
      .gte('sale_date', startOfToday.toISOString())

    const todaySalesCount = todaySales?.length || 0
    const todayRevenue = todaySales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0

    // Monthly sales
    const { data: monthlySales } = await supabaseAdmin
      .from('sales')
      .select('total_amount, sale_date')
      .eq('store_id', parseInt(storeId))
      .gte('sale_date', startOfMonth.toISOString())

    const monthlySalesCount = monthlySales?.length || 0
    const monthlyRevenue = monthlySales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0

    // Low stock products
    const { data: allProducts } = await supabaseAdmin
      .from('products')
      .select('id, name, price, stock_quantity, low_stock_threshold, is_active')
      .eq('store_id', parseInt(storeId))
      .eq('is_active', true)

    const lowStockProducts = allProducts?.filter(p => 
      p.stock_quantity <= (p.low_stock_threshold || 10)
    ).slice(0, 5) || []
    
    const lowStockCount = allProducts?.filter(p => 
      p.stock_quantity <= (p.low_stock_threshold || 10)
    ).length || 0

    // Recent sales
    const { data: recentSales } = await supabaseAdmin
      .from('sales')
      .select('id, total_amount, sale_date, payment_method, cashier_id')
      .eq('store_id', parseInt(storeId))
      .order('sale_date', { ascending: false })
      .limit(10)

    // Monthly expenses
    const { data: expenses } = await supabaseAdmin
      .from('expenses')
      .select('amount, category')
      .eq('store_id', parseInt(storeId))
      .gte('expense_date', startOfMonth.toISOString().split('T')[0])

    const monthlyExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0

    // Today's expenses
    const { data: todayExpensesData } = await supabaseAdmin
      .from('expenses')
      .select('amount')
      .eq('store_id', parseInt(storeId))
      .gte('expense_date', startOfToday.toISOString().split('T')[0])

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
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

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

    // Get sale dates for filtering
    const saleIds = saleItems?.map(item => item.sale_id) || []
    const { data: salesDates } = await supabaseAdmin
      .from('sales')
      .select('id, sale_date')
      .in('id', saleIds)
      .gte('sale_date', startOfMonth.toISOString())

    const monthlySaleIds = new Set(salesDates?.map(s => s.id) || [])
    const monthlyItems = saleItems?.filter(item => monthlySaleIds.has(item.sale_id)) || []

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
        netProfit: monthlyRevenue - monthlyExpenses,
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
