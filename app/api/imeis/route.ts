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
      persistSession: false
    }
  }
)

// GET - Fetch IMEIs for a product
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('product_id')
    const storeId = searchParams.get('store_id')
    const status = searchParams.get('status') // in_stock, sold, returned, defective
    const imei = searchParams.get('imei') // Search by specific IMEI

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('product_imeis')
      .select(`
        *,
        products (id, name, sku),
        sales (id, sale_number)
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })

    if (productId) {
      query = query.eq('product_id', productId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (imei) {
      query = query.eq('imei_number', imei)
    }

    const { data: imeis, error } = await query

    if (error) {
      console.error('Error fetching IMEIs:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: imeis || []
    })
  } catch (error: any) {
    console.error('Error in GET /api/imeis:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Add IMEI(s) to a product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      product_id,
      store_id,
      batch_id,
      imei_numbers // Array of IMEI numbers
    } = body

    // Validation
    if (!product_id || !store_id || !imei_numbers || !Array.isArray(imei_numbers)) {
      return NextResponse.json(
        { success: false, error: 'Product ID, Store ID, and IMEI numbers array are required' },
        { status: 400 }
      )
    }

    if (imei_numbers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one IMEI number is required' },
        { status: 400 }
      )
    }

    // Check for duplicates in the request
    const uniqueImeis = [...new Set(imei_numbers.map(i => i.trim()))]
    if (uniqueImeis.length !== imei_numbers.length) {
      return NextResponse.json(
        { success: false, error: 'Duplicate IMEI numbers in request' },
        { status: 400 }
      )
    }

    // Check if any IMEI already exists in the store
    const { data: existingImeis } = await supabaseAdmin
      .from('product_imeis')
      .select('imei_number')
      .eq('store_id', store_id)
      .in('imei_number', uniqueImeis)

    if (existingImeis && existingImeis.length > 0) {
      const duplicates = existingImeis.map(i => i.imei_number).join(', ')
      return NextResponse.json(
        { success: false, error: `IMEI numbers already exist: ${duplicates}` },
        { status: 409 }
      )
    }

    // Prepare bulk insert
    const imeiRecords = uniqueImeis.map(imei => ({
      product_id,
      store_id,
      batch_id: batch_id || null,
      imei_number: imei,
      status: 'in_stock'
    }))

    // Insert all IMEIs
    const { data: insertedImeis, error } = await supabaseAdmin
      .from('product_imeis')
      .insert(imeiRecords)
      .select()

    if (error) {
      console.error('Error inserting IMEIs:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: insertedImeis,
      message: `${insertedImeis.length} IMEI(s) added successfully`
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/imeis:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PUT - Update IMEI status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      store_id,
      status,
      sale_id
    } = body

    if (!id || !store_id || !status) {
      return NextResponse.json(
        { success: false, error: 'IMEI ID, Store ID, and status are required' },
        { status: 400 }
      )
    }

    const validStatuses = ['in_stock', 'sold', 'returned', 'defective']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    if (status === 'sold') {
      updateData.sold_at = new Date().toISOString()
      if (sale_id) {
        updateData.sale_id = sale_id
      }
    } else if (status === 'in_stock') {
      updateData.sold_at = null
      updateData.sale_id = null
    }

    const { data: imei, error } = await supabaseAdmin
      .from('product_imeis')
      .update(updateData)
      .eq('id', id)
      .eq('store_id', store_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating IMEI:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: imei
    })
  } catch (error: any) {
    console.error('Error in PUT /api/imeis:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Delete IMEI
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const storeId = searchParams.get('store_id')

    if (!id || !storeId) {
      return NextResponse.json(
        { success: false, error: 'IMEI ID and Store ID are required' },
        { status: 400 }
      )
    }

    // Only allow deletion if IMEI is not sold
    const { data: imei } = await supabaseAdmin
      .from('product_imeis')
      .select('status')
      .eq('id', id)
      .eq('store_id', storeId)
      .single()

    if (imei?.status === 'sold') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete a sold IMEI' },
        { status: 403 }
      )
    }

    const { error } = await supabaseAdmin
      .from('product_imeis')
      .delete()
      .eq('id', id)
      .eq('store_id', storeId)

    if (error) {
      console.error('Error deleting IMEI:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'IMEI deleted successfully'
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/imeis:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
