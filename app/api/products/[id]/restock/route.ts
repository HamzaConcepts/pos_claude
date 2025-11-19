import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client to bypass RLS
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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id)
    const body = await request.json()
    const {
      cost_price,
      selling_price,
      quantity_added,
      low_stock_threshold,
      batch_number,
      notes,
    } = body

    // Validation
    if (!quantity_added || quantity_added <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Quantity must be greater than 0',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // Check if product exists and get store_id
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('*, store_id')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      )
    }

    // If product is inactive, reactivate it
    if (!product.is_active) {
      await supabaseAdmin
        .from('products')
        .update({ is_active: true })
        .eq('id', productId)
    }

    // Create new inventory entry with store_id
    const { data: inventory, error: inventoryError } = await supabaseAdmin
      .from('inventory')
      .insert({
        product_id: productId,
        store_id: product.store_id,
        cost_price: cost_price,
        selling_price: selling_price,
        quantity_added: quantity_added,
        quantity_remaining: quantity_added,
        low_stock_threshold: low_stock_threshold || 10,
        batch_number: batch_number || `BATCH-${Date.now()}`,
        restock_date: new Date().toISOString(),
        notes: notes || null,
      })
      .select()
      .single()

    if (inventoryError) {
      console.error('Inventory insert error:', inventoryError)
      throw inventoryError
    }

    console.log('Successfully created inventory record:', inventory.id)

    return NextResponse.json({
      success: true,
      data: inventory,
      message: `Successfully restocked ${quantity_added} units`,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to restock product',
        code: 'RESTOCK_ERROR',
      },
      { status: 500 }
    )
  }
}
