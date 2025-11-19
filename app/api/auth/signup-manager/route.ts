// API endpoint to signup manager (handles both create and join store)
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
    const { email, password, fullName, phoneNumber, storeName, action, storeCode } = await request.json()

    // Validate inputs
    if (!email || !password || !fullName || !phoneNumber || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const { data: existingManager } = await supabaseAdmin
      .from('managers')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    if (existingManager) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    // Check if phone already exists
    const { data: existingPhone } = await supabaseAdmin
      .from('managers')
      .select('phone_number')
      .eq('phone_number', phoneNumber)
      .maybeSingle()

    if (existingPhone) {
      return NextResponse.json(
        { error: 'Phone number already exists' },
        { status: 400 }
      )
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // Require email confirmation
      user_metadata: {
        full_name: fullName,
        phone_number: phoneNumber,
        role: 'Manager',
      },
    })

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError)
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user' },
        { status: 500 }
      )
    }

    const userId = authData.user.id

    if (action === 'create') {
      // Create new store
      if (!storeName) {
        // Cleanup auth user
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json(
          { error: 'Store name is required' },
          { status: 400 }
        )
      }

      // Generate store code
      const { data: generatedCode, error: codeError } = await supabaseAdmin.rpc('generate_store_code')

      if (codeError || !generatedCode) {
        // Cleanup auth user
        await supabaseAdmin.auth.admin.deleteUser(userId)
        console.error('Error generating store code:', codeError)
        return NextResponse.json(
          { error: 'Failed to generate store code' },
          { status: 500 }
        )
      }

      // Create store
      const { data: store, error: storeError } = await supabaseAdmin
        .from('stores')
        .insert([
          {
            store_code: generatedCode,
            store_name: storeName,
            created_by: userId,
          },
        ])
        .select()
        .single()

      if (storeError || !store) {
        // Cleanup auth user
        await supabaseAdmin.auth.admin.deleteUser(userId)
        console.error('Error creating store:', storeError)
        return NextResponse.json(
          { error: 'Failed to create store' },
          { status: 500 }
        )
      }

      // Create manager record
      const { error: managerError } = await supabaseAdmin
        .from('managers')
        .insert([
          {
            id: userId,
            email,
            full_name: fullName,
            phone_number: phoneNumber,
            store_name: storeName,
            store_id: store.id,
          },
        ])

      if (managerError) {
        // Cleanup store and auth user
        await supabaseAdmin.from('stores').delete().eq('id', store.id)
        await supabaseAdmin.auth.admin.deleteUser(userId)
        console.error('Error creating manager:', managerError)
        return NextResponse.json(
          { error: 'Failed to create manager account' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        storeCode: generatedCode,
        message: 'Store and manager account created successfully',
      })
    } else if (action === 'join') {
      // Join existing store
      if (!storeCode) {
        // Cleanup auth user
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json(
          { error: 'Store code is required' },
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
        // Cleanup auth user
        await supabaseAdmin.auth.admin.deleteUser(userId)
        return NextResponse.json(
          { error: 'Invalid store code' },
          { status: 404 }
        )
      }

      // Create manager record WITHOUT store_id (will be set after approval)
      const { error: managerError } = await supabaseAdmin
        .from('managers')
        .insert([
          {
            id: userId,
            email,
            full_name: fullName,
            phone_number: phoneNumber,
            store_name: store.store_name,
            store_id: null, // Not assigned yet
          },
        ])

      if (managerError) {
        // Cleanup auth user
        await supabaseAdmin.auth.admin.deleteUser(userId)
        console.error('Error creating manager:', managerError)
        return NextResponse.json(
          { error: 'Failed to create manager account' },
          { status: 500 }
        )
      }

      // Create join request
      const { error: requestError } = await supabaseAdmin
        .from('join_requests')
        .insert([
          {
            store_id: store.id,
            user_id: userId,
            user_type: 'Manager',
            user_name: fullName,
            user_phone: phoneNumber,
            user_email: email,
            status: 'pending',
          },
        ])

      if (requestError) {
        // Cleanup manager and auth user
        await supabaseAdmin.from('managers').delete().eq('id', userId)
        await supabaseAdmin.auth.admin.deleteUser(userId)
        console.error('Error creating join request:', requestError)
        return NextResponse.json(
          { error: 'Failed to create join request' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Join request created successfully',
      })
    } else {
      // Cleanup auth user
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Error in signup-manager API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
