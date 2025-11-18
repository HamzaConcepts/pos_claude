import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Fetch managers
    const { data: managers, error: managersError } = await supabase
      .from('managers')
      .select('id, email, full_name, created_at')
      .order('full_name', { ascending: true })

    if (managersError) throw managersError

    // Fetch cashiers
    const { data: cashiers, error: cashiersError } = await supabase
      .from('cashier_accounts')
      .select('id, phone_number, full_name, created_at')
      .order('full_name', { ascending: true })

    if (cashiersError) throw cashiersError

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
