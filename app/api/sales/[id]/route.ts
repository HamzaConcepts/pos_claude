import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data: sale, error } = await supabase
      .from('sales')
      .select(`
        *,
        users:cashier_id (full_name, username),
        sale_items (
          *,
          products (name, sku)
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error

    if (!sale) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sale not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: sale,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch sale',
        code: 'FETCH_SALE_ERROR',
      },
      { status: 500 }
    )
  }
}
