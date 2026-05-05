import { NextResponse } from 'next/server'
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

    const parsedStoreId = parseInt(storeId)
    if (Number.isNaN(parsedStoreId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid store ID' },
        { status: 400 }
      )
    }

    const { data: sales, error } = await supabaseAdmin
      .from('sales')
      .select('customer_name, customer_phone, sale_date')
      .eq('store_id', parsedStoreId)
      .or('customer_name.not.is.null,customer_phone.not.is.null')
      .order('sale_date', { ascending: false })

    if (error) {
      throw error
    }

    const customersMap = new Map<string, { customer_name: string; customer_phone: string | null; last_sale_date: string }>()

    ;(sales || []).forEach((sale: any) => {
      const name = typeof sale.customer_name === 'string' ? sale.customer_name.trim() : ''
      const phone = typeof sale.customer_phone === 'string' ? sale.customer_phone.trim() : ''
      if (!name && !phone) return

      const key = phone ? `phone:${phone}` : `name:${name.toLowerCase()}`
      const existing = customersMap.get(key)
      const saleDate = sale.sale_date

      if (!existing) {
        customersMap.set(key, {
          customer_name: name || 'Unknown',
          customer_phone: phone || null,
          last_sale_date: saleDate,
        })
        return
      }

      if (saleDate && (!existing.last_sale_date || new Date(saleDate) > new Date(existing.last_sale_date))) {
        customersMap.set(key, {
          customer_name: name || existing.customer_name,
          customer_phone: phone || existing.customer_phone,
          last_sale_date: saleDate,
        })
      }
    })

    const customers = Array.from(customersMap.values()).sort((a, b) => {
      return new Date(b.last_sale_date).getTime() - new Date(a.last_sale_date).getTime()
    })

    return NextResponse.json({
      success: true,
      data: customers,
    })
  } catch (error: any) {
    console.error('Customer contacts API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch customer contacts' },
      { status: 500 }
    )
  }
}
