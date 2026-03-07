import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

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
      lowest_negotiable_price,
      quantity_purchased,
      supplier_id,
    } = body

    // Validation
    if (!quantity_purchased || quantity_purchased <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Quantity must be greater than 0',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (cost_price === undefined || selling_price === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cost price and selling price are required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // Check if product exists and get store_id
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, store_id, is_active')
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

    // Generate batch number
    const { data: batchNumber, error: batchError } = await supabaseAdmin
      .rpc('generate_batch_number', {
        p_store_id: product.store_id,
        p_product_id: productId
      })

    if (batchError) {
      console.error('Error generating batch number:', batchError)
      throw batchError
    }

    // Create stock batch - trigger will automatically update aggregated_stock
    const { data: batch, error: batchInsertError } = await supabaseAdmin
      .from('stock_batches')
      .insert({
        product_id: productId,
        store_id: product.store_id,
        supplier_id: supplier_id || null,
        batch_number: batchNumber,
        cost_price,
        selling_price,
        lowest_negotiable_price: lowest_negotiable_price || selling_price,
        quantity_purchased,
        quantity_remaining: quantity_purchased,
        is_depleted: false,
        purchase_date: new Date().toISOString()
      })
      .select()
      .single()

    if (batchInsertError) {
      throw batchInsertError
    }

    return NextResponse.json({
      success: true,
      data: batch,
      message: `Successfully restocked ${quantity_purchased} units`,
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
