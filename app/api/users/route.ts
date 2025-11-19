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
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Fetch managers for this store
    const { data: managers, error: managersError } = await supabaseAdmin
      .from('managers')
      .select('id, email, full_name, created_at')
      .eq('store_id', parseInt(storeId))
      .order('full_name', { ascending: true })

    if (managersError) {
      console.error('Error fetching managers:', managersError)
      throw managersError
    }

    // Fetch cashiers for this store
    const { data: cashiers, error: cashiersError } = await supabaseAdmin
      .from('cashier_accounts')
      .select('id, phone_number, full_name, created_at')
      .eq('store_id', parseInt(storeId))
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (cashiersError) {
      console.error('Error fetching cashiers:', cashiersError)
      throw cashiersError
    }

    // Combine and add role field
    const allUsers = [
      ...(managers || []).map(m => ({ ...m, role: 'Manager' })),
      ...(cashiers || []).map(c => ({ ...c, email: c.phone_number, role: 'Cashier' }))
    ]

    return NextResponse.json({
      success: true,
      data: allUsers,
    })
  } catch (error: any) {
    console.error('Users API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch users',
        code: 'FETCH_USERS_ERROR',
      },
      { status: 500 }
    )
  }
}
