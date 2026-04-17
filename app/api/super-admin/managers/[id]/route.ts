import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySuperAdminRequest } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifySuperAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const managerId = (await params).id
    const body = await request.json()
    const allowedFields = ['full_name', 'email', 'phone_number', 'is_active']
    const updates: Record<string, any> = {}

    for (const field of allowedFields) {
      if (body[field] === undefined) continue

      if ((field === 'full_name' || field === 'email' || field === 'phone_number') && typeof body[field] === 'string') {
        updates[field] = body[field].trim()
        continue
      }

      updates[field] = body[field]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('managers')
      .update(updates)
      .eq('id', managerId)
      .select()
      .single()

    if (error) throw error

    // Sync Supabase Auth ban status with is_active
    if (updates.is_active === false) {
      await supabaseAdmin.auth.admin.updateUserById(managerId, { ban_duration: '876000h' }) // ~100 years
    } else if (updates.is_active === true) {
      await supabaseAdmin.auth.admin.updateUserById(managerId, { ban_duration: 'none' })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifySuperAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const managerId = (await params).id

    // Soft delete
    const { error } = await supabaseAdmin
      .from('managers')
      .update({ is_active: false })
      .eq('id', managerId)

    if (error) throw error

    // Ban from Supabase Auth
    await supabaseAdmin.auth.admin.updateUserById(managerId, { ban_duration: '876000h' })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
