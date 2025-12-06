import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { customer_name, customer_phone, total_amount, amount_paid, notes } = body
    const customerId = parseInt(params.id)

    if (!customer_name || !customer_phone) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer name and phone number are required',
        },
        { status: 400 }
      )
    }

    const totalAmount = parseFloat(total_amount) || 0
    const amountPaid = parseFloat(amount_paid) || 0
    const amountRemaining = totalAmount - amountPaid

    const { data, error } = await supabaseAdmin
      .from('partial_payment_customers')
      .update({
        customer_name,
        customer_phone,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        amount_remaining: amountRemaining,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update customer',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = parseInt(params.id)

    const { error } = await supabaseAdmin
      .from('partial_payment_customers')
      .delete()
      .eq('id', customerId)

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete customer',
      },
      { status: 500 }
    )
  }
}
