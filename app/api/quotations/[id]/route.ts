import { NextResponse } from 'next/server'
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

// GET /api/quotations/[id] - Get a single quotation with items
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')
    const quotationId = parseInt(params.id)

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('id', quotationId)
      .eq('store_id', parseInt(storeId))
      .is('deleted_at', null)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      )
    }

    // Sort items by sort_order
    if (data.quotation_items) {
      data.quotation_items.sort((a: { sort_order: number }, b: { sort_order: number }) => 
        a.sort_order - b.sort_order
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error in GET /api/quotations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/quotations/[id] - Update a draft quotation
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const quotationId = parseInt(params.id)
    const body = await request.json()
    const {
      store_id,
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      valid_until,
      notes,
      terms_and_conditions,
      discount_type,
      discount_value,
      items,
      updated_by,
      updated_by_cashier_id,
    } = body

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

    // Only draft quotations can be edited
    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot edit a ${existing.status} quotation. Only draft quotations can be modified.` },
        { status: 409 }
      )
    }

    // Validate items if provided
    if (items && items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      )
    }

    // Process items if provided
    let processedItems = null
    let subtotal = existing.subtotal
    let discountAmount = existing.discount_amount
    let total = existing.total
    const finalDiscountType = discount_type !== undefined ? discount_type : existing.discount_type
    const finalDiscountValue = discount_value !== undefined ? discount_value : existing.discount_value

    if (items && items.length > 0) {
      processedItems = []
      for (const item of items) {
        if (!item.is_manual_item && item.product_id) {
          // Fetch product snapshot
          const { data: product } = await supabaseAdmin
            .from('products')
            .select(`
              id, name, sku, description,
              categories (name),
              aggregated_stock (aggregated_selling_price)
            `)
            .eq('id', item.product_id)
            .single()

          if (product) {
            const aggStock = Array.isArray(product.aggregated_stock) 
              ? product.aggregated_stock[0] 
              : product.aggregated_stock
            const unitPrice = item.unit_price !== undefined ? item.unit_price :
              (aggStock?.aggregated_selling_price || 0)

            processedItems.push({
              quotation_id: quotationId,
              product_id: product.id,
              product_name: product.name,
              product_sku: product.sku || '',
              product_description: product.description || '',
              product_category: ((product.categories as any)?.[0]?.name || (product.categories as any)?.name) || '',
              quantity: item.quantity,
              unit_price: unitPrice,
              line_total: Math.round(item.quantity * unitPrice * 100) / 100,
              is_manual_item: false,
              notes: item.notes || '',
              sort_order: item.sort_order || processedItems.length,
            })
          }
        } else {
          const unitPrice = item.unit_price || 0
          processedItems.push({
            quotation_id: quotationId,
            product_id: null,
            product_name: item.product_name,
            product_sku: item.product_sku || '',
            product_description: item.product_description || '',
            product_category: item.product_category || '',
            quantity: item.quantity,
            unit_price: unitPrice,
            line_total: Math.round(item.quantity * unitPrice * 100) / 100,
            is_manual_item: true,
            notes: item.notes || '',
            sort_order: item.sort_order || processedItems.length,
          })
        }
      }

      // Recalculate financials
      subtotal = processedItems.reduce((sum, item) => sum + item.line_total, 0)
      subtotal = Math.round(subtotal * 100) / 100

      discountAmount = 0
      if (finalDiscountValue && finalDiscountValue > 0) {
        if (finalDiscountType === 'percentage') {
          discountAmount = Math.round((subtotal * finalDiscountValue) / 100 * 100) / 100
        } else if (finalDiscountType === 'fixed') {
          discountAmount = Math.min(finalDiscountValue, subtotal)
        }
      }
      discountAmount = Math.round(discountAmount * 100) / 100
      total = Math.round((subtotal - discountAmount) * 100) / 100
    } else if (discount_type !== undefined || discount_value !== undefined) {
      // Recalculate discount even if items didn't change
      discountAmount = 0
      if (finalDiscountValue && finalDiscountValue > 0) {
        if (finalDiscountType === 'percentage') {
          discountAmount = Math.round((subtotal * finalDiscountValue) / 100 * 100) / 100
        } else if (finalDiscountType === 'fixed') {
          discountAmount = Math.min(finalDiscountValue, subtotal)
        }
      }
      discountAmount = Math.round(discountAmount * 100) / 100
      total = Math.round((subtotal - discountAmount) * 100) / 100
    }

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (customer_name !== undefined) updateData.customer_name = customer_name || null
    if (customer_phone !== undefined) updateData.customer_phone = customer_phone || null
    if (customer_email !== undefined) updateData.customer_email = customer_email || null
    if (customer_address !== undefined) updateData.customer_address = customer_address || null
    if (valid_until !== undefined) updateData.valid_until = valid_until || null
    if (notes !== undefined) updateData.notes = notes || null
    if (terms_and_conditions !== undefined) updateData.terms_and_conditions = terms_and_conditions || null
    if (discount_type !== undefined) updateData.discount_type = discount_type
    if (discount_value !== undefined) updateData.discount_value = discount_value

    // Always update financial totals
    updateData.subtotal = subtotal
    updateData.discount_amount = discountAmount
    updateData.total = total

    // Update quotation
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('quotations')
      .update(updateData)
      .eq('id', quotationId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating quotation:', updateError)
      return NextResponse.json(
        { error: 'Failed to update quotation' },
        { status: 500 }
      )
    }

    // Replace items if new ones were provided
    if (processedItems) {
      // Delete old items
      await supabaseAdmin
        .from('quotation_items')
        .delete()
        .eq('quotation_id', quotationId)

      // Insert new items
      const { error: itemsError } = await supabaseAdmin
        .from('quotation_items')
        .insert(processedItems)

      if (itemsError) {
        console.error('Error updating quotation items:', itemsError)
        return NextResponse.json(
          { error: 'Failed to update quotation items' },
          { status: 500 }
        )
      }
    }

    // Create audit log
    await supabaseAdmin.from('quotation_audit_logs').insert({
      quotation_id: quotationId,
      action: 'updated',
      user_id: updated_by || null,
      cashier_id: updated_by_cashier_id || null,
      changes: {
        updated_fields: Object.keys(updateData),
        items_updated: !!processedItems,
        new_total: total,
      },
    })

    // Fetch complete updated quotation
    const { data: completeQuotation } = await supabaseAdmin
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('id', quotationId)
      .single()

    return NextResponse.json({ success: true, data: completeQuotation })
  } catch (error) {
    console.error('Error in PUT /api/quotations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/quotations/[id] - Soft delete a quotation
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')
    const deletedBy = searchParams.get('deleted_by')
    const deletedByCashierId = searchParams.get('deleted_by_cashier_id')
    const quotationId = parseInt(params.id)

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Fetch existing
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('quotations')
      .select('*')
      .eq('id', quotationId)
      .eq('store_id', parseInt(storeId))
      .is('deleted_at', null)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      )
    }

    // Soft delete
    const { error: deleteError } = await supabaseAdmin
      .from('quotations')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy || null,
        deleted_by_cashier_id: deletedByCashierId ? parseInt(deletedByCashierId) : null,
      })
      .eq('id', quotationId)

    if (deleteError) {
      console.error('Error deleting quotation:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete quotation' },
        { status: 500 }
      )
    }

    // Audit log
    await supabaseAdmin.from('quotation_audit_logs').insert({
      quotation_id: quotationId,
      action: 'deleted',
      user_id: deletedBy || null,
      cashier_id: deletedByCashierId ? parseInt(deletedByCashierId) : null,
      changes: {
        previous_status: existing.status,
        quotation_number: existing.quotation_number,
      },
    })

    return NextResponse.json({ success: true, message: 'Quotation deleted' })
  } catch (error) {
    console.error('Error in DELETE /api/quotations/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
