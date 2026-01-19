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

// Helper: Generate next unique barcode for a store
async function generateNextBarcode(storeId: number): Promise<string> {
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    // Generate barcode: BC + timestamp (last 6 digits) + random 4 digits
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.floor(1000 + Math.random() * 9000) // 4-digit random
    const barcode = `BC${timestamp}${random}`

    // Check if barcode already exists
    const { data: existing } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('barcode', barcode)
      .eq('store_id', storeId)
      .maybeSingle()

    if (!existing) {
      return barcode
    }

    attempts++
  }

  // Fallback: use UUID-like format
  return `BC${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`
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
    const barcode = searchParams.get('barcode')

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // If barcode is provided, search specifically by barcode or IMEI
    if (barcode) {
      // First try to find by regular barcode
      const { data: productByBarcode, error: barcodeError } = await supabaseAdmin
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
        .eq('is_active', true)
        .eq('barcode', barcode)
        .maybeSingle()

      if (barcodeError) {
        console.error('Error searching by barcode:', barcodeError)
      }

      if (productByBarcode) {
        const aggStock = productByBarcode.aggregated_stock?.[0] || null
        const transformedProduct = {
          id: productByBarcode.id,
          sku: productByBarcode.sku,
          name: productByBarcode.name,
          description: productByBarcode.description,
          category: productByBarcode.category,
          store_id: productByBarcode.store_id,
          category_id: productByBarcode.category_id,
          subcategory_id: productByBarcode.subcategory_id,
          category_name: productByBarcode.categories?.name || null,
          subcategory_name: productByBarcode.subcategories?.name || null,
          is_active: productByBarcode.is_active,
          is_phone: productByBarcode.is_phone || false,
          stock_quantity: aggStock?.total_quantity_remaining || 0,
          low_stock_threshold: aggStock?.low_stock_threshold || 10,
          created_at: productByBarcode.created_at,
          updated_at: productByBarcode.updated_at,
          batches: productByBarcode.stock_batches || [],
          aggregated_stock: aggStock,
          imei_match: false
        }
        return NextResponse.json({
          success: true,
          data: [transformedProduct]
        })
      }

      // If not found by barcode, try to find by IMEI
      const { data: imeiProduct, error: imeiError } = await supabaseAdmin
        .from('product_imeis')
        .select(`
          imei_number,
          status,
          product_id,
          products (
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
          )
        `)
        .eq('imei_number', barcode)
        .eq('status', 'in_stock')
        .maybeSingle()

      if (imeiError) {
        console.error('Error searching by IMEI:', imeiError)
      }

      if (imeiProduct && imeiProduct.products) {
        // Handle products as it might be typed as an array by Supabase
        const product = Array.isArray(imeiProduct.products) ? imeiProduct.products[0] : imeiProduct.products
        
        // Check if the product belongs to the correct store
        if (product && product.store_id === parseInt(storeId)) {
          const aggStock = product.aggregated_stock?.[0] || null
          const transformedProduct = {
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
            stock_quantity: aggStock?.total_quantity_remaining || 0,
            low_stock_threshold: aggStock?.low_stock_threshold || 10,
            created_at: product.created_at,
            updated_at: product.updated_at,
            batches: product.stock_batches || [],
            aggregated_stock: aggStock,
            imei_match: true,
            matched_imei: barcode
          }
          return NextResponse.json({
            success: true,
            data: [transformedProduct]
          })
        }
      }

      // Not found by barcode or IMEI
      return NextResponse.json({
        success: true,
        data: []
      })
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
      is_phone,
      low_stock_threshold,
      barcode
    } = body

    // Validation
    if (!name || !store_id) {
      return NextResponse.json(
        { success: false, error: 'Name and Store ID are required' },
        { status: 400 }
      )
    }

    // Check if barcode already exists (if provided)
    if (barcode) {
      const { data: existingProduct, error: barcodeCheckError } = await supabaseAdmin
        .from('products')
        .select('id, name')
        .eq('barcode', barcode)
        .eq('store_id', parseInt(store_id))
        .maybeSingle()

      if (barcodeCheckError) {
        console.error('Error checking barcode:', barcodeCheckError)
      }

      if (existingProduct) {
        return NextResponse.json(
          { success: false, error: `Barcode already exists for product: ${existingProduct.name}` },
          { status: 400 }
        )
      }
    }

    // Check if category requires IMEI
    let finalIsPhone = is_phone || false
    if (category_id) {
      const { data: categoryData } = await supabaseAdmin
        .from('categories')
        .select('requires_imei')
        .eq('id', category_id)
        .single()

      if (categoryData?.requires_imei) {
        finalIsPhone = true
      }
    }

    // Generate SKU
    const generatedSKU = await generateNextSKU(parseInt(store_id))

    // Generate barcode if not provided (for non-phone products)
    let finalBarcode = barcode
    if (!finalBarcode && !finalIsPhone) {
      finalBarcode = await generateNextBarcode(parseInt(store_id))
    }

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
        is_phone: finalIsPhone,
        barcode: finalBarcode || null
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
        low_stock_threshold: low_stock_threshold ? parseInt(low_stock_threshold as string) : 10
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
