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
    const [storesRes, managersRes, cashierAccountsRes, pendingSignupsRes, pendingJoinRes] = await Promise.all([
      supabaseAdmin.from('stores').select('id, is_active'),
      supabaseAdmin.from('managers').select('id, is_active'),
      supabaseAdmin.from('cashier_accounts').select('id, is_active'),
      // Manager signup requests awaiting approval
      supabaseAdmin.from('join_requests').select('id').eq('user_type', 'Manager').eq('status', 'pending'),
      // Cashier join-store requests (separate from signup approvals)
      supabaseAdmin.from('join_requests').select('id').eq('user_type', 'Cashier').eq('status', 'pending'),
    ])

    const stores = storesRes.data || []
    const managers = managersRes.data || []
    const cashierAccounts = cashierAccountsRes.data || []
    const pendingSignups = pendingSignupsRes.data || []
    const pendingJoinRequests = pendingJoinRes.data || []

    return NextResponse.json({
      stores: {
        total: stores.length,
        active: stores.filter(s => s.is_active).length,
        inactive: stores.filter(s => !s.is_active).length,
      },
      managers: {
        total: managers.length,
        active: managers.filter(m => m.is_active).length,
        inactive: managers.filter(m => !m.is_active).length,
      },
      cashierAccounts: {
        total: cashierAccounts.length,
        active: cashierAccounts.filter(c => c.is_active).length,
        inactive: cashierAccounts.filter(c => !c.is_active).length,
      },
      pendingSignups: pendingSignups.length,
      pendingJoinRequests: pendingJoinRequests.length,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
