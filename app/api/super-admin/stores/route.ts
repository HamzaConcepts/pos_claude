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

    let query = supabaseAdmin
      .from('stores')
      .select('id, store_code, store_name, currency, is_active, created_at, created_by')
      .order('created_at', { ascending: false })

    if (status === 'active') query = query.eq('is_active', true)
    else if (status === 'inactive') query = query.eq('is_active', false)

    if (search) {
      query = query.or(`store_name.ilike.%${search}%,store_code.ilike.%${search}%`)
    }

    const { data: stores, error } = await query

    if (error) throw error

    // Enrich with manager info and cashier count
    const enriched = await Promise.all(
      (stores || []).map(async (store) => {
        const [managerRes, cashierCountRes, salesCountRes] = await Promise.all([
          supabaseAdmin
            .from('managers')
            .select('id, full_name, email, phone_number')
            .eq('store_id', store.id)
            .limit(1)
            .maybeSingle(),
          supabaseAdmin
            .from('cashier_accounts')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', store.id),
          supabaseAdmin
            .from('sales')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', store.id),
        ])

        return {
          ...store,
          owner: managerRes.data || null,
          cashier_count: cashierCountRes.count || 0,
          sales_count: salesCountRes.count || 0,
        }
      })
    )

    return NextResponse.json({ data: enriched })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
