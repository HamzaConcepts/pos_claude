import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    // Create Supabase client with service role to bypass RLS for now
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const lowStock = searchParams.get('low_stock') === 'true'

    let query = supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
    }

    // Apply category filter
    if (category) {
      query = query.eq('category', category)
    }

    const { data: products, error } = await query

    if (error) throw error

    // Filter low stock items if requested
    let filteredProducts = products || []
    if (lowStock) {
      filteredProducts = filteredProducts.filter(
        (p) => p.stock_quantity <= p.low_stock_threshold
      )
    }

    return NextResponse.json({
      success: true,
      data: filteredProducts,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch products',
        code: 'FETCH_PRODUCTS_ERROR',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

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
    if (!name || !sku || price === undefined || cost_price === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (price < 0 || cost_price < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Prices must be positive numbers',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (stock_quantity < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stock quantity must be positive',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('products')
      .insert([
        {
          name,
          sku,
          description,
          price,
          cost_price,
          stock_quantity: stock_quantity || 0,
          low_stock_threshold: low_stock_threshold || 10,
          category,
        },
      ])
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
      message: 'Product created successfully',
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create product',
        code: 'CREATE_PRODUCT_ERROR',
      },
      { status: 500 }
    )
  }
}
