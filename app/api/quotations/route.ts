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

// Generate next quotation number for a store
async function generateQuotationNumber(storeId: number): Promise<string> {
  const currentYear = new Date().getFullYear()
  
  // Upsert the sequence counter and get the new value
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

// GET /api/quotations - List quotations with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('quotations')
      .select('*, quotation_items(*)', { count: 'exact' })
      .eq('store_id', parseInt(storeId))
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Search by quotation number, customer name, or phone
    if (search) {
      query = query.or(
        `quotation_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`
      )
    }

    // Date range filters
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo + 'T23:59:59.999Z')
    }

    // Pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching quotations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch quotations' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Error in GET /api/quotations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/quotations - Create a new quotation
export async function POST(request: Request) {
  try {
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
      discount_type = 'none',
      discount_value = 0,
      items = [],
      created_by,
      created_by_cashier_id,
    } = body

    if (!store_id) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      )
    }

    // Validate items
    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity for item: ${item.product_name || 'unknown'}` },
          { status: 400 }
        )
      }
      if (item.unit_price === undefined || item.unit_price < 0) {
        return NextResponse.json(
          { error: `Invalid price for item: ${item.product_name || 'unknown'}` },
          { status: 400 }
        )
      }
      if (item.is_manual_item && !item.product_name) {
        return NextResponse.json(
          { error: 'Product name is required for manual items' },
          { status: 400 }
        )
      }
    }

    // Generate quotation number
    const quotationNumber = await generateQuotationNumber(parseInt(store_id))

    // Snapshot product data for inventory items
    const processedItems = []
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
        // Manual item
        const unitPrice = item.unit_price || 0
        processedItems.push({
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

    // Calculate financials
    const subtotal = processedItems.reduce((sum, item) => sum + item.line_total, 0)
    const roundedSubtotal = Math.round(subtotal * 100) / 100

    let discountAmount = 0
    if (discount_value && discount_value > 0) {
      if (discount_type === 'percentage') {
        discountAmount = Math.round((roundedSubtotal * discount_value) / 100 * 100) / 100
      } else if (discount_type === 'fixed') {
        discountAmount = Math.min(discount_value, roundedSubtotal)
      }
    }
    discountAmount = Math.round(discountAmount * 100) / 100

    const total = Math.round((roundedSubtotal - discountAmount) * 100) / 100

    // Insert quotation
    const { data: quotation, error: quotationError } = await supabaseAdmin
      .from('quotations')
      .insert({
        quotation_number: quotationNumber,
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        customer_address: customer_address || null,
        subtotal: roundedSubtotal,
        discount_type,
        discount_value: discount_value || 0,
        discount_amount: discountAmount,
        total,
        notes: notes || null,
        terms_and_conditions: terms_and_conditions || null,
        valid_until: valid_until || null,
        status: 'draft',
        store_id: parseInt(store_id),
        created_by: created_by || null,
        created_by_cashier_id: created_by_cashier_id || null,
      })
      .select()
      .single()

    if (quotationError) {
      console.error('Error creating quotation:', quotationError)
      return NextResponse.json(
        { error: 'Failed to create quotation' },
        { status: 500 }
      )
    }

    // Insert items
    const itemsToInsert = processedItems.map((item) => ({
      ...item,
      quotation_id: quotation.id,
    }))

    const { error: itemsError } = await supabaseAdmin
      .from('quotation_items')
      .insert(itemsToInsert)

    if (itemsError) {
      console.error('Error creating quotation items:', itemsError)
      // Clean up the quotation if items failed
      await supabaseAdmin.from('quotations').delete().eq('id', quotation.id)
      return NextResponse.json(
        { error: 'Failed to create quotation items' },
        { status: 500 }
      )
    }

    // Create audit log entry
    await supabaseAdmin.from('quotation_audit_logs').insert({
      quotation_id: quotation.id,
      action: 'created',
      user_id: created_by || null,
      cashier_id: created_by_cashier_id || null,
      changes: {
        quotation_number: quotationNumber,
        customer_name,
        items_count: processedItems.length,
        total,
      },
    })

    // Fetch the complete quotation with items
    const { data: completeQuotation } = await supabaseAdmin
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('id', quotation.id)
      .single()

    return NextResponse.json(
      { success: true, data: completeQuotation },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in POST /api/quotations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
