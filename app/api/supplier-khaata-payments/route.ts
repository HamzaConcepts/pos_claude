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
      .select(`
        id,
        supplier_id,
        supplier_khaata_id,
        supplier_name,
        supplier_phone,
        payment_amount,
        payment_date,
        payment_method,
        notes,
        payment_reference,
        transaction_remaining_before,
        transaction_remaining_after,
        supplier_remaining_before,
        supplier_remaining_after,
        recorded_by,
        cashier_id,
        created_at,
        supplier_khaata (
          id,
          supplier_id,
          stock_batch_id,
          total_amount,
          amount_paid,
          amount_remaining,
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
        )
      `)
      .eq('store_id', parseInt(storeId))
      .order('payment_date', { ascending: false })

    if (supplierId) {
      const parsedSupplierId = Number.parseInt(supplierId, 10)
      if (Number.isNaN(parsedSupplierId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid supplier_id value' },
          { status: 400 }
        )
      }
      query = query.eq('supplier_id', parsedSupplierId)
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
      store_id,
      recorded_by,
      cashier_id,
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

    const parsedStoreId = parseInt(String(store_id), 10)
    const parsedSupplierId = parseInt(String(supplier_id), 10)
    const parsedPaymentAmount = parseFloat(String(payment_amount))
    const parsedCashierId = cashier_id ? parseInt(String(cashier_id), 10) : null
    const normalizedPaymentMethod = payment_method === 'Cash' ? 'Cash' : payment_method === 'Digital' ? 'Digital' : null
    const hasManagerRecorder = typeof recorded_by === 'string' && recorded_by.trim().length > 0
    const hasCashierRecorder = Number.isInteger(parsedCashierId)

    if (Number.isNaN(parsedStoreId) || Number.isNaN(parsedSupplierId) || !Number.isFinite(parsedPaymentAmount)) {
      return NextResponse.json(
        { success: false, error: 'Invalid supplier/store/payment values' },
        { status: 400 }
      )
    }

    if (hasManagerRecorder === hasCashierRecorder) {
      return NextResponse.json(
        { success: false, error: 'Exactly one recorder is required: recorded_by (manager UUID) or cashier_id' },
        { status: 400 }
      )
    }

    if (!normalizedPaymentMethod) {
      return NextResponse.json(
        { success: false, error: 'Payment method must be Cash or Digital' },
        { status: 400 }
      )
    }

    // Fetch all transactions for this supplier
    const { data: transactions, error: transactionsError } = await supabaseAdmin
      .from('supplier_khaata')
      .select('*')
      .eq('supplier_id', parsedSupplierId)
      .eq('store_id', parsedStoreId)
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
    if (parsedPaymentAmount > totalRemaining) {
      return NextResponse.json(
        { success: false, error: `Payment amount (${parsedPaymentAmount}) exceeds total remaining balance (${totalRemaining})` },
        { status: 400 }
      )
    }

    // Distribute payment across transactions in FIFO order and track before/after balances.
    let remainingPayment = parsedPaymentAmount
    let supplierRemainingBefore = totalRemaining
    const paymentReference = `SUP-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const updates = []

    for (const transaction of transactions) {
      if (remainingPayment <= 0) break

      const amountToApply = Math.min(remainingPayment, transaction.amount_remaining)
      const newAmountPaid = transaction.amount_paid + amountToApply
      const newAmountRemaining = transaction.amount_remaining - amountToApply
      const supplierRemainingBeforeForLine = supplierRemainingBefore
      const supplierRemainingAfter = Math.max(0, supplierRemainingBeforeForLine - amountToApply)

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
      const { error: paymentInsertError } = await supabaseAdmin
        .from('supplier_khaata_payments')
        .insert({
          supplier_id: parsedSupplierId,
          supplier_khaata_id: transaction.id,
          supplier_name: transaction.supplier_name,
          supplier_phone: transaction.supplier_phone,
          payment_amount: amountToApply,
          payment_method: normalizedPaymentMethod,
          notes,
          payment_reference: paymentReference,
          transaction_remaining_before: transaction.amount_remaining,
          transaction_remaining_after: newAmountRemaining,
          supplier_remaining_before: supplierRemainingBeforeForLine,
          supplier_remaining_after: supplierRemainingAfter,
          store_id: parsedStoreId,
          recorded_by: hasManagerRecorder ? recorded_by : null,
          cashier_id: hasCashierRecorder ? parsedCashierId : null,
        })

      if (paymentInsertError) {
        console.error('Error recording supplier payment allocation:', paymentInsertError)
        return NextResponse.json(
          { success: false, error: paymentInsertError.message },
          { status: 500 }
        )
      }

      remainingPayment -= amountToApply
      supplierRemainingBefore = supplierRemainingAfter
      updates.push({
        transaction_id: transaction.id,
        amount_applied: amountToApply,
        transaction_remaining_before: transaction.amount_remaining,
        transaction_remaining_after: newAmountRemaining,
        supplier_remaining_before: supplierRemainingBeforeForLine,
        supplier_remaining_after: supplierRemainingAfter,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        total_payment: parsedPaymentAmount,
        payment_reference: paymentReference,
        transactions_updated: updates.length,
        supplier_remaining_after: supplierRemainingBefore,
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
