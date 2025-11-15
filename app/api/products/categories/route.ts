import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .not('category', 'is', null)

    if (error) throw error

    // Get unique categories
    const categories = [...new Set(data?.map((p) => p.category) || [])]

    return NextResponse.json({
      success: true,
      data: categories,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch categories',
        code: 'FETCH_CATEGORIES_ERROR',
      },
      { status: 500 }
    )
  }
}
