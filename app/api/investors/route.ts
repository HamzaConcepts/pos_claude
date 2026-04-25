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
      persistSession: false,
    },
  }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'Store ID is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('investors')
      .select('*')
      .eq('store_id', Number(storeId))
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch investors' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { store_id, investor_name, invested_amount, profit_share_percent, notes, is_active } = body

    if (!store_id || !investor_name) {
      return NextResponse.json({ success: false, error: 'store_id and investor_name are required' }, { status: 400 })
    }

    const amount = Number(invested_amount)
    const profitShare = Number(profit_share_percent)

    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ success: false, error: 'invested_amount must be a non-negative number' }, { status: 400 })
    }

    if (!Number.isFinite(profitShare) || profitShare < 0 || profitShare > 100) {
      return NextResponse.json({ success: false, error: 'profit_share_percent must be between 0 and 100' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('investors')
      .insert({
        store_id: Number(store_id),
        investor_name: String(investor_name).trim(),
        invested_amount: amount,
        profit_share_percent: profitShare,
        notes: notes ? String(notes).trim() : null,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to create investor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, investor_name, invested_amount, profit_share_percent, notes, is_active } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    const updates: Record<string, any> = {}

    if (investor_name !== undefined) {
      updates.investor_name = String(investor_name).trim()
    }

    if (invested_amount !== undefined) {
      const amount = Number(invested_amount)
      if (!Number.isFinite(amount) || amount < 0) {
        return NextResponse.json({ success: false, error: 'invested_amount must be a non-negative number' }, { status: 400 })
      }
      updates.invested_amount = amount
    }

    if (profit_share_percent !== undefined) {
      const profitShare = Number(profit_share_percent)
      if (!Number.isFinite(profitShare) || profitShare < 0 || profitShare > 100) {
        return NextResponse.json({ success: false, error: 'profit_share_percent must be between 0 and 100' }, { status: 400 })
      }
      updates.profit_share_percent = profitShare
    }

    if (notes !== undefined) {
      updates.notes = notes ? String(notes).trim() : null
    }

    if (is_active !== undefined) {
      updates.is_active = Boolean(is_active)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('investors')
      .update(updates)
      .eq('id', Number(id))
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to update investor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('investors')
      .delete()
      .eq('id', Number(id))

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete investor' }, { status: 500 })
  }
}
