import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('search')

    let query = supabase
      .from('partial_payment_customers')
      .select('customer_name, customer_cnic, customer_phone')
      .order('created_at', { ascending: false })

    if (searchQuery) {
      query = query.ilike('customer_name', `%${searchQuery}%`)
    }

    // Get unique customers (in case same customer has multiple partial payments)
    const { data, error } = await query.limit(20)

    if (error) throw error

    // Remove duplicates based on customer_name
    const uniqueCustomers = data?.reduce((acc: any[], current) => {
      const exists = acc.find(
        (item) => item.customer_name.toLowerCase() === current.customer_name.toLowerCase()
      )
      if (!exists) {
        acc.push(current)
      }
      return acc
    }, [])

    return NextResponse.json({
      success: true,
      data: uniqueCustomers || [],
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
