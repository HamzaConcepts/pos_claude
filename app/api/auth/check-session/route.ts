// API endpoint to check user session (bypasses RLS)
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

export async function GET(request: Request) {
  try {
    console.log('[API] Check-session endpoint called')
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    console.log('[API] Auth header:', authHeader ? 'Present' : 'Missing')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[API] Invalid or missing authorization header')
      return NextResponse.json(
        { error: 'No authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('[API] Token extracted, length:', token.length)

    // Verify the token with Supabase
    console.log('[API] Verifying token with Supabase...')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    console.log('[API] Token verification result:', { 
      userId: user?.id, 
      error: authError?.message 
    })

    if (authError || !user) {
      console.error('[API] Auth error:', authError)
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Use admin client to fetch manager data (bypasses RLS)
    console.log('[API] Fetching manager data for user:', user.id)
    const { data: manager, error } = await supabaseAdmin
      .from('managers')
      .select('full_name, store_id')
      .eq('id', user.id)
      .maybeSingle()

    console.log('[API] Manager query result:', { 
      found: !!manager, 
      error: error?.message,
      data: manager 
    })

    if (error || !manager) {
      console.error('[API] Error fetching manager:', error)
      return NextResponse.json(
        { error: 'Manager not found' },
        { status: 404 }
      )
    }

    console.log('[API] Returning user data successfully')
    return NextResponse.json({
      role: 'Manager',
      name: manager.full_name,
      store_id: manager.store_id,
      user_id: user.id,
    })
  } catch (error: any) {
    console.error('[API] Error in check-session API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
