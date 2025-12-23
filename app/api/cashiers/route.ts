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
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('cashiers')
      .select('*')
      .eq('store_id', parseInt(storeId))
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || [],
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch cashiers',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { full_name, phone_number, commission_rate, salary, store_id } = body

    if (!full_name || !phone_number || !store_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name, phone number, and store ID are required',
        },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('cashiers')
      .insert([
        {
          full_name: full_name.trim(),
          phone_number: phone_number.trim(),
          commission_rate: commission_rate || 0,
          salary: salary || 0,
          store_id: parseInt(store_id),
          is_active: true,
        },
      ])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to add cashier',
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, full_name, phone_number, commission_rate, salary } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Cashier ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (full_name !== undefined) updateData.full_name = full_name.trim()
    if (phone_number !== undefined) updateData.phone_number = phone_number.trim()
    if (commission_rate !== undefined) updateData.commission_rate = commission_rate
    if (salary !== undefined) updateData.salary = salary

    const { data, error } = await supabaseAdmin
      .from('cashiers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update cashier',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Cashier ID is required' },
        { status: 400 }
      )
    }

    // Soft delete by setting is_active to false
    const { error } = await supabaseAdmin
      .from('cashiers')
      .update({ is_active: false })
      .eq('id', parseInt(id))

    if (error) throw error

    return NextResponse.json({
      success: true,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete cashier',
      },
      { status: 500 }
    )
  }
}
