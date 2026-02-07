import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPKTNow } from '@/lib/date-utils'

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

// GET - Fetch supplier payments
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
      .from('supplier_payments')
      .select('*')
      .eq('store_id', storeId)
      .order('payment_date', { ascending: false })

    if (supplierId) {
      query = query.eq('supplier_id', parseInt(supplierId))
    }

    const { data: payments, error } = await query

    if (error) throw error

    return NextResponse.json({ success: true, data: payments || [] })
  } catch (error: any) {
    console.error('Error fetching supplier payments:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Record payment to supplier
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      supplier_id, 
      store_id, 
      amount, 
      payment_method, 
      notes,
      recorded_by_manager_id,
      recorded_by_cashier_id
    } = body

    if (!supplier_id || !store_id || !amount) {
      return NextResponse.json(
        { success: false, error: 'Supplier ID, Store ID, and amount are required' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Record the payment
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('supplier_payments')
      .insert({
        supplier_id,
        store_id,
        amount: parseFloat(amount),
        payment_method: payment_method || 'Cash',
        notes: notes?.trim() || null,
        recorded_by_manager_id,
        recorded_by_cashier_id
      })
      .select()
      .single()

    if (paymentError) throw paymentError

    // Update supplier balance
    const { data: supplier, error: supplierFetchError } = await supabaseAdmin
      .from('suppliers')
      .select('balance_owed, total_paid')
      .eq('id', supplier_id)
      .single()

    if (supplierFetchError) throw supplierFetchError

    const newBalance = (supplier.balance_owed || 0) - parseFloat(amount)
    const newTotalPaid = (supplier.total_paid || 0) + parseFloat(amount)

    const { error: updateError } = await supabaseAdmin
      .from('suppliers')
      .update({
        balance_owed: newBalance < 0 ? 0 : newBalance,
        total_paid: newTotalPaid,
        last_payment_date: getPKTNow() // Use PKT timezone
      })
      .eq('id', supplier_id)

    if (updateError) throw updateError

    return NextResponse.json({ 
      success: true, 
      data: payment,
      message: 'Payment recorded successfully' 
    })
  } catch (error: any) {
    console.error('Error recording supplier payment:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
