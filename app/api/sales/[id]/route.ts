import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { data: sale, error } = await supabase
      .from('sales')
      .select(`
        *,
        users:cashier_id (full_name, username),
        sale_items (
          *,
          products (name, sku)
        )
      `)
      .eq('id', (await params).id)
      .single()

    if (error) throw error

    if (!sale) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sale not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: sale,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch sale',
        code: 'FETCH_SALE_ERROR',
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const { payment_method, payment_status, notes } = body

    // Validation
    if (!(await params).id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sale ID is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // Build update object with only allowed fields
    const updateData: any = {}
    
    if (payment_method !== undefined) {
      if (!['Cash', 'Digital'].includes(payment_method)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid payment method. Must be Cash or Digital.',
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }
      updateData.payment_method = payment_method
    }

    if (payment_status !== undefined) {
      if (!['Paid', 'Partial', 'Pending'].includes(payment_status)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid payment status. Must be Paid, Partial, or Pending.',
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }
      updateData.payment_status = payment_status
    }

    if (notes !== undefined) {
      updateData.notes = notes
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid fields to update',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('sales')
      .update(updateData)
      .eq('id', (await params).id)
      .select()
      .single()

    if (error) {
      console.error('Error updating sale:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('Update sale error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update sale',
        code: 'UPDATE_SALE_ERROR',
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete a sale (Manager only) - triggers will handle stock reversion
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const managerId = searchParams.get('manager_id')
    const storeId = searchParams.get('store_id')

    // Validation - only managers can delete sales
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

    const storeIdNumber = parseInt(storeId)
    if (isNaN(storeIdNumber)) {
      return NextResponse.json(
        { success: false, error: 'Invalid store ID' },
        { status: 400 }
      )
    }

    const saleId = parseInt((await params).id)
    if (isNaN(saleId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid sale ID' },
        { status: 400 }
      )
    }

    // Verify manager belongs to the store
    const { data: manager, error: managerError } = await supabaseAdmin
      .from('managers')
      .select('id, store_id')
      .eq('id', managerId)
      .eq('store_id', storeIdNumber)
      .maybeSingle()

    if (managerError || !manager) {
      if (managerError) {
        console.error('Manager validation failed:', managerError)
      }
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Manager not found or does not belong to this store' },
        { status: 403 }
      )
    }

    // Fetch the sale to verify it exists and belongs to the store
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('id, sale_number')
      .eq('id', saleId)
      .eq('store_id', storeIdNumber)
      .single()

    if (saleError || !sale) {
      return NextResponse.json(
        { success: false, error: 'Sale not found' },
        { status: 404 }
      )
    }

    // Delete dependent rows first for constraints that do not cascade in schema-current.
    const { error: paymentsDeleteError } = await supabaseAdmin
      .from('payments')
      .delete()
      .eq('sale_id', saleId)

    if (paymentsDeleteError) {
      console.error('Error deleting payment records before sale delete:', paymentsDeleteError)
      return NextResponse.json(
        { success: false, error: paymentsDeleteError.message },
        { status: 500 }
      )
    }

    const { error: partialPaymentsDeleteError } = await supabaseAdmin
      .from('partial_payment_customers')
      .delete()
      .eq('sale_id', saleId)

    if (partialPaymentsDeleteError) {
      console.error('Error deleting partial payment customers before sale delete:', partialPaymentsDeleteError)
      return NextResponse.json(
        { success: false, error: partialPaymentsDeleteError.message },
        { status: 500 }
      )
    }

    // Delete the sale - the trigger will automatically handle:
    // 1. Stock reversion (restoring quantities to batches)
    // 2. IMEI status updates
    // 3. Cascade deletion of sale_items
    const { error: deleteError } = await supabaseAdmin
      .from('sales')
      .delete()
      .eq('id', saleId)

    if (deleteError) {
      console.error('Error deleting sale:', deleteError)

      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Sale deleted successfully. Stock has been restored.',
      data: { id: saleId, sale_number: sale.sale_number }
    })
  } catch (error: any) {
    console.error('Exception in DELETE /api/sales/[id]:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PATCH - Mark a sale for review (Cashier feature)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const { action, cashier_id, review_reason } = body

    if (action === 'mark_for_review') {
      if (!cashier_id || !review_reason) {
        return NextResponse.json(
          { success: false, error: 'Cashier ID and review reason are required' },
          { status: 400 }
        )
      }

      const saleId = parseInt((await params).id)
      if (isNaN(saleId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid sale ID' },
          { status: 400 }
        )
      }

      // Update the sale to mark it for review
      const { data, error } = await supabaseAdmin
        .from('sales')
        .update({
          marked_for_review: true,
          review_reason: review_reason.trim(),
          marked_by_cashier_id: parseInt(cashier_id),
          marked_at: new Date().toISOString()
        })
        .eq('id', saleId)
        .select()
        .single()

      if (error) {
        console.error('Error marking sale for review:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Sale marked for review successfully',
        data
      })
    } else if (action === 'unmark_review') {
      // Manager can unmark a sale after reviewing it
      const saleId = parseInt((await params).id)
      if (isNaN(saleId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid sale ID' },
          { status: 400 }
        )
      }

      const { data, error } = await supabaseAdmin
        .from('sales')
        .update({
          marked_for_review: false,
          review_reason: null,
          marked_by_cashier_id: null,
          marked_at: null
        })
        .eq('id', saleId)
        .select()
        .single()

      if (error) {
        console.error('Error unmarking sale:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Sale unmarked successfully',
        data
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Exception in PATCH /api/sales/[id]:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
