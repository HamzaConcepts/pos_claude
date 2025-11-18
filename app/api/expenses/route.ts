import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        managers (
          full_name
        )
      `)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || [],
    })
  } catch (error: any) {
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
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const body = await request.json()
    const { description, amount, category, expense_date, recorded_by } = body

    // Validation
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

    const { data, error } = await supabase
      .from('expenses')
      .insert([
        {
          description,
          amount: parseFloat(amount),
          category,
          expense_date,
          recorded_by: recorded_by || null,
        },
      ])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
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
