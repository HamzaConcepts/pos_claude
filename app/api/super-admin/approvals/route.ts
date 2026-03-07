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
    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'pending'

    const query = supabaseAdmin
      .from('join_requests')
      .select('id, store_id, user_id, user_name, user_phone, user_email, status, requested_at, reviewed_at, notes')
      .eq('user_type', 'Manager')
      .order('requested_at', { ascending: false })

    if (status !== 'all') {
      query.eq('status', status)
    }

    const { data: requests, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({ requests: [] })
    }

    // Enrich with store name and cashier/staff counts
    const storeIds = [...new Set(requests.map((r) => r.store_id))]

    const [storesRes, cashierAccountsRes, staffRes] = await Promise.all([
      supabaseAdmin.from('stores').select('id, store_name, store_code').in('id', storeIds),
      supabaseAdmin.from('cashier_accounts').select('id, store_id').in('store_id', storeIds),
      supabaseAdmin.from('cashiers').select('id, store_id').in('store_id', storeIds),
    ])

    const storeMap = Object.fromEntries((storesRes.data || []).map((s) => [s.id, s]))
    const cashierCountMap: Record<number, number> = {}
    const staffCountMap: Record<number, number> = {}

    for (const ca of cashierAccountsRes.data || []) {
      cashierCountMap[ca.store_id] = (cashierCountMap[ca.store_id] || 0) + 1
    }
    for (const s of staffRes.data || []) {
      staffCountMap[s.store_id] = (staffCountMap[s.store_id] || 0) + 1
    }

    const enriched = requests.map((r) => ({
      ...r,
      store_name: storeMap[r.store_id]?.store_name || 'Unknown',
      store_code: storeMap[r.store_id]?.store_code || 'N/A',
      cashier_count: cashierCountMap[r.store_id] || 0,
      staff_count: staffCountMap[r.store_id] || 0,
    }))

    return NextResponse.json({ requests: enriched })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
