import { NextRequest, NextResponse } from 'next/server'
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const { cost_price, selling_price, lowest_negotiable_price, quantity_purchased, quantity_remaining } = body

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

    if (quantity_purchased !== undefined && (quantity_purchased <= 0 || isNaN(quantity_purchased))) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stock quantity must be a positive number',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (quantity_remaining !== undefined && (quantity_remaining < 0 || isNaN(quantity_remaining))) {
      return NextResponse.json(
        {
          success: false,
          error: 'Remaining quantity must be zero or a positive number',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (quantity_purchased !== undefined && quantity_remaining !== undefined && quantity_remaining > quantity_purchased) {
      return NextResponse.json(
        {
          success: false,
          error: 'Remaining quantity cannot exceed purchased quantity',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const { data: currentBatch, error: currentBatchError } = await supabaseAdmin
      .from('stock_batches')
      .select('quantity_purchased, quantity_remaining')
      .eq('id', (await params).id)
      .single()

    if (currentBatchError) throw currentBatchError

    let nextPurchased = quantity_purchased ?? currentBatch.quantity_purchased
    let nextRemaining = quantity_remaining ?? currentBatch.quantity_remaining

    if (quantity_purchased !== undefined && quantity_remaining === undefined && nextRemaining > nextPurchased) {
      nextRemaining = nextPurchased
    }

    // Update batch prices - the trigger will automatically update aggregated_stock
    const batchUpdateData: any = {}
    if (cost_price !== undefined) batchUpdateData.cost_price = cost_price
    if (selling_price !== undefined) batchUpdateData.selling_price = selling_price
    if (lowest_negotiable_price !== undefined) batchUpdateData.lowest_negotiable_price = lowest_negotiable_price
    if (quantity_purchased !== undefined) batchUpdateData.quantity_purchased = nextPurchased
    if (quantity_remaining !== undefined || (quantity_purchased !== undefined && nextRemaining !== currentBatch.quantity_remaining)) {
      batchUpdateData.quantity_remaining = nextRemaining
      batchUpdateData.is_depleted = nextRemaining <= 0
      batchUpdateData.depleted_at = nextRemaining <= 0 ? new Date().toISOString() : null
    }

    const { error: updateError } = await supabaseAdmin
      .from('stock_batches')
      .update(batchUpdateData)
      .eq('id', (await params).id)

    if (updateError) throw updateError

    // Fetch updated batch
    const { data: updatedBatch, error: fetchError } = await supabaseAdmin
      .from('stock_batches')
      .select('*')
      .eq('id', (await params).id)
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
