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

// GET - Fetch all initial customer entries for a store
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

    const { data, error } = await supabaseAdmin
      .from('initial_customer_entries')
      .select('*')
      .eq('store_id', parseInt(storeId))
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || [],
    })
  } catch (error: any) {
    console.error('Error fetching initial customer entries:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch initial customer entries' },
      { status: 500 }
    )
  }
}

// POST - Create a new initial customer entry
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      store_id,
      customer_name,
      customer_cnic,
      customer_phone,
      amount_owed,
      notes,
      created_by,
    } = body

    // Validation
    if (!store_id || !customer_name || amount_owed === undefined) {
      return NextResponse.json(
        { success: false, error: 'Store ID, customer name, and amount owed are required' },
        { status: 400 }
      )
    }

    if (amount_owed < 0) {
      return NextResponse.json(
        { success: false, error: 'Amount owed cannot be negative' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('initial_customer_entries')
      .insert([
        {
          store_id: parseInt(store_id),
          customer_name,
          customer_cnic: customer_cnic || null,
          customer_phone: customer_phone || null,
          amount_owed: parseFloat(amount_owed),
          notes: notes || null,
          created_by: created_by || null,
        },
      ])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      message: 'Initial customer entry created successfully',
    })
  } catch (error: any) {
    console.error('Error creating initial customer entry:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create initial customer entry' },
      { status: 500 }
    )
  }
}

// PUT - Update an initial customer entry
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const {
      id,
      customer_name,
      customer_cnic,
      customer_phone,
      amount_owed,
      notes,
    } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Entry ID is required' },
        { status: 400 }
      )
    }

    if (amount_owed < 0) {
      return NextResponse.json(
        { success: false, error: 'Amount owed cannot be negative' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('initial_customer_entries')
      .update({
        customer_name,
        customer_cnic: customer_cnic || null,
        customer_phone: customer_phone || null,
        amount_owed: parseFloat(amount_owed),
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parseInt(id))
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      message: 'Initial customer entry updated successfully',
    })
  } catch (error: any) {
    console.error('Error updating initial customer entry:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update initial customer entry' },
      { status: 500 }
    )
  }
}

// DELETE - Delete an initial customer entry
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Entry ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('initial_customer_entries')
      .delete()
      .eq('id', parseInt(id))

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Initial customer entry deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting initial customer entry:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete initial customer entry' },
      { status: 500 }
    )
  }
}
