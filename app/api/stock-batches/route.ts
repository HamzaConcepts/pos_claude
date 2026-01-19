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

// GET - Fetch stock batches for a product or store
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('product_id')
    const storeId = searchParams.get('store_id')
    const includeDepleted = searchParams.get('include_depleted') === 'true'

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Build query
    let query = supabaseAdmin
      .from('stock_batches')
      .select(`
        *,
        products (id, name, sku),
        suppliers (id, supplier_name, phone_number)
      `)
      .eq('store_id', parseInt(storeId))
      .order('purchase_date', { ascending: false })

    // Filter by product if specified
    if (productId) {
      query = query.eq('product_id', parseInt(productId))
    }

    // Exclude depleted batches unless requested
    if (!includeDepleted) {
      query = query.eq('is_depleted', false).gt('quantity_remaining', 0)
    }

    const { data: batches, error } = await query

    if (error) {
      console.error('Error fetching batches:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: batches || []
    })
  } catch (error: any) {
    console.error('GET /api/stock-batches error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Create new stock batch (restock)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      product_id,
      store_id,
      supplier_id,
      cost_price,
      quantity_purchased,
      selling_price,
      lowest_negotiable_price,
      is_initial_stock = false, // Default to false (regular restock = expense)
      amount_paid = 0, // Payment made to supplier
      supplier_name = '',
      supplier_phone = '',
      payment_method = 'Cash', // Payment method: Cash or Digital
    } = body

    // Validation
    if (!product_id || !store_id || cost_price === undefined || !quantity_purchased) {
      return NextResponse.json(
        { success: false, error: 'Product ID, Store ID, cost price, and quantity are required' },
        { status: 400 }
      )
    }

    if (quantity_purchased <= 0) {
      return NextResponse.json(
        { success: false, error: 'Quantity must be greater than 0' },
        { status: 400 }
      )
    }

    if (cost_price < 0) {
      return NextResponse.json(
        { success: false, error: 'Cost price must be positive' },
        { status: 400 }
      )
    }

    // Generate batch number
    const { data: batchNumber, error: batchError } = await supabaseAdmin
      .rpc('generate_batch_number', {
        p_store_id: store_id,
        p_product_id: product_id
      })

    if (batchError) {
      console.error('Error generating batch number:', batchError)
      throw batchError
    }

    // Create stock batch
    const { data: batch, error } = await supabaseAdmin
      .from('stock_batches')
      .insert({
        product_id,
        store_id,
        supplier_id: supplier_id || null,
        batch_number: batchNumber,
        cost_price,
        selling_price: selling_price || cost_price * 1.2, // Default 20% markup if not provided
        lowest_negotiable_price: lowest_negotiable_price || selling_price || cost_price * 1.1,
        quantity_purchased,
        quantity_remaining: quantity_purchased,
        is_depleted: false,
        is_initial_stock, // Mark as initial stock (won't create expense via trigger)
        purchase_date: new Date().toISOString(),
        payment_method, // Store payment method
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating batch:', error)
      throw error
    }

    // Handle supplier payment tracking
    const totalAmount = cost_price * quantity_purchased
    const paidAmount = parseFloat(amount_paid.toString()) || 0
    const remaining = totalAmount - paidAmount

    // If payment is partial, create supplier_khaata record
    if (remaining > 0 && supplier_id) {
      const { error: khaataError } = await supabaseAdmin
        .from('supplier_khaata')
        .insert({
          stock_batch_id: batch.id,
          supplier_id: supplier_id,
          supplier_name: supplier_name,
          supplier_phone: supplier_phone,
          total_amount: totalAmount,
          amount_paid: paidAmount,
          amount_remaining: remaining,
          store_id: store_id,
        })

      if (khaataError) {
        console.error('Error creating supplier khaata record:', khaataError)
        // Don't fail the whole operation, just log the error
      }
    }

    // Fetch updated aggregated_stock (calculated by trigger)
    const { data: updatedAggStock } = await supabaseAdmin
      .from('aggregated_stock')
      .select('*')
      .eq('product_id', product_id)
      .single()

    return NextResponse.json({
      success: true,
      data: {
        batch,
        aggregated_stock: updatedAggStock
      },
      message: 'Stock batch created successfully'
    }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/stock-batches error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PATCH - Update stock batch (e.g., adjust quantity, mark as depleted)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { batch_id, quantity_remaining, is_depleted } = body

    if (!batch_id) {
      return NextResponse.json(
        { success: false, error: 'Batch ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (quantity_remaining !== undefined) {
      updateData.quantity_remaining = quantity_remaining
      updateData.is_depleted = quantity_remaining <= 0
      if (quantity_remaining <= 0) {
        updateData.depleted_at = new Date().toISOString()
      }
    }
    if (is_depleted !== undefined) {
      updateData.is_depleted = is_depleted
      if (is_depleted) {
        updateData.depleted_at = new Date().toISOString()
      }
    }

    const { data: batch, error } = await supabaseAdmin
      .from('stock_batches')
      .update(updateData)
      .eq('id', batch_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating batch:', error)
      throw error
    }

    // Fetch updated product average price
    const { data: updatedProduct } = await supabaseAdmin
      .from('products')
      .select('average_price')
      .eq('id', batch.product_id)
      .single()

    return NextResponse.json({
      success: true,
      data: {
        batch,
        average_price: updatedProduct?.average_price
      }
    })
  } catch (error: any) {
    console.error('PATCH /api/stock-batches error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Delete a stock batch
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batch_id')

    if (!batchId) {
      return NextResponse.json(
        { success: false, error: 'Batch ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('stock_batches')
      .delete()
      .eq('id', parseInt(batchId))

    if (error) {
      console.error('Error deleting batch:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Stock batch deleted successfully'
    })
  } catch (error: any) {
    console.error('DELETE /api/stock-batches error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
