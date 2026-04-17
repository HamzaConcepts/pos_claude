import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// POST /api/quotations/[id]/reopen - Revert finalized quotation to draft (Manager only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const quotationId = parseInt((await params).id)
    const body = await request.json()
    const { store_id, reopened_by } = body

    if (!store_id) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Fetch existing quotation  
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('quotations')
      .select('*')
      .eq('id', quotationId)
      .eq('store_id', parseInt(store_id))
      .is('deleted_at', null)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      )
    }

    if (existing.status !== 'finalized') {
      return NextResponse.json(
        { error: `Can only reopen finalized quotations. Current status: ${existing.status}` },
        { status: 409 }
      )
    }

    // Update status back to draft
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('quotations')
      .update({
        status: 'draft',
        finalized_at: null,
        finalized_by: null,
        finalized_by_cashier_id: null,
      })
      .eq('id', quotationId)
      .select('*, quotation_items(*)')
      .single()

    if (updateError) {
      console.error('Error reopening quotation:', updateError)
      return NextResponse.json(
        { error: 'Failed to reopen quotation' },
        { status: 500 }
      )
    }

    // Audit log
    await supabaseAdmin.from('quotation_audit_logs').insert({
      quotation_id: quotationId,
      action: 'reopened',
      user_id: reopened_by || null,
      cashier_id: null,
      changes: {
        previous_status: 'finalized',
        new_status: 'draft',
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error in POST /api/quotations/[id]/reopen:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
