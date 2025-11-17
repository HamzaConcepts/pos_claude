import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Fetch all users
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .order('full_name', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: users || [],
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch users',
        code: 'FETCH_USERS_ERROR',
      },
      { status: 500 }
    )
  }
}
