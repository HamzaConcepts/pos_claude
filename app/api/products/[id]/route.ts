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
        inventory (*)
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

    // Transform data
    const totalStock = product.inventory?.reduce(
      (sum: number, inv: any) => sum + (inv.quantity_remaining || 0),
      0
    ) || 0
    
    const latestInventory = product.inventory?.[0] || null

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        price: latestInventory?.selling_price || 0,
        cost_price: latestInventory?.cost_price || 0,
        stock_quantity: totalStock,
        low_stock_threshold: latestInventory?.low_stock_threshold || 10,
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
    const {
      name,
      sku,
      description,
      price,
      cost_price,
      stock_quantity,
      low_stock_threshold,
      category,
    } = body

    // Validation
    if (price !== undefined && price < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Price must be positive',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // Update product info
    const productUpdateData: any = {}
    if (name !== undefined) productUpdateData.name = name
    if (sku !== undefined) productUpdateData.sku = sku
    if (description !== undefined) productUpdateData.description = description
    if (category !== undefined) productUpdateData.category = category

    if (Object.keys(productUpdateData).length > 0) {
      const { error: productError } = await supabaseAdmin
        .from('products')
        .update(productUpdateData)
        .eq('id', params.id)

      if (productError) {
        if (productError.code === '23505') {
          return NextResponse.json(
            {
              success: false,
              error: 'SKU already exists',
              code: 'DUPLICATE_SKU',
            },
            { status: 400 }
          )
        }
        throw productError
      }
    }

    // Update latest inventory if price/stock changes
    if (price !== undefined || cost_price !== undefined || low_stock_threshold !== undefined || stock_quantity !== undefined) {
      // Get latest inventory
      const { data: inventories } = await supabaseAdmin
        .from('inventory')
        .select('*')
        .eq('product_id', params.id)
        .order('restock_date', { ascending: false })
        .limit(1)

      if (inventories && inventories.length > 0) {
        const latestInventory = inventories[0]
        const inventoryUpdateData: any = {}
        
        if (price !== undefined) inventoryUpdateData.selling_price = price
        if (cost_price !== undefined) inventoryUpdateData.cost_price = cost_price
        if (low_stock_threshold !== undefined) inventoryUpdateData.low_stock_threshold = low_stock_threshold
        if (stock_quantity !== undefined) {
          inventoryUpdateData.quantity_remaining = stock_quantity
          inventoryUpdateData.quantity_added = latestInventory.quantity_added + (stock_quantity - latestInventory.quantity_remaining)
        }

        const { error: inventoryError } = await supabaseAdmin
          .from('inventory')
          .update(inventoryUpdateData)
          .eq('id', latestInventory.id)

        if (inventoryError) throw inventoryError
      }
    }

    // Fetch updated product
    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        inventory (*)
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error

    const totalStock = data.inventory?.reduce(
      (sum: number, inv: any) => sum + (inv.quantity_remaining || 0),
      0
    ) || 0
    
    const latestInventory = data.inventory?.[0] || null

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        price: latestInventory?.selling_price || 0,
        cost_price: latestInventory?.cost_price || 0,
        stock_quantity: totalStock,
        low_stock_threshold: latestInventory?.low_stock_threshold || 10,
      },
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
