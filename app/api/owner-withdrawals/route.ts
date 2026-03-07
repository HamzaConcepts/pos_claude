import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 })
    }

    // Fetch withdrawals (without joining auth.users)
    const { data: withdrawals, error } = await supabaseAdmin
      .from('owner_withdrawals')
      .select('*')
      .eq('store_id', parseInt(storeId))
      .order('withdrawal_date', { ascending: false })

    if (error) throw error

    // If we have withdrawals with recorded_by UUIDs, fetch user emails
    let formattedData = withdrawals || []
    
    if (withdrawals && withdrawals.length > 0) {
      const uniqueUserIds = [...new Set(withdrawals.map(w => w.recorded_by).filter(Boolean))]
      
      if (uniqueUserIds.length > 0) {
        // Fetch user emails from auth.users
        const { data: users } = await supabaseAdmin.auth.admin.listUsers()
        const userMap = new Map(users.users.map(u => [u.id, u.email]))
        
        formattedData = withdrawals.map((w: any) => ({
          ...w,
          recorded_by_name: w.recorded_by ? (userMap.get(w.recorded_by) || 'Unknown') : 'System'
        }))
      } else {
        formattedData = withdrawals.map((w: any) => ({
          ...w,
          recorded_by_name: 'System'
        }))
      }
    }

    return NextResponse.json({ success: true, data: formattedData })
  } catch (error: any) {
    console.error('Error fetching withdrawals:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { store_id, amount, withdrawal_from, description, withdrawal_date, recorded_by } = body

    // Validation
    if (!store_id || !amount || !withdrawal_from || !withdrawal_date) {
      return NextResponse.json(
        { error: 'Missing required fields: store_id, amount, withdrawal_from, withdrawal_date' },
        { status: 400 }
      )
    }

    if (!['Cash', 'Bank'].includes(withdrawal_from)) {
      return NextResponse.json(
        { error: 'withdrawal_from must be either Cash or Bank' },
        { status: 400 }
      )
    }

    if (parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('owner_withdrawals')
      .insert({
        store_id: parseInt(store_id),
        amount: parseFloat(amount),
        withdrawal_from,
        description: description || null,
        withdrawal_date,
        recorded_by
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error creating withdrawal:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Withdrawal ID is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('owner_withdrawals')
      .delete()
      .eq('id', parseInt(id))

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting withdrawal:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
