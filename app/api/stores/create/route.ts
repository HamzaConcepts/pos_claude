// API endpoint to create a new store
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
    const { storeName, managerId, managerEmail, managerName, managerPhone } = await request.json()

    // Validate inputs
    if (!storeName || !managerId || !managerEmail || !managerName || !managerPhone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Generate store code
    const { data: storeCodeData, error: codeError } = await supabaseAdmin.rpc('generate_store_code')

    if (codeError) {
      console.error('Error generating store code:', codeError)
      return NextResponse.json(
        { error: 'Failed to generate store code' },
        { status: 500 }
      )
    }

    const storeCode = storeCodeData

    // Create store
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .insert([
        {
          store_code: storeCode,
          store_name: storeName,
          created_by: managerId,
        },
      ])
      .select()
      .single()

    if (storeError) {
      console.error('Error creating store:', storeError)
      return NextResponse.json(
        { error: 'Failed to create store' },
        { status: 500 }
      )
    }

    // Create manager record with store_id
    const { error: managerError } = await supabaseAdmin
      .from('managers')
      .insert([
        {
          id: managerId,
          email: managerEmail,
          full_name: managerName,
          phone_number: managerPhone,
          store_name: storeName,
          store_id: store.id,
        },
      ])

    if (managerError) {
      console.error('Error creating manager:', managerError)
      // Rollback store creation
      await supabaseAdmin.from('stores').delete().eq('id', store.id)
      return NextResponse.json(
        { error: 'Failed to create manager account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      storeCode: storeCode,
      storeId: store.id,
    })
  } catch (error: any) {
    console.error('Error in create store API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
