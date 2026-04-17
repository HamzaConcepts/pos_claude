import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySuperAdminRequest } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const MANAGER_BAN_DURATION = '876000h' // ~100 years
const MANAGER_UNBAN_DURATION = 'none'

async function syncManagersAuthBanStatus(managerIds: string[], shouldBan: boolean) {
  if (managerIds.length === 0) return

  const banDuration = shouldBan ? MANAGER_BAN_DURATION : MANAGER_UNBAN_DURATION

  await Promise.all(
    managerIds.map(async (managerId) => {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(managerId, { ban_duration: banDuration })
      if (error) {
        console.error(`Failed to update auth ban status for manager ${managerId}:`, error.message)
      }
    })
  )
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!(await verifySuperAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const storeId = parseInt(params.id)
    if (isNaN(storeId)) return NextResponse.json({ error: 'Invalid store ID' }, { status: 400 })

    const [storeRes, managersRes, cashierAccountsRes, cashiersRes, joinRequestsRes] = await Promise.all([
      supabaseAdmin.from('stores').select('*').eq('id', storeId).single(),
      supabaseAdmin.from('managers').select('id, full_name, email, phone_number, is_active, created_at').eq('store_id', storeId),
      supabaseAdmin.from('cashier_accounts').select('id, full_name, phone_number, role, is_active, created_at').eq('store_id', storeId),
      supabaseAdmin.from('cashiers').select('id, full_name, phone_number, commission_rate, salary, is_active, created_at').eq('store_id', storeId),
      supabaseAdmin.from('join_requests').select('*').eq('store_id', storeId).order('requested_at', { ascending: false }).limit(20),
    ])

    if (storeRes.error) throw storeRes.error

    return NextResponse.json({
      store: storeRes.data,
      managers: managersRes.data || [],
      cashierAccounts: cashierAccountsRes.data || [],
      cashiers: cashiersRes.data || [],
      joinRequests: joinRequestsRes.data || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await verifySuperAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const storeId = parseInt(params.id)
    if (isNaN(storeId)) return NextResponse.json({ error: 'Invalid store ID' }, { status: 400 })

    const body = await request.json()
    const allowedFields = ['store_name', 'is_active', 'currency']
    const updates: Record<string, any> = {}

    for (const field of allowedFields) {
      if (body[field] === undefined) continue

      if ((field === 'store_name' || field === 'currency') && typeof body[field] === 'string') {
        updates[field] = body[field].trim()
        continue
      }

      updates[field] = body[field]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('stores')
      .update(updates)
      .eq('id', storeId)
      .select()
      .single()

    if (error) throw error

    // When store status changes, mirror the state to all store users.
    if (updates.is_active === false || updates.is_active === true) {
      const shouldActivate = updates.is_active === true

      const [managersUpdateRes, cashierAccountsUpdateRes, cashiersUpdateRes, managersRes] = await Promise.all([
        supabaseAdmin.from('managers').update({ is_active: shouldActivate }).eq('store_id', storeId),
        supabaseAdmin.from('cashier_accounts').update({ is_active: shouldActivate }).eq('store_id', storeId),
        supabaseAdmin.from('cashiers').update({ is_active: shouldActivate }).eq('store_id', storeId),
        supabaseAdmin.from('managers').select('id').eq('store_id', storeId),
      ])

      if (managersUpdateRes.error) throw managersUpdateRes.error
      if (cashierAccountsUpdateRes.error) throw cashierAccountsUpdateRes.error
      if (cashiersUpdateRes.error) throw cashiersUpdateRes.error
      if (managersRes.error) throw managersRes.error

      await syncManagersAuthBanStatus((managersRes.data || []).map((m) => m.id), !shouldActivate)
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!(await verifySuperAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const storeId = parseInt(params.id)
    if (isNaN(storeId)) return NextResponse.json({ error: 'Invalid store ID' }, { status: 400 })

    // Soft delete: deactivate store and all associated users.
    const [storeRes, managersRes, cashierAccountsRes, cashiersRes, managerIdsRes] = await Promise.all([
      supabaseAdmin.from('stores').update({ is_active: false }).eq('id', storeId),
      supabaseAdmin.from('managers').update({ is_active: false }).eq('store_id', storeId),
      supabaseAdmin.from('cashier_accounts').update({ is_active: false }).eq('store_id', storeId),
      supabaseAdmin.from('cashiers').update({ is_active: false }).eq('store_id', storeId),
      supabaseAdmin.from('managers').select('id').eq('store_id', storeId),
    ])

    if (storeRes.error) throw storeRes.error
    if (managersRes.error) throw managersRes.error
    if (cashierAccountsRes.error) throw cashierAccountsRes.error
    if (cashiersRes.error) throw cashiersRes.error
    if (managerIdsRes.error) throw managerIdsRes.error

    await syncManagersAuthBanStatus((managerIdsRes.data || []).map((m) => m.id), true)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
