// API endpoint to lookup manager email by name or phone (bypasses RLS)
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
    const { identifier } = await request.json()

    if (!identifier) {
      return NextResponse.json(
        { error: 'Identifier is required' },
        { status: 400 }
      )
    }

    // Look up manager by name or phone
    const { data: manager, error } = await supabaseAdmin
      .from('managers')
      .select('email')
      .or(`full_name.eq.${identifier},phone_number.eq.${identifier}`)
      .maybeSingle()

    if (error || !manager) {
      return NextResponse.json(
        { error: 'Manager not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ email: manager.email })
  } catch (error: any) {
    console.error('Error in lookup-manager API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
