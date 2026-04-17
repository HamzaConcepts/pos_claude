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

// POST /api/quotations/[id]/finalize - Mark quotation as finalized
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const quotationId = parseInt((await params).id)
    const body = await request.json()
    const { store_id, finalized_by, finalized_by_cashier_id } = body

    if (!store_id) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Fetch existing quotation
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('quotations')
      .select('*, quotation_items(*)')
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

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot finalize a ${existing.status} quotation. Only draft quotations can be finalized.` },
        { status: 409 }
      )
    }

    // Verify quotation has items
    if (!existing.quotation_items || existing.quotation_items.length === 0) {
      return NextResponse.json(
        { error: 'Cannot finalize a quotation with no items' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Update status
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('quotations')
      .update({
        status: 'finalized',
        finalized_at: now,
        finalized_by: finalized_by || null,
        finalized_by_cashier_id: finalized_by_cashier_id || null,
      })
      .eq('id', quotationId)
      .select('*, quotation_items(*)')
      .single()

    if (updateError) {
      console.error('Error finalizing quotation:', updateError)
      return NextResponse.json(
        { error: 'Failed to finalize quotation' },
        { status: 500 }
      )
    }

    // Audit log
    await supabaseAdmin.from('quotation_audit_logs').insert({
      quotation_id: quotationId,
      action: 'finalized',
      user_id: finalized_by || null,
      cashier_id: finalized_by_cashier_id || null,
      changes: {
        previous_status: 'draft',
        new_status: 'finalized',
        finalized_at: now,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error in POST /api/quotations/[id]/finalize:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
