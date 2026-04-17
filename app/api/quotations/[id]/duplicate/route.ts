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

// Generate next quotation number for a store
async function generateQuotationNumber(storeId: number): Promise<string> {
  const currentYear = new Date().getFullYear()

  const { data: existing } = await supabaseAdmin
    .from('quotation_sequences')
    .select('last_sequence')
    .eq('store_id', storeId)
    .eq('year', currentYear)
    .single()

  let nextSequence: number

  if (existing) {
    nextSequence = existing.last_sequence + 1
    await supabaseAdmin
      .from('quotation_sequences')
      .update({ last_sequence: nextSequence })
      .eq('store_id', storeId)
      .eq('year', currentYear)
  } else {
    nextSequence = 1
    await supabaseAdmin
      .from('quotation_sequences')
      .insert({ store_id: storeId, year: currentYear, last_sequence: 1 })
  }

  const paddedSequence = String(nextSequence).padStart(6, '0')
  return `Q-${currentYear}-${paddedSequence}`
}

// POST /api/quotations/[id]/duplicate - Create a copy of an existing quotation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const quotationId = parseInt((await params).id)
    const body = await request.json()
    const { store_id, created_by, created_by_cashier_id } = body

    if (!store_id) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Fetch original quotation with items
    const { data: original, error: fetchError } = await supabaseAdmin
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('id', quotationId)
      .eq('store_id', parseInt(store_id))
      .is('deleted_at', null)
      .single()

    if (fetchError || !original) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      )
    }

    // Generate new quotation number
    const quotationNumber = await generateQuotationNumber(parseInt(store_id))

    // Set default valid_until to 30 days from now
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 30)

    // Create new quotation as draft copy
    const { data: newQuotation, error: createError } = await supabaseAdmin
      .from('quotations')
      .insert({
        quotation_number: quotationNumber,
        customer_name: original.customer_name,
        customer_phone: original.customer_phone,
        customer_email: original.customer_email,
        customer_address: original.customer_address,
        subtotal: original.subtotal,
        discount_type: original.discount_type,
        discount_value: original.discount_value,
        discount_amount: original.discount_amount,
        total: original.total,
        notes: original.notes,
        terms_and_conditions: original.terms_and_conditions,
        valid_until: validUntil.toISOString().split('T')[0],
        status: 'draft',
        store_id: parseInt(store_id),
        created_by: created_by || null,
        created_by_cashier_id: created_by_cashier_id || null,
      })
      .select()
      .single()

    if (createError || !newQuotation) {
      console.error('Error duplicating quotation:', createError)
      return NextResponse.json(
        { error: 'Failed to duplicate quotation' },
        { status: 500 }
      )
    }

    // Copy items
    if (original.quotation_items && original.quotation_items.length > 0) {
      const newItems = original.quotation_items.map((item: Record<string, unknown>) => ({
        quotation_id: newQuotation.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        product_description: item.product_description,
        product_category: item.product_category,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        discount_amount: item.discount_amount || 0,
        notes: item.notes,
        sort_order: item.sort_order,
        is_manual_item: item.is_manual_item,
      }))

      const { error: itemsError } = await supabaseAdmin
        .from('quotation_items')
        .insert(newItems)

      if (itemsError) {
        console.error('Error duplicating items:', itemsError)
        await supabaseAdmin.from('quotations').delete().eq('id', newQuotation.id)
        return NextResponse.json(
          { error: 'Failed to duplicate quotation items' },
          { status: 500 }
        )
      }
    }

    // Audit log
    await supabaseAdmin.from('quotation_audit_logs').insert({
      quotation_id: newQuotation.id,
      action: 'created',
      user_id: created_by || null,
      cashier_id: created_by_cashier_id || null,
      changes: {
        duplicated_from: original.quotation_number,
        original_id: original.id,
        quotation_number: quotationNumber,
      },
    })

    // Fetch complete new quotation
    const { data: complete } = await supabaseAdmin
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('id', newQuotation.id)
      .single()

    return NextResponse.json(
      { success: true, data: complete },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in POST /api/quotations/[id]/duplicate:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
