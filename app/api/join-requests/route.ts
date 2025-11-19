// API endpoint to manage join requests (GET, PATCH)
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

// GET: Fetch join requests for a store
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    const { data: requests, error } = await supabaseAdmin
      .from('join_requests')
      .select('*')
      .eq('store_id', parseInt(storeId))
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('Error fetching join requests:', error)
      return NextResponse.json(
        { error: 'Failed to fetch join requests' },
        { status: 500 }
      )
    }

    return NextResponse.json({ requests })
  } catch (error: any) {
    console.error('Error in GET join requests:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: Approve or reject a join request
export async function PATCH(request: Request) {
  try {
    const { requestId, action, reviewerId } = await request.json()

    if (!requestId || !action || !reviewerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    // Get join request details
    const { data: joinRequest, error: fetchError } = await supabaseAdmin
      .from('join_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchError || !joinRequest) {
      return NextResponse.json(
        { error: 'Join request not found' },
        { status: 404 }
      )
    }

    // Update join request status
    const { error: updateError } = await supabaseAdmin
      .from('join_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)

    if (updateError) {
      console.error('Error updating join request:', updateError)
      return NextResponse.json(
        { error: 'Failed to update join request' },
        { status: 500 }
      )
    }

    // If approved, assign user to store
    if (action === 'approve') {
      const tableName = joinRequest.user_type === 'Manager' ? 'managers' : 'cashier_accounts'
      
      // Get store name
      const { data: store } = await supabaseAdmin
        .from('stores')
        .select('store_name')
        .eq('id', joinRequest.store_id)
        .single()

      if (joinRequest.user_type === 'Manager') {
        const { error: assignError } = await supabaseAdmin
          .from(tableName)
          .update({ 
            store_id: joinRequest.store_id,
            store_name: store?.store_name || '',
            is_active: true 
          })
          .eq('id', joinRequest.user_id)

        if (assignError) {
          console.error('Error assigning manager to store:', assignError)
          return NextResponse.json(
            { error: 'Failed to assign user to store' },
            { status: 500 }
          )
        }
      } else {
        // For cashiers, user_id is stored as string but table uses integer
        const { error: assignError } = await supabaseAdmin
          .from(tableName)
          .update({ 
            store_id: joinRequest.store_id,
            is_active: true 
          })
          .eq('id', parseInt(joinRequest.user_id))

        if (assignError) {
          console.error('Error assigning cashier to store:', assignError)
          return NextResponse.json(
            { error: 'Failed to assign user to store' },
            { status: 500 }
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      action: action,
    })
  } catch (error: any) {
    console.error('Error in PATCH join requests:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
