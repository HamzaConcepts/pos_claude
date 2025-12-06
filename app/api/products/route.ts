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

// Helper: Generate next SKU for a store
async function generateNextSKU(storeId: number): Promise<string> {
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('store_name')
    .eq('id', storeId)
    .single()

  if (!store) throw new Error('Store not found')

  const { data: lastProduct } = await supabaseAdmin
    .from('products')
    .select('sku')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const prefix = store.store_name
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .substring(0, 3)
    .padEnd(3, 'X')

  let nextNumber = 1
  if (lastProduct?.sku) {
    const lastNumber = parseInt(lastProduct.sku.split('-')[1] || '0')
    nextNumber = lastNumber + 1
  }

  return `${prefix}-${nextNumber.toString().padStart(4, '0')}`
}

// GET - Fetch products with inventory and pricing
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const lowStock = searchParams.get('low_stock') === 'true'
    const includeInactive = searchParams.get('include_inactive') === 'true'

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Build query - join with aggregated_stock instead of calculating manually
    let query = supabaseAdmin
      .from('products')
      .select(`
        *,
        categories (id, name),
        subcategories (id, name),
        aggregated_stock (
          aggregated_cost_price,
          aggregated_selling_price,
          aggregated_lowest_negotiable,
          total_quantity_purchased,
          total_quantity_remaining,
          total_quantity_sold,
          low_stock_threshold
        ),
        stock_batches (
          id,
          batch_number,
          cost_price,
          selling_price,
          lowest_negotiable_price,
          quantity_remaining,
          quantity_purchased,
          purchase_date,
          is_depleted
        )
      `)
      .eq('store_id', parseInt(storeId))
      .order('created_at', { ascending: false })

    // Filter active products unless include_inactive is true
    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    // Search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
    }

    // Category filter
    if (category) {
      query = query.eq('category', category)
    }

    const { data: products, error } = await query

    if (error) {
      console.error('Error fetching products:', error)
      throw error
    }

    // Transform data to match expected structure
    const transformedProducts = products?.map((product: any) => {
      // Get aggregated stock data
      const aggStock = product.aggregated_stock?.[0] || null
      
      // Get all batches for history (including depleted)
      const allBatches = product.stock_batches || []

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        category: product.category,
        store_id: product.store_id,
        category_id: product.category_id,
        subcategory_id: product.subcategory_id,
        category_name: product.categories?.name || null,
        subcategory_name: product.subcategories?.name || null,
        is_active: product.is_active,
        is_phone: product.is_phone || false,
        
        // Stock information from aggregated_stock
        stock_quantity: aggStock?.total_quantity_remaining || 0,
        low_stock_threshold: aggStock?.low_stock_threshold || 10,
        
        // Timestamps
        created_at: product.created_at,
        updated_at: product.updated_at,
        
        // Include all batches for complete restock history
        batches: allBatches,
        aggregated_stock: aggStock
      }
    }) || []

    // Apply low stock filter if requested
    let filteredProducts = transformedProducts
    if (lowStock) {
      filteredProducts = filteredProducts.filter(
        (p: any) => p.stock_quantity <= (p.low_stock_threshold || 10)
      )
    }

    return NextResponse.json({
      success: true,
      data: filteredProducts,
    })
  } catch (error: any) {
    console.error('GET /api/products error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch products',
      },
      { status: 500 }
    )
  }
}

// POST - Create new product
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      description,
      category,
      category_id,
      subcategory_id,
      store_id,
      is_phone
    } = body

    // Validation
    if (!name || !store_id) {
      return NextResponse.json(
        { success: false, error: 'Name and Store ID are required' },
        { status: 400 }
      )
    }

    // Generate SKU
    const generatedSKU = await generateNextSKU(parseInt(store_id))

    // Insert product (without price columns - they're in aggregated_stock)
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .insert({
        name,
        sku: generatedSKU,
        description,
        category,
        category_id: category_id || null,
        subcategory_id: subcategory_id || null,
        store_id: parseInt(store_id),
        is_active: true,
        is_phone: is_phone || false
      })
      .select()
      .single()

    if (productError) {
      console.error('Error creating product:', productError)
      if (productError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'SKU already exists' },
          { status: 400 }
        )
      }
      throw productError
    }

    // Create initial aggregated_stock record
    // This will be automatically updated by triggers when batches are added
    const { error: aggStockError } = await supabaseAdmin
      .from('aggregated_stock')
      .insert({
        product_id: product.id,
        store_id: parseInt(store_id),
        aggregated_cost_price: 0,
        aggregated_selling_price: 0,
        aggregated_lowest_negotiable: 0,
        total_quantity_purchased: 0,
        total_quantity_remaining: 0,
        total_quantity_sold: 0,
        low_stock_threshold: 10
      })

    if (aggStockError) {
      console.error('Error creating aggregated_stock:', aggStockError)
      // Continue anyway - trigger might create it
    }

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product created successfully',
    })
  } catch (error: any) {
    console.error('POST /api/products error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create product',
      },
      { status: 500 }
    )
  }
}
