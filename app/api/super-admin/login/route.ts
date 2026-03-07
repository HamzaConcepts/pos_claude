import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { COOKIE_NAME } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Use anon key for the sign-in call so Supabase validates credentials normally
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password })

    if (error || !data.user || !data.session) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Only accounts with role === 'super_admin' in user_metadata may access this panel
    if (data.user.user_metadata?.role !== 'super_admin') {
      // Sign out immediately to avoid leaving a dangling session
      await supabaseAnon.auth.signOut()
      return NextResponse.json({ error: 'Not authorized as super admin' }, { status: 403 })
    }

    // Store the Supabase access token in an httpOnly cookie.
    // All super-admin API routes validate this via supabaseAdmin.auth.getUser(token).
    const response = NextResponse.json({ success: true })
    response.cookies.set(COOKIE_NAME, data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours — matches Supabase default session lifetime
      path: '/',
    })

    return response
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
