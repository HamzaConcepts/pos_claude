import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const parsePositiveInt = (v: string | null): number | null => {
  if (!v) return null
  const n = parseInt(v, 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

// GET — list transfers for a store
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = parsePositiveInt(searchParams.get('store_id'))
    if (!storeId) {
      return NextResponse.json({ success: false, error: 'Valid store_id is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('cash_transfers')
      .select('*')
      .eq('store_id', storeId)
      .order('transfer_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, data: data || [] })
  } catch (err: any) {
    console.error('Error fetching cash transfers:', err)
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch cash transfers' }, { status: 500 })
  }
}

// POST — record a new transfer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { store_id, transfer_amount, bank_name, transfer_date, notes, recorded_by } = body

    const parsedStoreId = parsePositiveInt(String(store_id ?? ''))
    if (!parsedStoreId) {
      return NextResponse.json({ success: false, error: 'Valid store_id is required' }, { status: 400 })
    }

    const amount = parseFloat(transfer_amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'transfer_amount must be a positive number' }, { status: 400 })
    }

    const bankNameStr = typeof bank_name === 'string' ? bank_name.trim() : ''
    if (!bankNameStr) {
      return NextResponse.json({ success: false, error: 'bank_name is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('cash_transfers')
      .insert({
        store_id: parsedStoreId,
        transfer_amount: amount,
        bank_name: bankNameStr,
        transfer_date: transfer_date || new Date().toISOString().split('T')[0],
        notes: notes?.trim() || null,
        recorded_by: recorded_by || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err: any) {
    console.error('Error creating cash transfer:', err)
    return NextResponse.json({ success: false, error: err.message || 'Failed to create cash transfer' }, { status: 500 })
  }
}

// DELETE — remove a transfer by id
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = parsePositiveInt(searchParams.get('id'))
    const storeId = parsePositiveInt(searchParams.get('store_id'))

    if (!id || !storeId) {
      return NextResponse.json({ success: false, error: 'Valid id and store_id are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('cash_transfers')
      .delete()
      .eq('id', id)
      .eq('store_id', storeId)
      .select('id')

    if (error) throw error
    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: 'Transfer not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error deleting cash transfer:', err)
    return NextResponse.json({ success: false, error: err.message || 'Failed to delete cash transfer' }, { status: 500 })
  }
}
