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
    const [storesRes, managersRes, cashierAccountsRes, pendingSignupsRes, pendingJoinRes, feeSettingsRes, billingChargesRes] = await Promise.all([
      supabaseAdmin.from('stores').select('id, is_active'),
      supabaseAdmin.from('managers').select('id, is_active'),
      supabaseAdmin.from('cashier_accounts').select('id, is_active'),
      // Manager signup requests awaiting approval
      supabaseAdmin.from('join_requests').select('id').eq('user_type', 'Manager').eq('status', 'pending'),
      // Cashier join-store requests (separate from signup approvals)
      supabaseAdmin.from('join_requests').select('id').eq('user_type', 'Cashier').eq('status', 'pending'),
      supabaseAdmin.from('store_order_fee_settings').select('store_id, is_active'),
      supabaseAdmin.from('store_billing_charges').select('store_id, amount_due'),
    ])

    const stores = storesRes.data || []
    const managers = managersRes.data || []
    const cashierAccounts = cashierAccountsRes.data || []
    const pendingSignups = pendingSignupsRes.data || []
    const pendingJoinRequests = pendingJoinRes.data || []
    const feeSettings = feeSettingsRes.data || []
    const billingCharges = billingChargesRes.data || []

    const billedStores = feeSettings.filter((setting) => setting.is_active).length
    const totalOwed = Number(
      billingCharges.reduce((sum, charge) => sum + Number(charge.amount_due || 0), 0).toFixed(2)
    )

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
      billing: {
        totalOwed,
        billedStores,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
