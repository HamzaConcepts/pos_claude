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

interface ImportProduct {
  name: string
  description: string | null
  category: string | null
  price: number
  cost_price: number
  stock_quantity: number
  low_stock_threshold: number
}

// Helper function to generate next SKU
async function generateNextSKU(storeId: number): Promise<string> {
  // Get store code (first 3 letters of store name)
  const { data: store } = await supabaseAdmin
    .from('stores')
    .select('store_name')
    .eq('id', storeId)
    .single()
  
  const storeCode = store?.store_name
    ? store.store_name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')
    : 'XXX'
  
  // Ensure exactly 3 characters
  const paddedCode = (storeCode + 'XXX').substring(0, 3)
  
  // Get latest SKU for this store
  const { data: latestProduct } = await supabaseAdmin
    .from('products')
    .select('sku')
    .eq('store_id', storeId)
    .like('sku', `${paddedCode}-%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  let nextNumber = 1
  if (latestProduct?.sku) {
    const match = latestProduct.sku.match(/-(\d+)$/)
    if (match) {
      nextNumber = parseInt(match[1]) + 1
    }
  }
  
  // Format as XXX-0000
  const formattedNumber = nextNumber.toString().padStart(4, '0')
  return `${paddedCode}-${formattedNumber}`
}

export async function POST(request: Request) {
  try {
    const { products, store_id } = await request.json() as { products: ImportProduct[], store_id: number }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No products provided',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (!store_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Store ID is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    for (const product of products) {
      try {
        // Validate required fields
        if (!product.name || product.price === undefined || product.cost_price === undefined) {
          errors.push(`Skipped product: ${product.name || 'unknown'} - missing required fields`)
          failCount++
          continue
        }

        // Validate numeric values
        if (isNaN(product.price) || isNaN(product.cost_price) || product.price < 0 || product.cost_price < 0) {
          errors.push(`Skipped product: ${product.name} - invalid price values`)
          failCount++
          continue
        }

        // Generate unique SKU
        const sku = await generateNextSKU(store_id)

        // Insert product
        const { data: newProduct, error: productError } = await supabaseAdmin
          .from('products')
          .insert([
            {
              sku: sku,
              name: product.name,
              description: product.description,
              category: product.category,
              store_id: store_id,
              is_active: true,
            },
          ])
          .select()
          .single()

        if (productError) {
          console.error('Product insert error:', productError)
          throw productError
        }

        // Create aggregated_stock record
        await supabaseAdmin
          .from('aggregated_stock')
          .insert({
            product_id: newProduct.id,
            store_id: store_id,
            aggregated_cost_price: 0,
            aggregated_selling_price: 0,
            aggregated_lowest_negotiable: 0,
            total_quantity_purchased: 0,
            total_quantity_remaining: 0,
            total_quantity_sold: 0,
            low_stock_threshold: product.low_stock_threshold || 10
          })

        // Insert initial stock batch if stock_quantity > 0
        if (product.stock_quantity > 0) {
          const { data: batchNumber } = await supabaseAdmin
            .rpc('generate_batch_number', {
              p_store_id: store_id,
              p_product_id: newProduct.id
            })

          const { error: batchError } = await supabaseAdmin
            .from('stock_batches')
            .insert({
              product_id: newProduct.id,
              store_id: store_id,
              batch_number: batchNumber || `IMPORT-${Date.now()}`,
              cost_price: product.cost_price,
              selling_price: product.price,
              lowest_negotiable_price: product.price * 0.9, // Default 90% of selling price
              quantity_purchased: product.stock_quantity,
              quantity_remaining: product.stock_quantity,
              is_depleted: false,
              purchase_date: new Date().toISOString()
            })

          if (batchError) {
            console.error('Stock batch insert error:', batchError)
            throw batchError
          }
        }

        successCount++
      } catch (err: any) {
        errors.push(`Error importing ${product.name}: ${err.message}`)
        failCount++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        count: successCount,
        failed: failCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    })
  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to import products',
        code: 'IMPORT_ERROR',
      },
      { status: 500 }
    )
  }
}
