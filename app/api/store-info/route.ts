import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Fetch store information from stores table
    const { data: store, error } = await supabaseAdmin
      .from('stores')
      .select('store_code, store_name')
      .eq('id', storeId)
      .single()

    if (error) {
      console.error('Error fetching store:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        store_name: store?.store_name || 'Not set',
        store_code: store?.store_code || '',
        auto_generated_code: store?.store_code || ''
      }
    })
  } catch (error: any) {
    console.error('Error fetching store info:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { store_id, store_code } = body

    if (!store_id) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Update store code in stores table
    const { data, error } = await supabaseAdmin
      .from('stores')
      .update({ store_code: store_code?.trim() || null })
      .eq('id', store_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating store info:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
