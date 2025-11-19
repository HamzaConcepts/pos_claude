// API endpoint to submit join request
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
    const { storeCode, userId, userType, userName, userPhone, userEmail, managerId } = await request.json()

    // Validate inputs
    if (!storeCode || !userId || !userType || !userName || !userPhone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify store exists
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('store_code', storeCode.toUpperCase())
      .single()

    if (storeError || !store) {
      return NextResponse.json(
        { error: 'Invalid store code' },
        { status: 404 }
      )
    }

    // For manager joining, also create the manager record
    if (userType === 'Manager' && managerId) {
      const { error: managerError } = await supabaseAdmin
        .from('managers')
        .insert([
          {
            id: managerId,
            email: userEmail,
            full_name: userName,
            phone_number: userPhone,
            store_name: '', // Will get store name after approval
          },
        ])

      if (managerError) {
        console.error('Error creating manager record:', managerError)
        return NextResponse.json(
          { error: 'Failed to create manager account' },
          { status: 500 }
        )
      }
    }

    // Create join request
    const { data: joinRequest, error: joinError } = await supabaseAdmin
      .from('join_requests')
      .insert([
        {
          store_id: store.id,
          user_id: userId,
          user_type: userType,
          user_name: userName,
          user_phone: userPhone,
          user_email: userEmail || null,
          status: 'pending',
        },
      ])
      .select()
      .single()

    if (joinError) {
      console.error('Error creating join request:', joinError)
      return NextResponse.json(
        { error: 'Failed to create join request' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      requestId: joinRequest.id,
    })
  } catch (error: any) {
    console.error('Error in join store API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
