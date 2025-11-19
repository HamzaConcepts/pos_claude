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
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

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

    // Fetch recorder names separately if needed
    if (data && data.length > 0) {
      const recordedByIds = [...new Set(data.map(e => e.recorded_by).filter(Boolean))]
      
      if (recordedByIds.length > 0) {
        // Try to fetch from managers first
        const { data: managers } = await supabaseAdmin
          .from('managers')
          .select('id, full_name')
          .in('id', recordedByIds)
        
        // Then try cashiers for any remaining IDs
        const managerIds = new Set(managers?.map(m => m.id) || [])
        const cashierIds = recordedByIds.filter(id => !managerIds.has(id))
        
        let cashiers = []
        if (cashierIds.length > 0) {
          const { data: cashierData } = await supabaseAdmin
            .from('cashier_accounts')
            .select('id, full_name')
            .in('id', cashierIds)
          cashiers = cashierData || []
        }
        
        // Create combined name map
        const nameMap = new Map([
          ...(managers?.map(m => [m.id, m.full_name]) || []),
          ...(cashiers?.map(c => [c.id, c.full_name]) || [])
        ])
        
        // Add recorder names to expenses
        data.forEach(expense => {
          if (expense.recorded_by) {
            expense.recorded_by_name = nameMap.get(expense.recorded_by) || 'Unknown'
          }
        })
      }
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
    const { description, amount, category, expense_date, recorded_by, store_id } = body

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

    const { data, error } = await supabaseAdmin
      .from('expenses')
      .insert([
        {
          description,
          amount: parseFloat(amount),
          category,
          expense_date,
          recorded_by: recorded_by || null,
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
