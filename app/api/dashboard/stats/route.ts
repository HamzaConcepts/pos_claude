import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Today's sales
    const { data: todaySales, error: todayError } = await supabase
      .from('sales')
      .select('total_amount')
      .gte('sale_date', startOfToday.toISOString())

    if (todayError) throw todayError

    const todaySalesCount = todaySales?.length || 0
    const todayRevenue = todaySales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0

    // Monthly sales
    const { data: monthlySales, error: monthlyError } = await supabase
      .from('sales')
      .select('total_amount, sale_date')
      .gte('sale_date', startOfMonth.toISOString())

    if (monthlyError) throw monthlyError

    const monthlySalesCount = monthlySales?.length || 0
    const monthlyRevenue = monthlySales?.reduce((sum, sale) => sum + Number(sale.total_amount), 0) || 0

    // Low stock products
    const { data: allProducts, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, stock_quantity, low_stock_threshold')

    if (productsError) throw productsError

    const products = allProducts?.filter(p => p.stock_quantity <= p.low_stock_threshold).slice(0, 5) || []
    const lowStockCount = allProducts?.filter(p => p.stock_quantity <= p.low_stock_threshold).length || 0

    // Recent sales
    const { data: recentSales, error: recentError } = await supabase
      .from('sales')
      .select(`
        *,
        users:cashier_id (full_name)
      `)
      .order('sale_date', { ascending: false })
      .limit(10)

    if (recentError) throw recentError

    // Monthly expenses
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('amount')
      .gte('expense_date', startOfMonth.toISOString().split('T')[0])

    if (expensesError) throw expensesError

    const monthlyExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0

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
    const { data: saleItems, error: itemsError } = await supabase
      .from('sale_items')
      .select(`
        product_id,
        subtotal,
        products (name)
      `)
      .gte('created_at', startOfMonth.toISOString())

    if (itemsError) throw itemsError

    const productRevenue: { [key: string]: number } = {}
    saleItems?.forEach((item: any) => {
      const name = item.products?.name || 'Unknown'
      productRevenue[name] = (productRevenue[name] || 0) + Number(item.subtotal)
    })

    const topProducts = Object.entries(productRevenue)
      .map(([name, revenue]) => ({ product_name: name, revenue }))
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
        monthlyExpenses,
        netProfit: monthlyRevenue - monthlyExpenses,
        lowStockCount,
        lowStockProducts: products || [],
        recentSales: recentSales || [],
        topProducts,
        salesTrend,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch dashboard stats',
        code: 'FETCH_STATS_ERROR',
      },
      { status: 500 }
    )
  }
}
