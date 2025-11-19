import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Get store code (first 3 letters of store name)
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('store_name')
      .eq('id', parseInt(storeId))
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
      .eq('store_id', parseInt(storeId))
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
    const nextSKU = `${paddedCode}-${formattedNumber}`

    return NextResponse.json({
      success: true,
      sku: nextSKU,
      store_code: paddedCode,
      sequence: nextNumber
    })
  } catch (error: any) {
    console.error('Error generating SKU:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate SKU',
      },
      { status: 500 }
    )
  }
}
