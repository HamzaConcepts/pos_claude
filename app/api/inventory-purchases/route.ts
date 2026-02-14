import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Fetch ONLY inventory-related expenses (new_product and inventory_restock)
    const { data, error } = await supabaseAdmin
      .from('expenses')
      .select('*')
      .eq('store_id', parseInt(storeId))
      .in('category', ['new_product', 'inventory_restock'])
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching inventory purchases:', error)
      throw error
    }

    // Fetch recorder names separately
    if (data && data.length > 0) {
      const managerIds = [...new Set(data.map(e => e.recorded_by).filter(Boolean))]
      const cashierAccountIds = [...new Set(data.map(e => e.recorded_by_cashier_id).filter(Boolean))]
      const cashierRefIds = [...new Set(data.map(e => e.cashier_ref_id).filter(Boolean))]
      
      const nameMap = new Map()
      
      // Fetch managers
      if (managerIds.length > 0) {
        const { data: managers } = await supabaseAdmin
          .from('managers')
          .select('id, full_name')
          .in('id', managerIds)
        
        managers?.forEach(m => nameMap.set(`manager_${m.id}`, m.full_name))
      }
      
      // Fetch cashier accounts
      if (cashierAccountIds.length > 0) {
        const { data: cashierAccounts } = await supabaseAdmin
          .from('cashier_accounts')
          .select('id, full_name')
          .in('id', cashierAccountIds)
        
        cashierAccounts?.forEach(c => nameMap.set(`cashier_account_${c.id}`, c.full_name))
      }
      
      // Fetch cashiers (staff members from cashiers table)
      if (cashierRefIds.length > 0) {
        const { data: cashiers } = await supabaseAdmin
          .from('cashiers')
          .select('id, full_name')
          .in('id', cashierRefIds)
        
        cashiers?.forEach(c => nameMap.set(`cashier_${c.id}`, c.full_name))
      }
      
      // Add recorder names to expenses
      data.forEach(expense => {
        if (expense.cashier_ref_id) {
          expense.recorded_by_name = nameMap.get(`cashier_${expense.cashier_ref_id}`) || 'Unknown'
        } else if (expense.recorded_by) {
          expense.recorded_by_name = nameMap.get(`manager_${expense.recorded_by}`) || 'Unknown'
        } else if (expense.recorded_by_cashier_id) {
          expense.recorded_by_name = nameMap.get(`cashier_account_${expense.recorded_by_cashier_id}`) || 'Unknown'
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    })
  } catch (error: any) {
    console.error('Inventory purchases API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inventory purchases' },
      { status: 500 }
    )
  }
}
