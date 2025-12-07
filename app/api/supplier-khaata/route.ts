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
      persistSession: false
    }
  }
)

// GET - Fetch all supplier khaata records for a store
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')
    const supplierId = searchParams.get('supplier_id')

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('supplier_khaata')
      .select(`
        *,
        suppliers (
          id,
          supplier_name,
          phone_number,
          email,
          address
        ),
        stock_batches (
          id,
          batch_number,
          purchase_date,
          products (
            id,
            name,
            sku
          )
        )
      `)
      .eq('store_id', parseInt(storeId))
      .order('created_at', { ascending: false })

    // Filter by supplier if specified
    if (supplierId) {
      query = query.eq('supplier_id', parseInt(supplierId))
    }

    const { data: records, error } = await query

    if (error) {
      console.error('Error fetching supplier khaata records:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: records || []
    })
  } catch (error: any) {
    console.error('GET /api/supplier-khaata error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Create a new supplier khaata record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      stock_batch_id,
      supplier_id,
      supplier_name,
      supplier_phone,
      supplier_contact,
      total_amount,
      amount_paid,
      store_id,
      notes
    } = body

    // Validation
    if (!stock_batch_id || !supplier_id || !total_amount || !store_id) {
      return NextResponse.json(
        { success: false, error: 'Stock batch ID, supplier ID, total amount, and store ID are required' },
        { status: 400 }
      )
    }

    const amountPaid = parseFloat(amount_paid?.toString() || '0')
    const totalAmt = parseFloat(total_amount.toString())
    const amountRemaining = totalAmt - amountPaid

    if (amountRemaining < 0) {
      return NextResponse.json(
        { success: false, error: 'Amount paid cannot exceed total amount' },
        { status: 400 }
      )
    }

    const { data: record, error } = await supabaseAdmin
      .from('supplier_khaata')
      .insert({
        stock_batch_id,
        supplier_id,
        supplier_name,
        supplier_phone,
        supplier_contact,
        total_amount: totalAmt,
        amount_paid: amountPaid,
        amount_remaining: amountRemaining,
        store_id,
        notes
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating supplier khaata record:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: record,
      message: 'Supplier khaata record created successfully'
    }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/supplier-khaata error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PATCH - Update supplier khaata record (e.g., add payment)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, amount_paid, notes } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Khaata record ID is required' },
        { status: 400 }
      )
    }

    // Fetch current record
    const { data: currentRecord, error: fetchError } = await supabaseAdmin
      .from('supplier_khaata')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !currentRecord) {
      return NextResponse.json(
        { success: false, error: 'Khaata record not found' },
        { status: 404 }
      )
    }

    // Calculate new amounts
    const newAmountPaid = amount_paid !== undefined 
      ? parseFloat(amount_paid.toString())
      : currentRecord.amount_paid
    
    const newAmountRemaining = currentRecord.total_amount - newAmountPaid

    if (newAmountRemaining < 0) {
      return NextResponse.json(
        { success: false, error: 'Amount paid cannot exceed total amount' },
        { status: 400 }
      )
    }

    const updateData: any = {
      amount_paid: newAmountPaid,
      amount_remaining: newAmountRemaining
    }

    if (notes !== undefined) {
      updateData.notes = notes
    }

    const { data: record, error } = await supabaseAdmin
      .from('supplier_khaata')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating supplier khaata record:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: record,
      message: 'Supplier khaata record updated successfully'
    })
  } catch (error: any) {
    console.error('PATCH /api/supplier-khaata error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Delete a supplier khaata record
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Khaata record ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('supplier_khaata')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      console.error('Error deleting supplier khaata record:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Supplier khaata record deleted successfully'
    })
  } catch (error: any) {
    console.error('DELETE /api/supplier-khaata error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
