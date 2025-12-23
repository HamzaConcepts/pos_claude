import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')
    const month = searchParams.get('month') // Format: YYYY-MM

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    if (!month) {
      return NextResponse.json(
        { error: 'Month is required' },
        { status: 400 }
      )
    }

    // Parse month to get start and end dates
    const [year, monthNum] = month.split('-').map(Number)
    const startDate = new Date(year, monthNum - 1, 1).toISOString()
    const endDate = new Date(year, monthNum, 0, 23, 59, 59).toISOString()

    // Fetch all cashiers for the store
    const { data: cashiers, error: cashiersError } = await supabaseAdmin
      .from('cashiers')
      .select('id, full_name, commission_rate')
      .eq('store_id', parseInt(storeId))
      .eq('is_active', true)

    if (cashiersError) throw cashiersError

    // Fetch sales for the month where cashier_ref_id is set
    const { data: sales, error: salesError } = await supabaseAdmin
      .from('sales')
      .select(`
        id,
        cashier_ref_id,
        total_amount,
        sale_items (
          quantity,
          unit_price,
          cost_price_snapshot
        )
      `)
      .eq('store_id', parseInt(storeId))
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .not('cashier_ref_id', 'is', null)

    if (salesError) throw salesError

    // Calculate stats for each cashier
    const cashierStats = cashiers.map(cashier => {
      const cashierSales = sales.filter(s => s.cashier_ref_id === cashier.id)
      
      let totalSales = 0
      let totalProfit = 0

      cashierSales.forEach(sale => {
        totalSales += sale.total_amount || 0
        
        // Calculate profit for this sale
        if (sale.sale_items && Array.isArray(sale.sale_items)) {
          sale.sale_items.forEach((item: any) => {
            const revenue = item.unit_price * item.quantity
            const cost = (item.cost_price_snapshot || 0) * item.quantity
            totalProfit += revenue - cost
          })
        }
      })

      const commissionEarned = (totalProfit * cashier.commission_rate) / 100

      return {
        cashier_id: cashier.id,
        cashier_name: cashier.full_name,
        total_sales: totalSales,
        total_profit: totalProfit,
        commission_earned: commissionEarned,
        orders_completed: cashierSales.length,
      }
    })

    return NextResponse.json({
      success: true,
      data: cashierStats,
    })
  } catch (error: any) {
    console.error('Error fetching cashier stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch cashier stats',
      },
      { status: 500 }
    )
  }
}
