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
      payments,
      bank_account_name,
      notes,
      recorded_by_manager_id,
      recorded_by_cashier_id
    } = body

    if (!supplier_id || !store_id || (!amount && !payments)) {
      return NextResponse.json(
        { success: false, error: 'Supplier ID, Store ID, and amount are required' },
        { status: 400 }
      )
    }

    const paymentEntries = Array.isArray(payments) ? payments : null
    const normalizedPayments: Array<{ payment_method: 'Cash' | 'Digital'; amount: number; bank_account_name?: string | null }> = []

    if (paymentEntries && paymentEntries.length > 0) {
      for (const entry of paymentEntries) {
        const method = entry?.payment_method === 'Cash' ? 'Cash' : entry?.payment_method === 'Digital' ? 'Digital' : null
        const parsedAmount = Number(entry?.amount)
        const bankName = typeof entry?.bank_account_name === 'string' ? entry.bank_account_name.trim() : ''

        if (!method) {
          return NextResponse.json(
            { success: false, error: 'Payment method must be Cash or Digital' },
            { status: 400 }
          )
        }

        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
          return NextResponse.json(
            { success: false, error: 'Amount must be greater than 0' },
            { status: 400 }
          )
        }

        if (method === 'Digital' && !bankName) {
          return NextResponse.json(
            { success: false, error: 'Bank account is required for Digital payments' },
            { status: 400 }
          )
        }

        normalizedPayments.push({
          payment_method: method,
          amount: parsedAmount,
          bank_account_name: method === 'Digital' ? bankName : null,
        })
      }
    } else {
      const parsedAmount = Number(amount)
      const normalizedMethod = payment_method === 'Cash' ? 'Cash' : payment_method === 'Digital' ? 'Digital' : null
      const bankName = typeof bank_account_name === 'string' ? bank_account_name.trim() : ''

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Amount must be greater than 0' },
          { status: 400 }
        )
      }

      if (!normalizedMethod) {
        return NextResponse.json(
          { success: false, error: 'Payment method must be Cash or Digital' },
          { status: 400 }
        )
      }

      if (normalizedMethod === 'Digital' && !bankName) {
        return NextResponse.json(
          { success: false, error: 'Bank account is required for Digital payments' },
          { status: 400 }
        )
      }

      normalizedPayments.push({
        payment_method: normalizedMethod,
        amount: parsedAmount,
        bank_account_name: normalizedMethod === 'Digital' ? bankName : null,
      })
    }

    const totalPayment = normalizedPayments.reduce((sum, entry) => sum + entry.amount, 0)

    // Record the payment
    const { data: paymentRows, error: paymentError } = await supabaseAdmin
      .from('supplier_payments')
      .insert(
        normalizedPayments.map((entry) => ({
          supplier_id,
          store_id,
          amount: entry.amount,
          payment_method: entry.payment_method,
          bank_account_name: entry.bank_account_name || null,
          notes: notes?.trim() || null,
          recorded_by_manager_id,
          recorded_by_cashier_id
        }))
      )
      .select()

    if (paymentError) throw paymentError

    // Update supplier balance
    const { data: supplier, error: supplierFetchError } = await supabaseAdmin
      .from('suppliers')
      .select('balance_owed, total_paid')
      .eq('id', supplier_id)
      .single()

    if (supplierFetchError) throw supplierFetchError

    const newBalance = (supplier.balance_owed || 0) - totalPayment
    const newTotalPaid = (supplier.total_paid || 0) + totalPayment

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
      data: paymentRows,
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
