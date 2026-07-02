import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const parsePositiveInt = (value: string | null): number | null => {
  if (!value) return null
  const parsed = parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const toNumber = (value: any): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeMethod = (value: any): 'Cash' | 'Digital' | null => {
  if (value === 'Cash') return 'Cash'
  if (value === 'Digital') return 'Digital'
  return null
}

async function getReturnBalanceImpact(storeId: number, startDate?: string | null, endDate?: string | null) {
  let returnsQuery = supabaseAdmin
    .from('returns')
    .select('id, sale_id, return_type, total_refund_amount, refund_method, return_date, created_at')
    .eq('store_id', storeId)
    .order('return_date', { ascending: false })

  if (startDate) {
    returnsQuery = returnsQuery.gte('return_date', startDate)
  }
  if (endDate) {
    const endDateTime = new Date(endDate)
    endDateTime.setHours(23, 59, 59, 999)
    returnsQuery = returnsQuery.lte('return_date', endDateTime.toISOString())
  }

  const [
    { data: returns, error: returnsError },
    { data: sales, error: salesError },
  ] = await Promise.all([
    returnsQuery,
    supabaseAdmin
      .from('sales')
      .select('id, bank_account_name')
      .eq('store_id', storeId),
  ])

  if (returnsError) throw returnsError
  if (salesError) throw salesError

  const saleBankMap = new Map<number, string>()
  ;(sales || []).forEach((sale: any) => {
    if (Number.isInteger(sale.id)) {
      saleBankMap.set(sale.id, typeof sale.bank_account_name === 'string' ? sale.bank_account_name.trim() || 'Unassigned' : 'Unassigned')
    }
  })

  const impact = {
    cashIn: 0,
    cashOut: 0,
    bankIn: new Map<string, number>(),
    bankOut: new Map<string, number>(),
  }

  const addBankMovement = (bankName: string, direction: 'in' | 'out', amount: number) => {
    const normalized = typeof bankName === 'string' && bankName.trim() ? bankName.trim() : 'Unassigned'
    const targetMap = direction === 'in' ? impact.bankIn : impact.bankOut
    targetMap.set(normalized, (targetMap.get(normalized) || 0) + amount)
  }

  ;(returns || []).forEach((returnRow: any) => {
    const amount = toNumber(returnRow.total_refund_amount)
    const refundMethod = String(returnRow.refund_method || 'Cash')

    if (returnRow.return_type === 'customer') {
      if (refundMethod === 'Cash') {
        impact.cashOut += amount
      } else if (refundMethod === 'Digital') {
        addBankMovement(returnRow.sale_id ? saleBankMap.get(returnRow.sale_id) || 'Unassigned' : 'Unassigned', 'out', amount)
      }
    }

    if (returnRow.return_type === 'supplier') {
      if (refundMethod === 'Cash') {
        impact.cashIn += amount
      } else if (refundMethod === 'Digital') {
        addBankMovement('Unassigned', 'in', amount)
      }
    }
  })

  return impact
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = parsePositiveInt(searchParams.get('store_id'))

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'Valid store_id is required' }, { status: 400 })
    }

    const [
      { data: cashRow, error: cashError },
      { data: bankAccounts, error: bankError },
      { data: bankBalances, error: balanceError },
      { data: payments, error: paymentsError },
      { data: sales, error: salesError },
      { data: expenses, error: expensesError },
      { data: inventoryPayments, error: inventoryPaymentsError },
      { data: customerPayments, error: customerPaymentsError },
      { data: supplierKhaataPayments, error: supplierKhaataPaymentsError },
      { data: supplierPayments, error: supplierPaymentsError },
      { data: ownerWithdrawals, error: ownerWithdrawalsError },
      { data: cashTransfers, error: cashTransfersError },
    ] = await Promise.all([
      supabaseAdmin
        .from('store_cash_balances')
        .select('opening_cash, updated_at, updated_by')
        .eq('store_id', storeId)
        .maybeSingle(),
      supabaseAdmin
        .from('store_bank_accounts')
        .select('id, account_name')
        .eq('store_id', storeId)
        .order('account_name', { ascending: true }),
      supabaseAdmin
        .from('store_bank_balances')
        .select('bank_account_id, opening_balance, updated_at, updated_by')
        .eq('store_id', storeId),
      supabaseAdmin
        .from('payments')
        .select('sale_id, payment_method, amount, bank_account_name')
        .eq('store_id', storeId),
      supabaseAdmin
        .from('sales')
        .select('id, payment_method, amount_paid, total_amount, bank_account_name')
        .eq('store_id', storeId),
      supabaseAdmin
        .from('expenses')
        .select('amount, payment_method, bank_account_name, category')
        .eq('store_id', storeId),
      supabaseAdmin
        .from('inventory_purchase_payments')
        .select('payment_method, amount, bank_account_name')
        .eq('store_id', storeId),
      supabaseAdmin
        .from('customer_payments')
        .select('payment_amount, payment_method, bank_account_name')
        .eq('store_id', storeId),
      supabaseAdmin
        .from('supplier_khaata_payments')
        .select('payment_amount, payment_method, bank_account_name')
        .eq('store_id', storeId),
      supabaseAdmin
        .from('supplier_payments')
        .select('amount, payment_method, bank_account_name')
        .eq('store_id', storeId),
      supabaseAdmin
        .from('owner_withdrawals')
        .select('amount, withdrawal_from')
        .eq('store_id', storeId),
      supabaseAdmin
        .from('cash_transfers')
        .select('transfer_amount, bank_name, transfer_direction')
        .eq('store_id', storeId),
    ])

    if (cashError) throw cashError
    if (bankError) throw bankError
    if (balanceError) throw balanceError
    if (paymentsError) throw paymentsError
    if (salesError) throw salesError
    if (expensesError) throw expensesError
    if (inventoryPaymentsError) throw inventoryPaymentsError
    if (customerPaymentsError) throw customerPaymentsError
    if (supplierKhaataPaymentsError) throw supplierKhaataPaymentsError
    if (supplierPaymentsError) throw supplierPaymentsError
    if (ownerWithdrawalsError) throw ownerWithdrawalsError
    if (cashTransfersError) throw cashTransfersError

    const balanceByAccount = new Map<number, { opening_balance: number; updated_at: string | null; updated_by: string | null }>()
    ;(bankBalances || []).forEach((row: any) => {
      balanceByAccount.set(row.bank_account_id, {
        opening_balance: Number(row.opening_balance || 0),
        updated_at: row.updated_at || null,
        updated_by: row.updated_by || null,
      })
    })

    const bankBalanceList = (bankAccounts || []).map((account: any) => {
      const balance = balanceByAccount.get(account.id)
      return {
        bank_account_id: account.id,
        bank_account_name: account.account_name,
        opening_balance: balance?.opening_balance ?? 0,
        updated_at: balance?.updated_at ?? null,
        updated_by: balance?.updated_by ?? null,
      }
    })

    const bankTotal = bankBalanceList.reduce((sum: number, row: any) => sum + Number(row.opening_balance || 0), 0)
    const cashBalance = Number(cashRow?.opening_cash || 0)

    const bankNameToId = new Map<string, number>()
    bankBalanceList.forEach((account) => {
      if (typeof account.bank_account_name === 'string') {
        bankNameToId.set(account.bank_account_name.trim().toLowerCase(), account.bank_account_id)
      }
    })

    const computedBankMap = new Map<number, number>()
    bankBalanceList.forEach((account) => {
      computedBankMap.set(account.bank_account_id, Number(account.opening_balance || 0))
    })

    let computedCash = cashBalance
    let unassignedBank = 0
    const returnImpact = await getReturnBalanceImpact(storeId, null, null)

    const applyBankAmount = (bankName: any, amount: number) => {
      if (!Number.isFinite(amount) || amount === 0) return
      if (typeof bankName === 'string') {
        const normalized = bankName.trim().toLowerCase()
        const bankId = normalized ? bankNameToId.get(normalized) : null
        if (bankId) {
          computedBankMap.set(bankId, (computedBankMap.get(bankId) || 0) + amount)
          return
        }
      }
      unassignedBank += amount
    }

    const paymentsBySale = new Set<number>()
    ;(payments || []).forEach((payment: any) => {
      const amount = toNumber(payment.amount)
      const method = normalizeMethod(payment.payment_method)
      if (method === 'Cash') {
        computedCash += amount
      } else if (method === 'Digital') {
        applyBankAmount(payment.bank_account_name, amount)
      }

      const saleId = Number(payment.sale_id)
      if (Number.isFinite(saleId)) {
        paymentsBySale.add(saleId)
      }
    })

    ;(sales || []).forEach((sale: any) => {
      const saleId = Number(sale.id)
      if (Number.isFinite(saleId) && paymentsBySale.has(saleId)) return

      const method = normalizeMethod(sale.payment_method)
      const amount = toNumber(sale.amount_paid || sale.total_amount)
      if (method === 'Cash') {
        computedCash += amount
      } else if (method === 'Digital') {
        applyBankAmount(sale.bank_account_name, amount)
      }
    })

    const excludedExpenseCategories = new Set(['new_product', 'inventory_restock', 'initial_stock'])
    ;(expenses || []).forEach((expense: any) => {
      const category = typeof expense.category === 'string' ? expense.category.toLowerCase() : ''
      if (category && excludedExpenseCategories.has(category)) return

      const amount = toNumber(expense.amount)
      const method = normalizeMethod(expense.payment_method) || 'Cash'
      if (method === 'Cash') {
        computedCash -= amount
      } else if (method === 'Digital') {
        applyBankAmount(expense.bank_account_name, -amount)
      }
    })

    ;(inventoryPayments || []).forEach((payment: any) => {
      const amount = toNumber(payment.amount)
      const method = normalizeMethod(payment.payment_method)
      if (method === 'Cash') {
        computedCash -= amount
      } else if (method === 'Digital') {
        applyBankAmount(payment.bank_account_name, -amount)
      }
    })

    ;(customerPayments || []).forEach((payment: any) => {
      const amount = toNumber(payment.payment_amount)
      const method = normalizeMethod(payment.payment_method) || 'Cash'
      if (method === 'Cash') {
        computedCash += amount
      } else if (method === 'Digital') {
        applyBankAmount(payment.bank_account_name, amount)
      }
    })

    ;(supplierKhaataPayments || []).forEach((payment: any) => {
      const amount = toNumber(payment.payment_amount)
      const method = normalizeMethod(payment.payment_method) || 'Cash'
      if (method === 'Cash') {
        computedCash -= amount
      } else if (method === 'Digital') {
        applyBankAmount(payment.bank_account_name, -amount)
      }
    })

    ;(supplierPayments || []).forEach((payment: any) => {
      const amount = toNumber(payment.amount)
      const method = normalizeMethod(payment.payment_method) || 'Cash'
      if (method === 'Cash') {
        computedCash -= amount
      } else if (method === 'Digital') {
        applyBankAmount(payment.bank_account_name, -amount)
      }
    })

    ;(ownerWithdrawals || []).forEach((withdrawal: any) => {
      const amount = toNumber(withdrawal.amount)
      if (withdrawal.withdrawal_from === 'Cash') {
        computedCash -= amount
      } else if (withdrawal.withdrawal_from === 'Bank') {
        applyBankAmount(null, -amount)
      }
    })

    ;(cashTransfers || []).forEach((transfer: any) => {
      const amount = toNumber(transfer.transfer_amount)
      const direction = transfer.transfer_direction === 'bank_to_cash' ? 'bank_to_cash' : 'cash_to_bank'
      if (direction === 'bank_to_cash') {
        computedCash += amount
        applyBankAmount(transfer.bank_name, -amount)
      } else {
        computedCash -= amount
        applyBankAmount(transfer.bank_name, amount)
      }
    })

    computedCash += returnImpact.cashIn
    computedCash -= returnImpact.cashOut

    ;(returnImpact.bankIn || new Map()).forEach((amount: number, bankName: string) => {
      applyBankAmount(bankName, amount)
    })
    ;(returnImpact.bankOut || new Map()).forEach((amount: number, bankName: string) => {
      applyBankAmount(bankName, -amount)
    })

    const computedBankBalances = bankBalanceList.map((account) => ({
      ...account,
      current_balance: computedBankMap.get(account.bank_account_id) ?? Number(account.opening_balance || 0),
    }))

    const computedBankTotal = computedBankBalances.reduce(
      (sum: number, row: any) => sum + Number(row.current_balance || 0),
      0
    )

    return NextResponse.json({
      success: true,
      data: {
        cash_balance: {
          opening_cash: cashBalance,
          updated_at: cashRow?.updated_at ?? null,
          updated_by: cashRow?.updated_by ?? null,
        },
        bank_balances: bankBalanceList,
        totals: {
          cash_total: cashBalance,
          bank_total: bankTotal,
          overall_total: cashBalance + bankTotal,
        }
      },
      computed: {
        cash_balance: {
          opening_cash: cashBalance,
          current_cash: computedCash,
        },
        bank_balances: computedBankBalances,
        totals: {
          cash_total: computedCash,
          bank_total: computedBankTotal + unassignedBank,
          unassigned_bank_total: unassignedBank,
          overall_total: computedCash + computedBankTotal + unassignedBank,
        },
        computed_at: new Date().toISOString(),
      }
    })
  } catch (err: any) {
    console.error('Error fetching balances:', err)
    return NextResponse.json({ success: false, error: err.message || 'Failed to fetch balances' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const parsedStoreId = parsePositiveInt(String(body.store_id ?? ''))

    if (!parsedStoreId) {
      return NextResponse.json({ success: false, error: 'Valid store_id is required' }, { status: 400 })
    }

    const openingCash = Number(body.opening_cash ?? 0)
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      return NextResponse.json({ success: false, error: 'opening_cash must be a non-negative number' }, { status: 400 })
    }

    const updatedBy = typeof body.updated_by === 'string' ? body.updated_by : null

    const bankBalancesInput = Array.isArray(body.bank_balances) ? body.bank_balances : []
    const bankRows = bankBalancesInput
      .map((row: any) => ({
        bank_account_id: Number(row.bank_account_id),
        opening_balance: Number(row.opening_balance ?? 0),
      }))
      .filter((row: any) => Number.isFinite(row.bank_account_id) && Number.isFinite(row.opening_balance) && row.opening_balance >= 0)
      .map((row: any) => ({
        store_id: parsedStoreId,
        bank_account_id: row.bank_account_id,
        opening_balance: row.opening_balance,
        updated_by: updatedBy,
      }))

    const { error: cashError } = await supabaseAdmin
      .from('store_cash_balances')
      .upsert({
        store_id: parsedStoreId,
        opening_cash: openingCash,
        updated_by: updatedBy,
      }, { onConflict: 'store_id' })

    if (cashError) throw cashError

    if (bankRows.length > 0) {
      const { error: bankUpsertError } = await supabaseAdmin
        .from('store_bank_balances')
        .upsert(bankRows, { onConflict: 'store_id,bank_account_id' })

      if (bankUpsertError) throw bankUpsertError
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error updating balances:', err)
    return NextResponse.json({ success: false, error: err.message || 'Failed to update balances' }, { status: 500 })
  }
}
