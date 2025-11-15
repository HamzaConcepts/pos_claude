import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const lowStock = searchParams.get('low_stock') === 'true'

    // Fetch products with their inventory
    let query = supabase
      .from('products')
      .select(`
        *,
        inventory (
          id,
          cost_price,
          selling_price,
          quantity_remaining,
          low_stock_threshold,
          batch_number,
          restock_date
        )
      `)
      .eq('is_active', true)
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

    // Transform data to include aggregated stock info
    const transformedProducts = products?.map((product: any) => {
      const totalStock = product.inventory?.reduce(
        (sum: number, inv: any) => sum + (inv.quantity_remaining || 0),
        0
      ) || 0
      
      const latestInventory = product.inventory?.[0] || null
      
      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        category: product.category,
        is_active: product.is_active,
        price: latestInventory?.selling_price || 0,
        cost_price: latestInventory?.cost_price || 0,
        stock_quantity: totalStock,
        low_stock_threshold: latestInventory?.low_stock_threshold || 10,
        created_at: product.created_at,
        updated_at: product.updated_at,
        inventory: product.inventory
      }
    }) || []

    // Filter low stock items if requested
    let filteredProducts = transformedProducts
    if (lowStock) {
      filteredProducts = filteredProducts.filter(
        (p: any) => p.stock_quantity <= p.low_stock_threshold
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

    // Insert product first
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert([
        {
          name,
          sku,
          description,
          category,
          is_active: true,
        },
      ])
      .select()
      .single()

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

    // Insert initial inventory
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .insert([
        {
          product_id: product.id,
          cost_price,
          selling_price: price,
          quantity_added: stock_quantity || 0,
          quantity_remaining: stock_quantity || 0,
          low_stock_threshold: low_stock_threshold || 10,
          batch_number: `BATCH-${Date.now()}`,
        },
      ])
      .select()
      .single()

    if (inventoryError) throw inventoryError

    return NextResponse.json({
      success: true,
      data: {
        ...product,
        inventory: [inventory],
        price,
        cost_price,
        stock_quantity: stock_quantity || 0,
        low_stock_threshold: low_stock_threshold || 10,
      },
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
