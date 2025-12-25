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

// GET - Fetch suppliers or search by phone
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')
    const phoneNumber = searchParams.get('phone')
    const searchTerm = searchParams.get('search')

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('suppliers')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('supplier_name', { ascending: true })

    // Search by exact phone number
    if (phoneNumber) {
      query = query.eq('phone_number', phoneNumber)
    }

    // Search by name or phone (partial match)
    if (searchTerm) {
      query = query.or(`supplier_name.ilike.%${searchTerm}%,phone_number.ilike.%${searchTerm}%`)
    }

    const { data: suppliers, error } = await query

    if (error) {
      console.error('Error fetching suppliers:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: suppliers || []
    })
  } catch (error: any) {
    console.error('Error in GET /api/suppliers:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Create new supplier
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      store_id,
      supplier_name,
      phone_number,
      email,
      address,
      notes,
      initial_balance
    } = body

    // Validation
    if (!store_id || !supplier_name || !phone_number) {
      return NextResponse.json(
        { success: false, error: 'Store ID, supplier name, and phone number are required' },
        { status: 400 }
      )
    }

    // Check if phone number already exists for this store
    const { data: existing } = await supabaseAdmin
      .from('suppliers')
      .select('id')
      .eq('store_id', store_id)
      .eq('phone_number', phone_number)
      .single()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A supplier with this phone number already exists' },
        { status: 409 }
      )
    }

    // Create supplier
    const initialBal = initial_balance ? parseFloat(initial_balance) : 0
    const { data: supplier, error } = await supabaseAdmin
      .from('suppliers')
      .insert({
        store_id,
        supplier_name: supplier_name.trim(),
        phone_number: phone_number.trim(),
        email: email?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        initial_balance: initialBal,
        balance_owed: initialBal,
        total_paid: 0,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating supplier:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: supplier
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/suppliers:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PUT - Update supplier
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      store_id,
      supplier_name,
      contact_person,
      phone_number,
      email,
      address,
      notes,
      is_active
    } = body

    if (!id || !store_id) {
      return NextResponse.json(
        { success: false, error: 'Supplier ID and Store ID are required' },
        { status: 400 }
      )
    }

    // If phone number is being changed, check uniqueness
    if (phone_number) {
      const { data: existing } = await supabaseAdmin
        .from('suppliers')
        .select('id')
        .eq('store_id', store_id)
        .eq('phone_number', phone_number)
        .neq('id', id)
        .single()

      if (existing) {
        return NextResponse.json(
          { success: false, error: 'A supplier with this phone number already exists' },
          { status: 409 }
        )
      }
    }

    // Update supplier
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (supplier_name) updateData.supplier_name = supplier_name.trim()
    if (phone_number) updateData.phone_number = phone_number.trim()
    if (email !== undefined) updateData.email = email?.trim() || null
    if (address !== undefined) updateData.address = address?.trim() || null
    if (notes !== undefined) updateData.notes = notes?.trim() || null
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: supplier, error } = await supabaseAdmin
      .from('suppliers')
      .update(updateData)
      .eq('id', id)
      .eq('store_id', store_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating supplier:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data: supplier
    })
  } catch (error: any) {
    console.error('Error in PUT /api/suppliers:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete supplier (set is_active = false)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const storeId = searchParams.get('store_id')

    if (!id || !storeId) {
      return NextResponse.json(
        { success: false, error: 'Supplier ID and Store ID are required' },
        { status: 400 }
      )
    }

    // Soft delete
    const { error } = await supabaseAdmin
      .from('suppliers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('store_id', storeId)

    if (error) {
      console.error('Error deleting supplier:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Supplier deleted successfully'
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/suppliers:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
