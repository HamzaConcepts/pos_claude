import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { data: sale, error } = await supabase
      .from('sales')
      .select(`
        *,
        users:cashier_id (full_name, username),
        sale_items (
          *,
          products (name, sku)
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) throw error

    if (!sale) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sale not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: sale,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch sale',
        code: 'FETCH_SALE_ERROR',
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { payment_method, payment_status, notes } = body

    // Validation
    if (!params.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sale ID is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // Build update object with only allowed fields
    const updateData: any = {}
    
    if (payment_method !== undefined) {
      if (!['Cash', 'Digital'].includes(payment_method)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid payment method. Must be Cash or Digital.',
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }
      updateData.payment_method = payment_method
    }

    if (payment_status !== undefined) {
      if (!['Paid', 'Partial', 'Pending'].includes(payment_status)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid payment status. Must be Paid, Partial, or Pending.',
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }
      updateData.payment_status = payment_status
    }

    if (notes !== undefined) {
      updateData.notes = notes
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid fields to update',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('sales')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating sale:', error)
      throw error
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('Update sale error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update sale',
        code: 'UPDATE_SALE_ERROR',
      },
      { status: 500 }
    )
  }
}
