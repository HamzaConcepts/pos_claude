import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSuperAdminUser } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await getSuperAdminUser(request)
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const requestId = parseInt(id, 10)
  if (isNaN(requestId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  try {
    const { action, notes } = await request.json()

    if (!['approve', 'deny'].includes(action)) {
      return NextResponse.json({ error: 'action must be "approve" or "deny"' }, { status: 400 })
    }

    // Fetch the join_request (must be a pending Manager signup)
    const { data: joinRequest, error: fetchError } = await supabaseAdmin
      .from('join_requests')
      .select('id, store_id, user_id, user_name, status')
      .eq('id', requestId)
      .eq('user_type', 'Manager')
      .maybeSingle()

    if (fetchError || !joinRequest) {
      return NextResponse.json({ error: 'Signup request not found' }, { status: 404 })
    }

    if (joinRequest.status !== 'pending') {
      return NextResponse.json(
        { error: `Request has already been ${joinRequest.status}` },
        { status: 409 }
      )
    }

    const { store_id, user_id: managerId } = joinRequest

    // ── APPROVE ───────────────────────────────────────────────────────────────
    if (action === 'approve') {
      // 1. Confirm email in Supabase Auth so the manager can sign in
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(managerId, {
        email_confirm: true,
      })
      if (authError) {
        return NextResponse.json(
          { error: `Failed to confirm auth user: ${authError.message}` },
          { status: 500 }
        )
      }

      // 2. Activate all records for this store in parallel
      await Promise.all([
        supabaseAdmin.from('managers').update({ is_active: true }).eq('id', managerId),
        supabaseAdmin.from('stores').update({ is_active: true }).eq('id', store_id),
        supabaseAdmin.from('cashier_accounts').update({ is_active: true }).eq('store_id', store_id),
        supabaseAdmin.from('cashiers').update({ is_active: true }).eq('store_id', store_id),
      ])

      // 3. Mark request as approved
      const { error: approveUpdateError } = await supabaseAdmin
        .from('join_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          notes: notes || null,
        })
        .eq('id', requestId)
      if (approveUpdateError) console.error('Failed to update join_request status to approved:', approveUpdateError)

      return NextResponse.json({ success: true, action: 'approved' })
    }

    // ── DENY ──────────────────────────────────────────────────────────────────
    if (action === 'deny') {
      // 1. Mark request as rejected first (so FK constraints don't break
      //    if the store/manager get cleaned up later)
      const { error: denyUpdateError } = await supabaseAdmin
        .from('join_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          notes: notes || null,
        })
        .eq('id', requestId)
      if (denyUpdateError) console.error('Failed to update join_request status to rejected:', denyUpdateError)

      // 2. Ban the Supabase auth user (~100 year ban)
      await supabaseAdmin.auth.admin.updateUserById(managerId, {
        ban_duration: '876000h',
      })

      // All DB records (manager, store, cashiers) remain is_active=false,
      // so they are invisible to the rest of the app. The super-admin can
      // delete them from the Stores panel if desired.

      return NextResponse.json({ success: true, action: 'denied' })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
