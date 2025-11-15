import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) throw error

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
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

    if (cost_price !== undefined && cost_price < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cost price must be positive',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (stock_quantity !== undefined && stock_quantity < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stock quantity must be positive',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (sku !== undefined) updateData.sku = sku
    if (description !== undefined) updateData.description = description
    if (price !== undefined) updateData.price = price
    if (cost_price !== undefined) updateData.cost_price = cost_price
    if (stock_quantity !== undefined) updateData.stock_quantity = stock_quantity
    if (low_stock_threshold !== undefined) updateData.low_stock_threshold = low_stock_threshold
    if (category !== undefined) updateData.category = category

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            error: 'SKU already exists',
            code: 'DUPLICATE_SKU',
          },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data,
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
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
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
