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

// GET - Fetch payment history for a supplier
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplier_id')
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('supplier_khaata_payments')
      .select('*')
      .eq('store_id', parseInt(storeId))
      .order('payment_date', { ascending: false })

    if (supplierId) {
      query = query.eq('supplier_khaata_id', parseInt(supplierId))
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching supplier khaata payments:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Exception in GET /api/supplier-khaata-payments:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Record a new payment for supplier dues
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      supplier_id,
      payment_amount,
      payment_method = 'Cash',
      notes,
      store_id
    } = body

    // Validation
    if (!supplier_id || !payment_amount || !store_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: supplier_id, payment_amount, and store_id are required' },
        { status: 400 }
      )
    }

    if (payment_amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Payment amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Fetch all transactions for this supplier
    const { data: transactions, error: transactionsError } = await supabaseAdmin
      .from('supplier_khaata')
      .select('*')
      .eq('supplier_id', parseInt(supplier_id))
      .eq('store_id', parseInt(store_id))
      .gt('amount_remaining', 0)
      .order('created_at', { ascending: true })

    if (transactionsError || !transactions || transactions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No outstanding transactions found for this supplier' },
        { status: 404 }
      )
    }

    // Calculate total remaining balance
    const totalRemaining = transactions.reduce((sum, t) => sum + t.amount_remaining, 0)

    // Check if payment exceeds remaining amount
    if (payment_amount > totalRemaining) {
      return NextResponse.json(
        { success: false, error: `Payment amount (${payment_amount}) exceeds total remaining balance (${totalRemaining})` },
        { status: 400 }
      )
    }

    // Distribute payment across transactions proportionally
    let remainingPayment = parseFloat(payment_amount)
    const updates = []

    for (const transaction of transactions) {
      if (remainingPayment <= 0) break

      const amountToApply = Math.min(remainingPayment, transaction.amount_remaining)
      const newAmountPaid = transaction.amount_paid + amountToApply
      const newAmountRemaining = transaction.amount_remaining - amountToApply

      // Update this transaction
      const { error: updateError } = await supabaseAdmin
        .from('supplier_khaata')
        .update({
          amount_paid: newAmountPaid,
          amount_remaining: newAmountRemaining,
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id)

      if (updateError) {
        console.error('Error updating transaction:', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to update supplier balance' },
          { status: 500 }
        )
      }

      // Record payment
      await supabaseAdmin
        .from('supplier_khaata_payments')
        .insert({
          supplier_khaata_id: transaction.id,
          supplier_name: transaction.supplier_name,
          supplier_phone: transaction.supplier_phone,
          payment_amount: amountToApply,
          payment_method,
          notes,
          store_id: parseInt(store_id)
        })

      remainingPayment -= amountToApply
      updates.push({
        transaction_id: transaction.id,
        amount_applied: amountToApply
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        total_payment: payment_amount,
        transactions_updated: updates.length,
        updates
      },
      message: 'Payment recorded successfully'
    })
  } catch (error: any) {
    console.error('Exception in POST /api/supplier-khaata-payments:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
