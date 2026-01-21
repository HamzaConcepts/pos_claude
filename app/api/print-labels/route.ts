import { NextRequest, NextResponse } from 'next/server'
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

/**
 * API Route: Generate and return label data for printing
 * 
 * This endpoint fetches product and IMEI data, then returns structured label data
 * that will be used by the client to generate barcodes and PDF.
 * 
 * The actual PDF generation happens on the client side because:
 * 1. jsbarcode requires a canvas/DOM environment
 * 2. Client-side generation is faster and reduces server load
 * 3. Browser has better support for generating and opening PDFs
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      product_id, 
      store_id, 
      label_title, 
      show_price, 
      quantity, 
      is_phone 
    } = body

    // Validate required fields
    if (!product_id || !store_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: product_id, store_id' },
        { status: 400 }
      )
    }

    // Fetch product details
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        aggregated_stock (
          aggregated_selling_price,
          aggregated_cost_price
        )
      `)
      .eq('id', product_id)
      .eq('store_id', store_id)
      .single()

    if (productError || !product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    let labelData = []

    if (is_phone) {
      // Fetch IMEIs for phone products
      const { data: imeis, error: imeiError } = await supabaseAdmin
        .from('product_imeis')
        .select('imei_number')
        .eq('product_id', product_id)
        .eq('store_id', store_id)
        .eq('status', 'in_stock')

      if (imeiError || !imeis || imeis.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No IMEIs available for this product' },
          { status: 400 }
        )
      }

      // Create one label per IMEI
      labelData = imeis.map((imei) => ({
        title: label_title,
        price: show_price ? product.aggregated_stock?.[0]?.aggregated_selling_price || 0 : null,
        barcode: imei.imei_number,
        barcodeText: imei.imei_number,
      }))
    } else {
      // Create multiple identical labels for non-phone products
      const barcodeValue = product.barcode || product.sku
      const price = show_price ? product.aggregated_stock?.[0]?.aggregated_selling_price || 0 : null

      for (let i = 0; i < quantity; i++) {
        labelData.push({
          title: label_title,
          price,
          barcode: barcodeValue,
          barcodeText: barcodeValue,
        })
      }
    }

    // Return label data for client-side PDF generation
    return NextResponse.json({
      success: true,
      labels: labelData,
      labelCount: labelData.length,
    })

  } catch (error) {
    console.error('Error generating label data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate label data' },
      { status: 500 }
    )
  }
}
