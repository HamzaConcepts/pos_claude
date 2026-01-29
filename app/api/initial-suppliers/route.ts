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

// GET - Fetch all initial supplier entries for a store
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
      .from('initial_supplier_entries')
      .select('*')
      .eq('store_id', parseInt(storeId))
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || [],
    })
  } catch (error: any) {
    console.error('Error fetching initial supplier entries:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch initial supplier entries' },
      { status: 500 }
    )
  }
}

// POST - Create a new initial supplier entry
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      store_id,
      supplier_name,
      contact_person,
      supplier_phone,
      supplier_email,
      address,
      amount_owed,
      notes,
      created_by,
    } = body

    // Validation
    if (!store_id || !supplier_name || amount_owed === undefined) {
      return NextResponse.json(
        { success: false, error: 'Store ID, supplier name, and amount owed are required' },
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
      .from('initial_supplier_entries')
      .insert([
        {
          store_id: parseInt(store_id),
          supplier_name,
          contact_person: contact_person || null,
          supplier_phone: supplier_phone || null,
          supplier_email: supplier_email || null,
          address: address || null,
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
      message: 'Initial supplier entry created successfully',
    })
  } catch (error: any) {
    console.error('Error creating initial supplier entry:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create initial supplier entry' },
      { status: 500 }
    )
  }
}

// PUT - Update an initial supplier entry
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const {
      id,
      supplier_name,
      contact_person,
      supplier_phone,
      supplier_email,
      address,
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
      .from('initial_supplier_entries')
      .update({
        supplier_name,
        contact_person: contact_person || null,
        supplier_phone: supplier_phone || null,
        supplier_email: supplier_email || null,
        address: address || null,
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
      message: 'Initial supplier entry updated successfully',
    })
  } catch (error: any) {
    console.error('Error updating initial supplier entry:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update initial supplier entry' },
      { status: 500 }
    )
  }
}

// DELETE - Delete an initial supplier entry
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
      .from('initial_supplier_entries')
      .delete()
      .eq('id', parseInt(id))

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Initial supplier entry deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting initial supplier entry:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete initial supplier entry' },
      { status: 500 }
    )
  }
}
