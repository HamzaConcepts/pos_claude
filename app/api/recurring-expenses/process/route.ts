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

const getTodayDateString = (): string => new Date().toISOString().slice(0, 10)

const toDateOnly = (dateString: string): Date => {
  return new Date(`${dateString}T00:00:00`)
}

const getDateDiffInDays = (fromDate: Date, toDate: Date): number => {
  return Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000))
}

const addFrequency = (dateString: string, frequency: RecurrenceFrequency): string => {
  const date = toDateOnly(dateString)

  if (frequency === 'daily') {
    date.setDate(date.getDate() + 1)
  } else if (frequency === 'weekly') {
    date.setDate(date.getDate() + 7)
  } else if (frequency === 'monthly') {
    const day = date.getDate()
    date.setMonth(date.getMonth() + 1)
    if (date.getDate() < day) {
      date.setDate(0)
    }
  } else {
    date.setFullYear(date.getFullYear() + 1)
  }

  return date.toISOString().slice(0, 10)
}

const isAuthorizedCronRequest = (request: NextRequest): boolean => {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return true
  }

  const authorization = request.headers.get('authorization')
  return authorization === `Bearer ${cronSecret}`
}

const processRecurringExpenses = async (request: NextRequest) => {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized cron request' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const storeIdParam = searchParams.get('store_id')
  const parsedStoreId = storeIdParam ? Number.parseInt(storeIdParam, 10) : null

  if (storeIdParam && Number.isNaN(parsedStoreId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid store_id value' },
      { status: 400 }
    )
  }

  const todayString = getTodayDateString()
  const today = toDateOnly(todayString)

  let query = supabaseAdmin
    .from('predefined_expenses')
    .select('*')
    .eq('is_active', true)
    .eq('is_recurring', true)
    .not('next_due_date', 'is', null)

  if (parsedStoreId) {
    query = query.eq('store_id', parsedStoreId)
  }

  const { data: recurringExpenses, error: recurringExpensesError } = await query

  if (recurringExpensesError) {
    throw recurringExpensesError
  }

  let autoCreatedCount = 0
  let reminderCount = 0
  let skippedCount = 0
  const errors: Array<{ predefined_expense_id: number; error: string }> = []

  for (const recurringExpense of recurringExpenses || []) {
    try {
      const dueDateString = recurringExpense.next_due_date as string
      const dueDate = toDateOnly(dueDateString)
      const daysUntilDue = getDateDiffInDays(today, dueDate)
      const reminderWindow = Number(recurringExpense.reminder_days_before || 0)
      const shouldSendReminder = daysUntilDue >= 0 && daysUntilDue <= reminderWindow
      const isDueOrOverdue = daysUntilDue <= 0

      // Reminder pathway for in-app notifications/logs
      if (shouldSendReminder && recurringExpense.last_reminded_on !== todayString) {
        const { error: reminderLogError } = await supabaseAdmin
          .from('recurring_expense_runs')
          .insert({
            predefined_expense_id: recurringExpense.id,
            store_id: recurringExpense.store_id,
            run_date: todayString,
            due_date: dueDateString,
            status: 'reminder_only',
            details: `Reminder generated ${daysUntilDue === 0 ? 'for due date' : `${daysUntilDue} day(s) before due date`}`,
          })

        if (!reminderLogError) {
          reminderCount += 1
          await supabaseAdmin
            .from('predefined_expenses')
            .update({ last_reminded_on: todayString })
            .eq('id', recurringExpense.id)
        }
      }

      if (!isDueOrOverdue || !recurringExpense.auto_create) {
        skippedCount += 1
        continue
      }

      // Idempotency check for auto-creation per run date.
      const { data: existingRun } = await supabaseAdmin
        .from('recurring_expense_runs')
        .select('id')
        .eq('predefined_expense_id', recurringExpense.id)
        .eq('run_date', todayString)
        .eq('status', 'auto_created')
        .maybeSingle()

      if (existingRun) {
        skippedCount += 1
        continue
      }

      const expenseDescription = recurringExpense.description || recurringExpense.name
      const { data: createdExpense, error: createExpenseError } = await supabaseAdmin
        .from('expenses')
        .insert({
          description: expenseDescription,
          amount: recurringExpense.default_amount,
          category: recurringExpense.category,
          payment_method: recurringExpense.default_payment_method || 'Cash',
          expense_date: dueDateString,
          store_id: recurringExpense.store_id,
          recorded_by: recurringExpense.created_by || null,
        })
        .select('id')
        .single()

      if (createExpenseError) {
        throw createExpenseError
      }

      const nextDueDate = addFrequency(
        dueDateString,
        (recurringExpense.recurrence_frequency || 'monthly') as RecurrenceFrequency
      )

      const { error: runLogError } = await supabaseAdmin
        .from('recurring_expense_runs')
        .insert({
          predefined_expense_id: recurringExpense.id,
          store_id: recurringExpense.store_id,
          run_date: todayString,
          due_date: dueDateString,
          status: 'auto_created',
          details: `Expense auto-created and next due date moved to ${nextDueDate}`,
          expense_id: createdExpense.id,
        })

      if (runLogError) {
        throw runLogError
      }

      const { error: updateRecurringError } = await supabaseAdmin
        .from('predefined_expenses')
        .update({
          next_due_date: nextDueDate,
          last_auto_created_on: todayString,
          last_reminded_on: todayString,
        })
        .eq('id', recurringExpense.id)

      if (updateRecurringError) {
        throw updateRecurringError
      }

      autoCreatedCount += 1
    } catch (error: any) {
      errors.push({
        predefined_expense_id: recurringExpense.id,
        error: error.message || 'Failed to process recurring expense',
      })

      await supabaseAdmin
        .from('recurring_expense_runs')
        .insert({
          predefined_expense_id: recurringExpense.id,
          store_id: recurringExpense.store_id,
          run_date: todayString,
          due_date: recurringExpense.next_due_date,
          status: 'failed',
          details: error.message || 'Failed to process recurring expense',
        })
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      processed_count: (recurringExpenses || []).length,
      auto_created_count: autoCreatedCount,
      reminders_created_count: reminderCount,
      skipped_count: skippedCount,
      errors,
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    return await processRecurringExpenses(request)
  } catch (error: any) {
    console.error('Recurring expense processor GET error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process recurring expenses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    return await processRecurringExpenses(request)
  } catch (error: any) {
    console.error('Recurring expense processor POST error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process recurring expenses' },
      { status: 500 }
    )
  }
}
