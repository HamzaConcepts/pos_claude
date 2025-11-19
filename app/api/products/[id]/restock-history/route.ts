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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id)

    // Fetch all inventory records for this product, ordered by restock date descending
    const { data: inventory, error } = await supabaseAdmin
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
