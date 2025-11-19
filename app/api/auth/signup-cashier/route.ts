// API endpoint to signup cashier (uses admin client to bypass RLS)
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function POST(request: Request) {
  try {
    const { fullName, phoneNumber, password, storeCode } = await request.json()

    // Validate inputs
    if (!fullName || !phoneNumber || !password || !storeCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if phone already exists
    const { data: existingCashier } = await supabaseAdmin
      .from('cashier_accounts')
      .select('phone_number')
      .eq('phone_number', phoneNumber)
      .maybeSingle()

    if (existingCashier) {
      return NextResponse.json(
        { error: 'Phone number already exists' },
        { status: 400 }
      )
    }

    // Verify store exists
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('id, store_name')
      .eq('store_code', storeCode.toUpperCase())
      .maybeSingle()

    if (storeError || !store) {
      return NextResponse.json(
        { error: 'Invalid store code' },
        { status: 404 }
      )
    }

    // Create cashier account WITHOUT store_id (will be set after approval)
    const { data: cashier, error: cashierError } = await supabaseAdmin
      .from('cashier_accounts')
      .insert([
        {
          full_name: fullName,
          phone_number: phoneNumber,
          password_hash: password, // Will be hashed by database trigger
          role: 'Cashier',
          store_id: null, // Not assigned yet
        },
      ])
      .select()
      .single()

    if (cashierError || !cashier) {
      console.error('Error creating cashier:', cashierError)
      return NextResponse.json(
        { error: 'Failed to create cashier account' },
        { status: 500 }
      )
    }

    // Create join request
    const { error: requestError } = await supabaseAdmin
      .from('join_requests')
      .insert([
        {
          store_id: store.id,
          user_id: cashier.id.toString(),
          user_type: 'Cashier',
          user_name: fullName,
          user_phone: phoneNumber,
          user_email: null,
          status: 'pending',
        },
      ])

    if (requestError) {
      // Cleanup cashier
      await supabaseAdmin.from('cashier_accounts').delete().eq('id', cashier.id)
      console.error('Error creating join request:', requestError)
      return NextResponse.json(
        { error: 'Failed to create join request' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Cashier account created and join request submitted',
    })
  } catch (error: any) {
    console.error('Error in signup-cashier API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
