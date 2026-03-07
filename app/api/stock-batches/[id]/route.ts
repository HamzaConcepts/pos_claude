import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

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

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { cost_price, selling_price, lowest_negotiable_price } = body

    // Validation
    if (cost_price !== undefined && (cost_price < 0 || isNaN(cost_price))) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cost price must be a positive number',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (selling_price !== undefined && (selling_price < 0 || isNaN(selling_price))) {
      return NextResponse.json(
        {
          success: false,
          error: 'Selling price must be a positive number',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (lowest_negotiable_price !== undefined && (lowest_negotiable_price < 0 || isNaN(lowest_negotiable_price))) {
      return NextResponse.json(
        {
          success: false,
          error: 'Lowest negotiable price must be a positive number',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (lowest_negotiable_price !== undefined && selling_price !== undefined && lowest_negotiable_price > selling_price) {
      return NextResponse.json(
        {
          success: false,
          error: 'Lowest negotiable price cannot be higher than selling price',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // Update batch prices - the trigger will automatically update aggregated_stock
    const batchUpdateData: any = {}
    if (cost_price !== undefined) batchUpdateData.cost_price = cost_price
    if (selling_price !== undefined) batchUpdateData.selling_price = selling_price
    if (lowest_negotiable_price !== undefined) batchUpdateData.lowest_negotiable_price = lowest_negotiable_price

    const { error: updateError } = await supabaseAdmin
      .from('stock_batches')
      .update(batchUpdateData)
      .eq('id', params.id)

    if (updateError) throw updateError

    // Fetch updated batch
    const { data: updatedBatch, error: fetchError } = await supabaseAdmin
      .from('stock_batches')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError) throw fetchError

    return NextResponse.json({
      success: true,
      data: updatedBatch,
    })
  } catch (error: any) {
    console.error('Error updating batch:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update batch',
      },
      { status: 500 }
    )
  }
}
