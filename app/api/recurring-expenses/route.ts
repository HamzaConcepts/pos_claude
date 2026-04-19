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

type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

const isValidFrequency = (value: string): value is RecurrenceFrequency => {
  return ['daily', 'weekly', 'monthly', 'yearly'].includes(value)
}

const normalizeDate = (value?: string | null): string | null => {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return value
}

const getTodayDateString = (): string => {
  return new Date().toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')
    const view = searchParams.get('view')

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    const parsedStoreId = Number.parseInt(storeId, 10)
    if (Number.isNaN(parsedStoreId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid store ID' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('predefined_expenses')
      .select('*')
      .eq('store_id', parsedStoreId)
      .eq('is_recurring', true)
      .order('next_due_date', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })

    if (error) {
      throw error
    }

    const today = new Date(`${getTodayDateString()}T00:00:00`)

    const normalized = (data || []).map((item: any) => {
      const dueDate = item.next_due_date ? new Date(`${item.next_due_date}T00:00:00`) : null
      const daysUntilDue = dueDate
        ? Math.floor((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
        : null

      let dueStatus: 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'unscheduled' = 'unscheduled'
      if (daysUntilDue !== null) {
        if (daysUntilDue < 0) {
          dueStatus = 'overdue'
        } else if (daysUntilDue === 0) {
          dueStatus = 'due_today'
        } else if (daysUntilDue <= (item.reminder_days_before || 0)) {
          dueStatus = 'due_soon'
        } else {
          dueStatus = 'upcoming'
        }
      }

      return {
        ...item,
        days_until_due: daysUntilDue,
        due_status: dueStatus,
      }
    })

    const filtered = view === 'due'
      ? normalized.filter((item: any) => item.due_status === 'overdue' || item.due_status === 'due_today' || item.due_status === 'due_soon')
      : normalized

    return NextResponse.json({
      success: true,
      data: filtered,
    })
  } catch (error: any) {
    console.error('Error fetching recurring expenses:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch recurring expenses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      store_id,
      name,
      category,
      default_amount,
      description,
      is_active = true,
      created_by = null,
      recurrence_frequency,
      next_due_date,
      reminder_days_before = 0,
      auto_create = false,
      default_payment_method = 'Cash',
    } = body

    if (!store_id || !name || !category || default_amount === undefined || !recurrence_frequency || !next_due_date) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields for recurring expense' },
        { status: 400 }
      )
    }

    const parsedStoreId = Number.parseInt(String(store_id), 10)
    const parsedAmount = Number.parseFloat(String(default_amount))
    const parsedReminderDays = Number.parseInt(String(reminder_days_before), 10)
    const normalizedDueDate = normalizeDate(next_due_date)

    if (Number.isNaN(parsedStoreId) || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid store or amount values' },
        { status: 400 }
      )
    }

    if (!isValidFrequency(String(recurrence_frequency))) {
      return NextResponse.json(
        { success: false, error: 'Invalid recurrence frequency' },
        { status: 400 }
      )
    }

    if (!normalizedDueDate) {
      return NextResponse.json(
        { success: false, error: 'Invalid next due date' },
        { status: 400 }
      )
    }

    if (Number.isNaN(parsedReminderDays) || parsedReminderDays < 0) {
      return NextResponse.json(
        { success: false, error: 'Reminder days must be 0 or greater' },
        { status: 400 }
      )
    }

    if (!['Cash', 'Digital'].includes(default_payment_method)) {
      return NextResponse.json(
        { success: false, error: 'Default payment method must be Cash or Digital' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('predefined_expenses')
      .insert({
        store_id: parsedStoreId,
        name: String(name).trim(),
        category: String(category).trim(),
        default_amount: parsedAmount,
        description: description?.trim() || null,
        is_active: Boolean(is_active),
        created_by,
        is_recurring: true,
        recurrence_frequency,
        next_due_date: normalizedDueDate,
        reminder_days_before: parsedReminderDays,
        auto_create: Boolean(auto_create),
        default_payment_method,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error creating recurring expense:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create recurring expense' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      name,
      category,
      default_amount,
      description,
      is_active,
      recurrence_frequency,
      next_due_date,
      reminder_days_before,
      auto_create,
      default_payment_method,
      is_recurring,
    } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Recurring expense ID is required' },
        { status: 400 }
      )
    }

    const updateData: Record<string, any> = {}

    if (name !== undefined) updateData.name = String(name).trim()
    if (category !== undefined) updateData.category = String(category).trim()
    if (default_amount !== undefined) {
      const parsedAmount = Number.parseFloat(String(default_amount))
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid default amount' },
          { status: 400 }
        )
      }
      updateData.default_amount = parsedAmount
    }
    if (description !== undefined) updateData.description = description?.trim() || null
    if (is_active !== undefined) updateData.is_active = Boolean(is_active)
    if (is_recurring !== undefined) updateData.is_recurring = Boolean(is_recurring)
    if (auto_create !== undefined) updateData.auto_create = Boolean(auto_create)

    if (recurrence_frequency !== undefined) {
      if (!isValidFrequency(String(recurrence_frequency))) {
        return NextResponse.json(
          { success: false, error: 'Invalid recurrence frequency' },
          { status: 400 }
        )
      }
      updateData.recurrence_frequency = recurrence_frequency
    }

    if (next_due_date !== undefined) {
      const normalizedDueDate = normalizeDate(next_due_date)
      if (!normalizedDueDate) {
        return NextResponse.json(
          { success: false, error: 'Invalid next due date' },
          { status: 400 }
        )
      }
      updateData.next_due_date = normalizedDueDate
    }

    if (reminder_days_before !== undefined) {
      const parsedReminderDays = Number.parseInt(String(reminder_days_before), 10)
      if (Number.isNaN(parsedReminderDays) || parsedReminderDays < 0) {
        return NextResponse.json(
          { success: false, error: 'Reminder days must be 0 or greater' },
          { status: 400 }
        )
      }
      updateData.reminder_days_before = parsedReminderDays
    }

    if (default_payment_method !== undefined) {
      if (!['Cash', 'Digital'].includes(default_payment_method)) {
        return NextResponse.json(
          { success: false, error: 'Default payment method must be Cash or Digital' },
          { status: 400 }
        )
      }
      updateData.default_payment_method = default_payment_method
    }

    const { data, error } = await supabaseAdmin
      .from('predefined_expenses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating recurring expense:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update recurring expense' },
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
        { success: false, error: 'Recurring expense ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('predefined_expenses')
      .delete()
      .eq('id', Number.parseInt(id, 10))

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, message: 'Recurring expense deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting recurring expense:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete recurring expense' },
      { status: 500 }
    )
  }
}
