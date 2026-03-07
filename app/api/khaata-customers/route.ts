import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

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
    const search = searchParams.get('search')
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Store ID is required',
        },
        { status: 400 }
      )
    }

    // Use explicit foreign key hint to avoid ambiguity
    let query = supabaseAdmin
      .from('partial_payment_customers')
      .select(`
        *,
        sales!partial_payment_customers_sale_id_fkey (
          sale_description
        )
      `)
      .eq('store_id', parseInt(storeId))
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[KHAATA API] Supabase error:', error)
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: data || [],
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error: any) {
    console.error('[KHAATA API] Exception:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch customers',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { customer_name, customer_phone, total_amount, amount_paid, notes, sale_id, store_id } = body

    if (!customer_name || !customer_phone) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer name and phone number are required',
        },
        { status: 400 }
      )
    }

    // sale_id and store_id are required by the partial_payment_customers table
    if (!sale_id || !store_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sale ID and Store ID are required',
        },
        { status: 400 }
      )
    }

    const totalAmount = parseFloat(total_amount) || 0
    const amountPaid = parseFloat(amount_paid) || 0
    const amountRemaining = totalAmount - amountPaid

    const { data, error } = await supabaseAdmin
      .from('partial_payment_customers')
      .insert([
        {
          sale_id: parseInt(sale_id),
          store_id: parseInt(store_id),
          customer_name,
          customer_phone,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          amount_remaining: amountRemaining,
          notes,
        },
      ])
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
        error: error.message || 'Failed to create customer',
      },
      { status: 500 }
    )
  }
}
