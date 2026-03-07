import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySuperAdminRequest } from '@/lib/super-admin'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await verifySuperAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cashierId = parseInt(params.id)
    if (isNaN(cashierId)) return NextResponse.json({ error: 'Invalid cashier ID' }, { status: 400 })

    const body = await request.json()
    const allowedFields = ['full_name', 'phone_number', 'is_active']
    const updates: Record<string, any> = {}

    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('cashier_accounts')
      .update(updates)
      .eq('id', cashierId)
      .select()
      .single()

    if (error) throw error

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
    const cashierId = parseInt(params.id)
    if (isNaN(cashierId)) return NextResponse.json({ error: 'Invalid cashier ID' }, { status: 400 })

    // Soft delete
    const { error } = await supabaseAdmin
      .from('cashier_accounts')
      .update({ is_active: false })
      .eq('id', cashierId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
