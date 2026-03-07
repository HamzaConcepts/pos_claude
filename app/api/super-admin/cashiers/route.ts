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
      .from('cashier_accounts')
      .select('id, full_name, phone_number, role, store_id, is_active, created_at')
      .order('created_at', { ascending: false })

    if (status === 'active') query = query.eq('is_active', true)
    else if (status === 'inactive') query = query.eq('is_active', false)

    if (storeId) query = query.eq('store_id', parseInt(storeId))

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) throw error

    // Enrich with store name
    const storeIds = [...new Set((data || []).map(c => c.store_id).filter(Boolean))]
    let storeMap: Record<number, string> = {}

    if (storeIds.length > 0) {
      const { data: stores } = await supabaseAdmin
        .from('stores')
        .select('id, store_name')
        .in('id', storeIds)

      if (stores) {
        storeMap = Object.fromEntries(stores.map(s => [s.id, s.store_name]))
      }
    }

    const enriched = (data || []).map(c => ({
      ...c,
      store_name: c.store_id ? storeMap[c.store_id] || 'Unknown' : 'Unassigned',
    }))

    return NextResponse.json({ data: enriched })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
