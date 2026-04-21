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

const parsePositiveInt = (value: string | null): number | null => {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsedStoreId = parsePositiveInt(searchParams.get('store_id'))

    if (!parsedStoreId) {
      return NextResponse.json(
        { success: false, error: 'Valid store ID is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('store_bank_accounts')
      .select('id, store_id, account_name, created_at, updated_at')
      .eq('store_id', parsedStoreId)
      .order('account_name', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || [],
    })
  } catch (error: any) {
    console.error('Error fetching bank accounts:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch bank accounts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsedStoreId = parsePositiveInt(String(body?.store_id ?? ''))
    const accountName = typeof body?.account_name === 'string' ? body.account_name.trim() : ''

    if (!parsedStoreId) {
      return NextResponse.json(
        { success: false, error: 'Valid store ID is required' },
        { status: 400 }
      )
    }

    if (!accountName) {
      return NextResponse.json(
        { success: false, error: 'Bank account name is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('store_bank_accounts')
      .insert({
        store_id: parsedStoreId,
        account_name: accountName,
      })
      .select('id, store_id, account_name, created_at, updated_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'This bank account already exists for this store' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Bank account added successfully',
    })
  } catch (error: any) {
    console.error('Error creating bank account:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create bank account' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsedStoreId = parsePositiveInt(searchParams.get('store_id'))
    const parsedAccountId = parsePositiveInt(searchParams.get('id'))

    if (!parsedStoreId || !parsedAccountId) {
      return NextResponse.json(
        { success: false, error: 'Valid store ID and account ID are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('store_bank_accounts')
      .delete()
      .eq('id', parsedAccountId)
      .eq('store_id', parsedStoreId)
      .select('id')

    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bank account not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting bank account:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete bank account' },
      { status: 500 }
    )
  }
}
