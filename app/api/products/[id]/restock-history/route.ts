import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const productId = parseInt(params.id)

    // Fetch all inventory records for this product, ordered by restock date descending
    const { data: inventory, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', productId)
      .order('restock_date', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: inventory || [],
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch restock history',
        code: 'FETCH_HISTORY_ERROR',
      },
      { status: 500 }
    )
  }
}
