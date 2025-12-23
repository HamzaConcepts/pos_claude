import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

    // Fetch all predefined expenses for the store
    const { data, error } = await supabase
      .from('predefined_expenses')
      .select('*')
      .eq('store_id', storeId)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error: any) {
    console.error('Error fetching predefined expenses:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch predefined expenses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { store_id, name, category, default_amount, description, is_active, created_by } = body

    if (!store_id || !name || !category || default_amount === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Insert new predefined expense
    const { data, error } = await supabase
      .from('predefined_expenses')
      .insert({
        store_id,
        name,
        category,
        default_amount,
        description: description || null,
        is_active: is_active !== undefined ? is_active : true,
        created_by: created_by || null
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: any) {
    console.error('Error creating predefined expense:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create predefined expense' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, category, default_amount, description, is_active } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Predefined expense ID is required' },
        { status: 400 }
      )
    }

    // Update predefined expense
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (category !== undefined) updateData.category = category
    if (default_amount !== undefined) updateData.default_amount = default_amount
    if (description !== undefined) updateData.description = description
    if (is_active !== undefined) updateData.is_active = is_active

    const { data, error } = await supabase
      .from('predefined_expenses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error: any) {
    console.error('Error updating predefined expense:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update predefined expense' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Predefined expense ID is required' },
        { status: 400 }
      )
    }

    // Delete predefined expense
    const { error } = await supabase
      .from('predefined_expenses')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Predefined expense deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting predefined expense:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete predefined expense' },
      { status: 500 }
    )
  }
}
