import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySuperAdminRequest } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(request: Request) {
  if (!(await verifySuperAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'all'
    const storeId = searchParams.get('store_id') || ''

    let query = supabaseAdmin
      .from('managers')
      .select('id, full_name, email, phone_number, store_id, store_name, is_active, created_at, store_code')
      .order('created_at', { ascending: false })

    if (status === 'active') query = query.eq('is_active', true)
    else if (status === 'inactive') query = query.eq('is_active', false)

    if (storeId) query = query.eq('store_id', parseInt(storeId))

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone_number.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
