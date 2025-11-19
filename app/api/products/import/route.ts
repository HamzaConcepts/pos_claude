import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface ImportProduct {
  sku: string
  name: string
  description: string | null
  category: string | null
  price: number
  cost_price: number
  stock_quantity: number
  low_stock_threshold: number
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { products } = await request.json() as { products: ImportProduct[] }

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

    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    for (const product of products) {
      try {
        // Validate required fields
        if (!product.sku || !product.name || product.price === undefined || product.cost_price === undefined) {
          errors.push(`Skipped product: ${product.sku || 'unknown'} - missing required fields`)
          failCount++
          continue
        }

        // Validate numeric values
        if (isNaN(product.price) || isNaN(product.cost_price) || product.price < 0 || product.cost_price < 0) {
          errors.push(`Skipped product: ${product.sku} - invalid price values`)
          failCount++
          continue
        }

        // Check if product with SKU already exists
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('sku', product.sku)
          .single()

        if (existing) {
          errors.push(`Skipped product: ${product.sku} - SKU already exists`)
          failCount++
          continue
        }

        // Insert product
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert([
            {
              sku: product.sku,
              name: product.name,
              description: product.description,
              category: product.category,
              is_active: true,
            },
          ])
          .select()
          .single()

        if (productError) throw productError

        // Insert initial inventory if stock_quantity > 0
        if (product.stock_quantity > 0) {
          const { error: inventoryError } = await supabase
            .from('inventory')
            .insert([
              {
                product_id: newProduct.id,
                cost_price: product.cost_price,
                selling_price: product.price,
                quantity_added: product.stock_quantity,
                quantity_remaining: product.stock_quantity,
                low_stock_threshold: product.low_stock_threshold || 10,
                batch_number: `IMPORT-${Date.now()}`,
                restock_date: new Date().toISOString(),
                notes: 'Imported from CSV',
              },
            ])

          if (inventoryError) throw inventoryError
        }

        successCount++
      } catch (err: any) {
        errors.push(`Error importing ${product.sku}: ${err.message}`)
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
