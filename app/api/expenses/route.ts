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

    // Fetch expenses - no relationships needed
    const { data, error } = await supabaseAdmin
      .from('expenses')
      .select('*')
      .eq('store_id', parseInt(storeId))
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching expenses:', error)
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
      
      // Add recorder names to expenses - prioritize cashier_ref_id, then recorded_by, then recorded_by_cashier_id
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
    console.error('Expenses API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch expenses',
        code: 'FETCH_EXPENSES_ERROR',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      description, 
      amount, 
      category, 
      expense_date, 
      recorded_by, 
      recorded_by_cashier_id,
      store_id, 
      payment_method 
    } = body

    // Validation
    if (!description || !amount || !category || !expense_date || !store_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Amount must be greater than 0',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // Determine if recorded_by is a manager (UUID) or cashier account (integer)
    let managerUuid = null
    let cashierAccountId = null
    
    if (recorded_by) {
      // Check if it's a UUID (contains hyphens) or an integer
      if (typeof recorded_by === 'string' && recorded_by.includes('-')) {
        managerUuid = recorded_by
      } else {
        cashierAccountId = parseInt(recorded_by)
      }
    }

    // recorded_by_cashier_id from frontend is actually the cashier (staff) id from cashiers table
    // This is the staff member selected from the CashierSelector dropdown
    const cashierRefId = recorded_by_cashier_id ? parseInt(recorded_by_cashier_id) : null

    const { data, error } = await supabaseAdmin
      .from('expenses')
      .insert([
        {
          description,
          amount: parseFloat(amount),
          category,
          payment_method: payment_method || 'Cash',
          expense_date,
          recorded_by: managerUuid,
          recorded_by_cashier_id: cashierAccountId,
          cashier_ref_id: cashierRefId,
          store_id: parseInt(store_id),
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Error adding expense:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('Add expense error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to add expense',
        code: 'ADD_EXPENSE_ERROR',
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, description, amount, category, expense_date, payment_method } = body

    // Validation
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Expense ID is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (!description || !amount || !category || !expense_date) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Amount must be greater than 0',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('expenses')
      .update({
        description,
        amount: parseFloat(amount),
        category,
        payment_method: payment_method || 'Cash',
        expense_date,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating expense:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('Update expense error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update expense',
        code: 'UPDATE_EXPENSE_ERROR',
      },
      { status: 500 }
    )
  }
}
