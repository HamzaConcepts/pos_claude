import { NextRequest, NextResponse } from 'next/server'
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

// DELETE - Delete an expense (Manager only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const managerId = searchParams.get('manager_id')
    const storeId = searchParams.get('store_id')

    // Validation - only managers can delete expenses
    if (!managerId) {
      return NextResponse.json(
        { success: false, error: 'Manager authentication required' },
        { status: 403 }
      )
    }

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    const { id } = await params
    const expenseId = parseInt(id, 10)
    if (isNaN(expenseId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid expense ID' },
        { status: 400 }
      )
    }

    // Verify manager belongs to the store
    const { data: manager, error: managerError } = await supabaseAdmin
      .from('managers')
      .select('id, store_id')
      .eq('id', managerId)
      .eq('store_id', parseInt(storeId))
      .single()

    if (managerError || !manager) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Manager not found or does not belong to this store' },
        { status: 403 }
      )
    }

    // Fetch the expense to verify it exists and belongs to the store
    const { data: expense, error: expenseError } = await supabaseAdmin
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .eq('store_id', parseInt(storeId))
      .single()

    if (expenseError || !expense) {
      return NextResponse.json(
        { success: false, error: 'Expense not found' },
        { status: 404 }
      )
    }

    // Delete the expense
    const { error: deleteError } = await supabaseAdmin
      .from('expenses')
      .delete()
      .eq('id', expenseId)

    if (deleteError) {
      console.error('Error deleting expense:', deleteError)
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Expense deleted successfully',
      data: { id: expenseId, description: expense.description, amount: expense.amount }
    })
  } catch (error: any) {
    console.error('Exception in DELETE /api/expenses/[id]:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PATCH /api/expenses/[id] - Mark for review (cashier)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const expenseId = id
    const body = await request.json()
    const { marked_for_review, review_note } = body

    // Get the store_id from localStorage (passed via request)
    const storeId = request.headers.get('x-store-id')
    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID not found' },
        { status: 401 }
      )
    }

    // Get cashier name from localStorage (passed via request)
    const cashierName = request.headers.get('x-cashier-name') || 'Unknown'

    // Update the expense
    const { data: expense, error } = await supabaseAdmin
      .from('expenses')
      .update({
        marked_for_review,
        review_note,
        marked_at: marked_for_review ? new Date().toISOString() : null,
        marked_by: marked_for_review ? cashierName : null
      })
      .eq('id', expenseId)
      .eq('store_id', storeId)
      .select()
      .single()

    if (error) {
      console.error('Supabase error marking expense for review:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    if (!expense) {
      return NextResponse.json(
        { success: false, error: 'Expense not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Expense marked for review successfully',
      data: expense
    })
  } catch (error: any) {
    console.error('Exception in PATCH /api/expenses/[id]:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
