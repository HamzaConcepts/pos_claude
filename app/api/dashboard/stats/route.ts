import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

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

    // Low stock products - get products with low inventory
    const { data: allProducts, error: productsError } = await supabase
      .from('products')
      .select(`
        *,
        inventory (
          id,
          quantity_remaining,
          low_stock_threshold
        )
      `)
      .eq('is_active', true)

    if (productsError) throw productsError

    const productsWithStock = allProducts?.map((product: any) => {
      const totalStock = product.inventory?.reduce(
        (sum: number, inv: any) => sum + (inv.quantity_remaining || 0),
        0
      ) || 0
      const threshold = product.inventory?.[0]?.low_stock_threshold || 10
      
      return {
        ...product,
        stock_quantity: totalStock,
        low_stock_threshold: threshold
      }
    }) || []

    const lowStockProducts = productsWithStock
      .filter(p => p.stock_quantity <= p.low_stock_threshold)
      .slice(0, 5)
    const lowStockCount = productsWithStock.filter(p => p.stock_quantity <= p.low_stock_threshold).length

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
      .select('amount, category')
      .gte('expense_date', startOfMonth.toISOString().split('T')[0])

    if (expensesError) throw expensesError

    const monthlyExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0

    // Today's expenses
    const { data: todayExpensesData } = await supabase
      .from('expenses')
      .select('amount')
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

    // Top products (this month) - use sale_items with snapshots
    const { data: saleItems, error: itemsError } = await supabase
      .from('sale_items')
      .select(`
        product_id,
        product_name,
        subtotal,
        sale_id,
        sales!inner (sale_date)
      `)

    if (itemsError) throw itemsError

    // Filter items from this month
    const monthlyItems = saleItems?.filter((item: any) => {
      const saleDate = new Date(item.sales.sale_date)
      return saleDate >= startOfMonth
    }) || []

    const productRevenue: { [key: string]: number } = {}
    monthlyItems.forEach((item: any) => {
      const name = item.product_name || 'Unknown'
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
