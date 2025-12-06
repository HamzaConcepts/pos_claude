import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        categories (id, name),
        subcategories (id, name),
        aggregated_stock (
          aggregated_cost_price,
          aggregated_selling_price,
          aggregated_lowest_negotiable,
          total_quantity_remaining,
          low_stock_threshold
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      )
    }

    // Get aggregated stock data
    const aggStock = product.aggregated_stock?.[0] || null

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        category_id: product.category_id,
        subcategory_id: product.subcategory_id,
        category_name: product.categories?.name || null,
        subcategory_name: product.subcategories?.name || null,
        stock_quantity: aggStock?.total_quantity_remaining || 0,
        low_stock_threshold: aggStock?.low_stock_threshold || 10,
        aggregated_stock: aggStock
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch product',
        code: 'FETCH_PRODUCT_ERROR',
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, description, low_stock_threshold } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product name is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (low_stock_threshold !== undefined && (low_stock_threshold < 0 || isNaN(low_stock_threshold))) {
      return NextResponse.json(
        {
          success: false,
          error: 'Low stock threshold must be a positive number',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // Update product name and description
    const { error: productError } = await supabaseAdmin
      .from('products')
      .update({
        name: name.trim(),
        description: description || null,
      })
      .eq('id', params.id)

    if (productError) throw productError

    // Update low_stock_threshold in aggregated_stock table
    if (low_stock_threshold !== undefined) {
      const { error: aggStockError } = await supabaseAdmin
        .from('aggregated_stock')
        .update({ low_stock_threshold })
        .eq('product_id', params.id)

      if (aggStockError) throw aggStockError
    }

    // Fetch updated product with aggregated_stock
    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        categories (id, name),
        subcategories (id, name),
        aggregated_stock (
          aggregated_cost_price,
          aggregated_selling_price,
          aggregated_lowest_negotiable,
          total_quantity_remaining,
          low_stock_threshold
        ),
        stock_batches (
          id,
          cost_price,
          selling_price,
          lowest_negotiable_price,
          quantity_remaining,
          is_depleted
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Product updated successfully',
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update product',
        code: 'UPDATE_PRODUCT_ERROR',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Soft delete - set is_active to false
    const { error } = await supabaseAdmin
      .from('products')
      .update({ is_active: false })
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Product deactivated successfully',
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete product',
        code: 'DELETE_PRODUCT_ERROR',
      },
      { status: 500 }
    )
  }
}
