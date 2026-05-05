import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Disable caching for this route
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('search')
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    const parsedStoreId = parseInt(storeId)
    if (Number.isNaN(parsedStoreId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid store ID' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('partial_payment_customers')
      .select(`
        *,
        sales!partial_payment_customers_sale_id_fkey (
          sale_description
        )
      `)
      .order('created_at', { ascending: false })

    query = query.eq('store_id', parsedStoreId)

    if (searchQuery) {
      query = query.or(`customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`)
    }

    // Return ALL records — the client-side aggregateCustomers() groups them by phone
    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || [],
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch customers',
        code: 'FETCH_CUSTOMERS_ERROR',
      },
      { status: 500 }
    )
  }
}
