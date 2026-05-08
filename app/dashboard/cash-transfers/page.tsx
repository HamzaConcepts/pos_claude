'use client'

import { useEffect, useState } from 'react'
import {
  ArrowsLeftRightIcon,
  PlusIcon,
  TrashIcon,
  BankIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  XIcon,
} from '@phosphor-icons/react'
import { getStoreId, isManager, supabase } from '@/lib/supabase'
import { useCurrency } from '@/lib/currency-context'

interface CashTransfer {
  id: number
  store_id: number
  transfer_amount: number
  bank_name: string
  transfer_date: string
  notes: string | null
  recorded_by: string | null
  created_at: string
}

interface BankAccount {
  id: number
  account_name: string
}

export default function CashTransfersPage() {
  const { formatCurrency } = useCurrency()
  const [transfers, setTransfers] = useState<CashTransfer[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userIsManager, setUserIsManager] = useState(false)
  const [showBalanceEditor, setShowBalanceEditor] = useState(false)

  const [balances, setBalances] = useState<{
    cash_balance: {
      opening_cash: number
      updated_at: string | null
      updated_by: string | null
    }
    bank_balances: Array<{
      bank_account_id: number
      bank_account_name: string
      opening_balance: number
      updated_at: string | null
      updated_by: string | null
    }>
    totals: {
      cash_total: number
      bank_total: number
      overall_total: number
    }
    computed?: {
      cash_balance: {
        opening_cash: number
        current_cash: number
      }
      bank_balances: Array<{
        bank_account_id: number
        bank_account_name: string
        opening_balance: number
        current_balance: number
      }>
      totals: {
        cash_total: number
        bank_total: number
        unassigned_bank_total: number
        overall_total: number
      }
      computed_at: string
    }
  } | null>(null)
  const [balanceForm, setBalanceForm] = useState<{ cash: string; bankBalances: Record<number, string> }>({
    cash: '',
    bankBalances: {},
  })
  const [balancesSaving, setBalancesSaving] = useState(false)
  const [balancesError, setBalancesError] = useState('')

  // Balance summary
  const [cashSalesTotal, setCashSalesTotal] = useState(0)
  const [digitalSalesTotal, setDigitalSalesTotal] = useState(0)
  const [cashOperatingExpenses, setCashOperatingExpenses] = useState(0)
  const [cashStockPayments, setCashStockPayments] = useState(0)
  const [cashWithdrawalsTotal, setCashWithdrawalsTotal] = useState(0)
  const [cashKhaataInflow, setCashKhaataInflow] = useState(0)
  const [cashSupplierOutflow, setCashSupplierOutflow] = useState(0)
  const [showBreakdown, setShowBreakdown] = useState(false)

  const [form, setForm] = useState({
    transfer_amount: '',
    bank_name: '',
    custom_bank_name: '',
    transfer_date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  useEffect(() => {
    const checkRole = async () => {
      setUserIsManager(await isManager())
    }
    checkRole()
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([fetchTransfers(), fetchBankAccounts(), fetchSummaryTotals(), fetchBalances()])
    setLoading(false)
  }

  const fetchBalances = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const res = await fetch(`/api/balances?store_id=${storeId}`)
      const result = await res.json()
      if (!result.success) {
        setBalancesError(result.error || 'Failed to fetch balances')
        return
      }

      const data = result.data
      setBalances({
        ...data,
        computed: result.computed,
      })

      const bankBalances: Record<number, string> = {}
      ;(data.bank_balances || []).forEach((row: any) => {
        bankBalances[row.bank_account_id] = String(row.opening_balance ?? 0)
      })

      setBalanceForm({
        cash: String(data.cash_balance?.opening_cash ?? 0),
        bankBalances,
      })
    } catch (err: any) {
      setBalancesError(err.message || 'Failed to fetch balances')
    }
  }

  const fetchTransfers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return
      const res = await fetch(`/api/cash-transfers?store_id=${storeId}`)
      const result = await res.json()
      if (result.success) setTransfers(result.data || [])
    } catch (err) {
      console.error('Failed to fetch transfers:', err)
    }
  }

  const fetchBankAccounts = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return
      const res = await fetch(`/api/bank-accounts?store_id=${storeId}`)
      const result = await res.json()
      if (result.success) setBankAccounts(result.data || [])
    } catch (err) {
      console.error('Failed to fetch bank accounts:', err)
    }
  }

  const fetchSummaryTotals = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const [salesRes, expensesRes, withdrawalsRes, khaataInRes, supplierOutRes] = await Promise.all([
        fetch(`/api/sales?store_id=${storeId}`),
        fetch(`/api/expenses?store_id=${storeId}`),
        fetch(`/api/owner-withdrawals?store_id=${storeId}`),
        fetch(`/api/khaata-payments?store_id=${storeId}`),
        fetch(`/api/supplier-khaata-payments?store_id=${storeId}`),
      ])

      const salesResult = await salesRes.json()
      const expensesResult = await expensesRes.json()
      const withdrawalsResult = await withdrawalsRes.json()
      const khaataInResult = await khaataInRes.json()
      const supplierOutResult = await supplierOutRes.json()

      if (salesResult.success) {
        const sales = salesResult.data || []
        const cashTotal = sales.reduce((sum: number, sale: any) => {
          if (Array.isArray(sale.payments) && sale.payments.length > 0) {
            return sum + sale.payments
              .filter((payment: any) => payment.payment_method === 'Cash')
              .reduce((inner: number, payment: any) => inner + Number(payment.amount || 0), 0)
          }

          return sale.payment_method === 'Cash'
            ? sum + Number(sale.amount_paid || sale.total_amount || 0)
            : sum
        }, 0)
        const digitalTotal = sales.reduce((sum: number, sale: any) => {
          if (Array.isArray(sale.payments) && sale.payments.length > 0) {
            return sum + sale.payments
              .filter((payment: any) => payment.payment_method === 'Digital')
              .reduce((inner: number, payment: any) => inner + Number(payment.amount || 0), 0)
          }

          return sale.payment_method === 'Digital'
            ? sum + Number(sale.amount_paid || sale.total_amount || 0)
            : sum
        }, 0)
        setCashSalesTotal(cashTotal)
        setDigitalSalesTotal(digitalTotal)
      }

      if (expensesResult.success) {
        const expenses = expensesResult.data || []
        
        // 1. Operating Expenses (Normal overhead like rent, bills, etc.)
        // These match the main Expenses module
        const opExp = expenses
          .filter((e: any) => 
            e.category !== 'new_product' && 
            e.category !== 'inventory_restock' && 
            (e.payment_method === 'Cash' || !e.payment_method)
          )
          .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0)
        setCashOperatingExpenses(opExp)

        // 2. Immediate Stock Payments (Recorded at time of purchase)
        // We only count the 'amount_paid' portion if it was Cash
        // We'll fetch them from inventory-purchases which is batch-driven.
        const invRes = await fetch(`/api/inventory-purchases?store_id=${storeId}`)
        const invResult = await invRes.json()
        if (invResult.success) {
          const invPayments = invResult.data || []
          const cashInv = invPayments.reduce((sum: number, purchase: any) => {
            if (purchase.cash_paid !== undefined && purchase.cash_paid !== null) {
              return sum + Number(purchase.cash_paid || 0)
            }

            return purchase.payment_method === 'Cash' || !purchase.payment_method
              ? sum + Number(purchase.amount_paid || 0)
              : sum
          }, 0)
          setCashStockPayments(cashInv)
        }
      }

      if (withdrawalsResult.success) {
        const withdrawals = withdrawalsResult.data || []
        const cashWd = withdrawals
          .filter((w: any) => w.withdrawal_from === 'Cash')
          .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0)
        setCashWithdrawalsTotal(cashWd)
      }

      if (khaataInResult.success) {
        const payments = khaataInResult.data || []
        const cashIn = payments
          .filter((p: any) => p.payment_method === 'Cash' || !p.payment_method)
          .reduce((sum: number, p: any) => sum + Number(p.payment_amount || 0), 0)
        setCashKhaataInflow(cashIn)
      }

      if (supplierOutResult.success) {
        const payments = supplierOutResult.data || []
        const cashOut = payments
          .filter((p: any) => p.payment_method === 'Cash' || !p.payment_method)
          .reduce((sum: number, p: any) => sum + Number(p.payment_amount || 0), 0)
        setCashSupplierOutflow(cashOut)
      }
    } catch (err) {
      console.error('Failed to fetch summary totals:', err)
    }
  }

  const totalTransferred = transfers.reduce((sum, t) => sum + Number(t.transfer_amount), 0)
  const estimatedCashBalance = cashSalesTotal + cashKhaataInflow - cashOperatingExpenses - cashStockPayments - cashWithdrawalsTotal - cashSupplierOutflow - totalTransferred

  const resolveRecordedBy = async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      return user?.id || null
    } catch {
      return null
    }
  }

  const handleSaveBalances = async () => {
    if (!userIsManager) return
    setBalancesError('')

    const storeId = getStoreId()
    if (!storeId) {
      setBalancesError('Store ID not found. Please log in again.')
      return
    }

    const openingCash = Number(balanceForm.cash)
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      setBalancesError('Cash balance must be a non-negative number.')
      return
    }

    const bankBalancesPayload = Object.entries(balanceForm.bankBalances).map(([id, value]) => ({
      bank_account_id: Number(id),
      opening_balance: Number(value || 0),
    }))

    const hasInvalidBank = bankBalancesPayload.some((row) => !Number.isFinite(row.opening_balance) || row.opening_balance < 0)
    if (hasInvalidBank) {
      setBalancesError('Bank balances must be non-negative numbers.')
      return
    }

    setBalancesSaving(true)
    try {
      const updatedBy = await resolveRecordedBy()
      const res = await fetch('/api/balances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          opening_cash: openingCash,
          bank_balances: bankBalancesPayload,
          updated_by: updatedBy,
        }),
      })
      const result = await res.json()
      if (!result.success) {
        setBalancesError(result.error || 'Failed to save balances')
        return
      }

      await fetchBalances()
    } catch (err: any) {
      setBalancesError(err.message || 'Failed to save balances')
    } finally {
      setBalancesSaving(false)
    }
  }

  const handleSubmit = async () => {
    setError('')
    const amount = parseFloat(form.transfer_amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid transfer amount greater than 0.')
      return
    }

    const bankName = form.bank_name === 'Other' ? form.custom_bank_name.trim() : form.bank_name
    if (!bankName) {
      setError('Please select or enter a bank name.')
      return
    }

    if (!form.transfer_date) {
      setError('Please select a transfer date.')
      return
    }

    setSaving(true)
    try {
      const storeId = getStoreId()
      const recordedBy = await resolveRecordedBy()

      const res = await fetch('/api/cash-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          transfer_amount: amount,
          bank_name: bankName,
          transfer_date: form.transfer_date,
          notes: form.notes.trim() || null,
          recorded_by: recordedBy,
        }),
      })
      const result = await res.json()
      if (!result.success) {
        setError(result.error || 'Failed to record transfer')
        return
      }
      setShowModal(false)
      setForm({
        transfer_amount: '',
        bank_name: '',
        custom_bank_name: '',
        transfer_date: new Date().toISOString().split('T')[0],
        notes: '',
      })
      await fetchAll()
    } catch (err: any) {
      setError(err.message || 'Failed to record transfer')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this cash transfer record?')) return
    try {
      const storeId = getStoreId()
      const res = await fetch(`/api/cash-transfers?id=${id}&store_id=${storeId}`, { method: 'DELETE' })
      const result = await res.json()
      if (!result.success) {
        alert(result.error || 'Failed to delete transfer')
        return
      }
      await fetchAll()
    } catch (err: any) {
      alert(err.message || 'Failed to delete transfer')
    }
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Cash Transfers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Record cash moved from register to bank accounts</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded text-sm font-medium hover:bg-cyan-700 transition-colors"
        >
          <PlusIcon size={16} />
          Record Transfer
        </button>
      </div>

      {/* Manual Cash/Bank Balances */}
      {balances && showBalanceEditor && (
        <div className="mb-6 rounded-lg border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Cash & Bank Balances</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Manual entries</p>
            </div>
            {userIsManager ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBalanceEditor(false)}
                  className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-800"
                >
                  Close
                </button>
                <button
                  onClick={handleSaveBalances}
                  disabled={balancesSaving}
                  className="px-3 py-1.5 text-xs rounded border border-cyan-600 text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:border-cyan-500 dark:hover:bg-cyan-900/20 disabled:opacity-50"
                >
                  {balancesSaving ? 'Saving...' : 'Save Balances'}
                </button>
              </div>
            ) : (
              <span className="text-xs text-gray-400">Manager only</span>
            )}
          </div>

          {balancesError && (
            <div className="px-4 pt-3 text-xs text-red-600 dark:text-red-400">
              {balancesError}
            </div>
          )}

          <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Cash in Hand</p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={balanceForm.cash}
                onChange={(e) => setBalanceForm((prev) => ({ ...prev, cash: e.target.value }))}
                disabled={!userIsManager}
                className="mt-2 w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white disabled:opacity-70"
              />
            </div>

            <div className="lg:col-span-2 rounded border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Bank Balances</p>
                <span className="text-[11px] text-gray-400">Total: {formatCurrency(balances.totals.bank_total, 0)}</span>
              </div>
              {balances.bank_balances.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">No bank accounts added yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {balances.bank_balances.map((bank) => (
                    <div key={bank.bank_account_id} className="border border-gray-200 dark:border-gray-700 rounded p-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{bank.bank_account_name}</p>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={balanceForm.bankBalances[bank.bank_account_id] ?? ''}
                        onChange={(e) =>
                          setBalanceForm((prev) => ({
                            ...prev,
                            bankBalances: {
                              ...prev.bankBalances,
                              [bank.bank_account_id]: e.target.value,
                            },
                          }))
                        }
                        disabled={!userIsManager}
                        className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white disabled:opacity-70"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="px-4 pb-4 text-xs text-gray-500 dark:text-gray-400">
            Overall total: {formatCurrency(balances.totals.overall_total, 0)}
          </div>
        </div>
      )}

      {balances?.computed && (
        <div className="mb-6 rounded-lg border border-cyan-200 bg-cyan-50/40 shadow-sm dark:bg-cyan-900/10 dark:border-cyan-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-200 dark:border-cyan-700">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Computed Balances</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Recalculated from historical activity</p>
            </div>
            <div className="flex items-center gap-2">
              {userIsManager && (
                <button
                  onClick={() => setShowBalanceEditor(true)}
                  className="px-3 py-1.5 text-xs rounded border border-cyan-600 text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:border-cyan-500 dark:hover:bg-cyan-900/20"
                >
                  Edit balances
                </button>
              )}
              <span className="text-[11px] text-gray-400">Updated {new Date(balances.computed.computed_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</span>
            </div>
          </div>

          <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded border border-cyan-200 dark:border-cyan-700 p-3 bg-white/60 dark:bg-cyan-900/20">
              <p className="text-xs text-gray-500 dark:text-gray-400">Current Cash</p>
              <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(balances.computed.cash_balance.current_cash, 0)}
              </p>
            </div>

            <div className="rounded border border-cyan-200 dark:border-cyan-700 p-3 bg-white/60 dark:bg-cyan-900/20">
              <p className="text-xs text-gray-500 dark:text-gray-400">Current Bank Total</p>
              <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(balances.computed.totals.bank_total, 0)}
              </p>
              {balances.computed.totals.unassigned_bank_total !== 0 && (
                <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                  Unassigned: {formatCurrency(balances.computed.totals.unassigned_bank_total, 0)}
                </p>
              )}
            </div>

            <div className="rounded border border-cyan-200 dark:border-cyan-700 p-3 bg-white/60 dark:bg-cyan-900/20">
              <p className="text-xs text-gray-500 dark:text-gray-400">Overall Total</p>
              <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(balances.computed.totals.overall_total, 0)}
              </p>
            </div>
          </div>

          <div className="px-4 pb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Per-bank balances</p>
            {balances.computed.bank_balances.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">No bank accounts available.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {balances.computed.bank_balances.map((bank) => (
                  <div key={bank.bank_account_id} className="rounded border border-cyan-200 dark:border-cyan-700 p-3 bg-white/60 dark:bg-cyan-900/20">
                    <p className="text-xs text-gray-600 dark:text-gray-400">{bank.bank_account_name}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(bank.current_balance, 0)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-lg border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Cash Sales</p>
            <CurrencyDollarIcon size={16} className="text-green-500" />
          </div>
          <p className="text-lg font-bold text-green-600">{formatCurrency(cashSalesTotal, 0)}</p>
        </div>
        <div className="p-4 rounded-lg border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Digital Sales</p>
            <BankIcon size={16} className="text-blue-500" />
          </div>
          <p className="text-lg font-bold text-blue-600">{formatCurrency(digitalSalesTotal, 0)}</p>
        </div>
        <div className="p-4 rounded-lg border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Transferred</p>
            <ArrowsLeftRightIcon size={16} className="text-orange-500" />
          </div>
          <p className="text-lg font-bold text-orange-600">{formatCurrency(totalTransferred, 0)}</p>
        </div>
        <button
          onClick={() => setShowBreakdown(true)}
          className="p-4 rounded-lg border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 text-left hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Est. Cash Balance</p>
            <CurrencyDollarIcon size={16} className={estimatedCashBalance >= 0 ? 'text-cyan-500' : 'text-red-500'} />
          </div>
          <p className={`text-lg font-bold ${estimatedCashBalance >= 0 ? 'text-cyan-600' : 'text-red-600'}`}>
            {formatCurrency(estimatedCashBalance, 0)}
          </p>
          <p className="text-[10px] text-cyan-500 dark:text-cyan-400 mt-0.5 group-hover:underline">Tap to see breakdown →</p>
        </button>
      </div>

      {/* Transfers Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">Loading transfers...</div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <ArrowsLeftRightIcon size={40} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No cash transfers recorded yet.</p>
          <p className="text-xs text-gray-400 mt-1">Use the "Record Transfer" button to log a cash-to-bank movement.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Bank</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Notes</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((transfer) => (
                  <tr key={transfer.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {new Date(transfer.transfer_date).toLocaleDateString('en-PK', {
                        timeZone: 'Asia/Karachi',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-800 dark:text-gray-200">
                        <BankIcon size={14} className="text-blue-500 flex-shrink-0" />
                        {transfer.bank_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-sm text-orange-600">
                      {formatCurrency(transfer.transfer_amount, 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 italic">
                      {transfer.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(transfer.id)}
                        className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete transfer"
                      >
                        <TrashIcon size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-orange-600 text-white font-semibold">
                  <td colSpan={2} className="px-4 py-2.5 text-sm">TOTAL TRANSFERRED</td>
                  <td className="px-4 py-2.5 text-right text-sm">{formatCurrency(totalTransferred, 0)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Record Transfer Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-gray-700 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Record Cash Transfer</h2>
              <button
                onClick={() => { setShowModal(false); setError('') }}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Close"
              >
                <XIcon size={18} className="text-gray-500" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Transfer Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.transfer_amount}
                  onChange={(e) => setForm({ ...form, transfer_amount: e.target.value })}
                  placeholder="0.00"
                  title="Transfer amount"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* Bank Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bank <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value, custom_bank_name: '' })}
                  title="Select bank"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="">Select a bank...</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.account_name}>{b.account_name}</option>
                  ))}
                  <option value="Other">Other (custom)</option>
                </select>
                {form.bank_name === 'Other' && (
                  <input
                    type="text"
                    value={form.custom_bank_name}
                    onChange={(e) => setForm({ ...form, custom_bank_name: e.target.value })}
                    placeholder="Enter bank name..."
                    title="Custom bank name"
                    className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  />
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Transfer Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.transfer_date}
                  onChange={(e) => setForm({ ...form, transfer_date: e.target.value })}
                  title="Transfer date"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes..."
                  title="Transfer notes"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setError('') }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded text-sm font-medium hover:bg-cyan-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Record Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Est. Cash Balance Breakdown Modal */}
      {showBreakdown && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-gray-700 p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Cash Balance Breakdown</h2>
              <button
                onClick={() => setShowBreakdown(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Close"
              >
                <XIcon size={18} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Positive items */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Cash Sales</p>
                  <p className="text-xs text-gray-400">All sales paid in cash</p>
                </div>
                <span className="text-sm font-semibold text-green-600">+ {formatCurrency(cashSalesTotal, 0)}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Customer Ledger Payments</p>
                  <p className="text-xs text-gray-400">Cash received from dues</p>
                </div>
                <span className="text-sm font-semibold text-green-600">+ {formatCurrency(cashKhaataInflow, 0)}</span>
              </div>

              {/* Negative items */}
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Operating Expenses</p>
                  <p className="text-xs text-gray-400">Rent, Bills, Salaries, etc.</p>
                </div>
                <span className="text-sm font-semibold text-red-500">− {formatCurrency(cashOperatingExpenses, 0)}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Stock Purchase (Cash)</p>
                  <p className="text-xs text-gray-400">Immediate cash paid for stock</p>
                </div>
                <span className="text-sm font-semibold text-red-500">− {formatCurrency(cashStockPayments, 0)}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Supplier Ledger Payments</p>
                  <p className="text-xs text-gray-400">Cash paid to suppliers for dues</p>
                </div>
                <span className="text-sm font-semibold text-red-500">− {formatCurrency(cashSupplierOutflow, 0)}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Owner Withdrawals (Cash)</p>
                  <p className="text-xs text-gray-400">Cash taken out by owner</p>
                </div>
                <span className="text-sm font-semibold text-red-500">− {formatCurrency(cashWithdrawalsTotal, 0)}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Cash Transferred to Bank</p>
                  <p className="text-xs text-gray-400">Transfers recorded on this page</p>
                </div>
                <span className="text-sm font-semibold text-red-500">− {formatCurrency(totalTransferred, 0)}</span>
              </div>

              {/* Result */}
              <div className={`flex items-center justify-between py-3 px-3 rounded-lg mt-1 ${
                estimatedCashBalance >= 0
                  ? 'bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
              }`}>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Est. Cash in Hand</p>
                <span className={`text-base font-bold ${
                  estimatedCashBalance >= 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(estimatedCashBalance, 0)}
                </span>
              </div>

              <p className="text-[10px] text-gray-400 text-center pt-1">
                ⚠ This is an estimate. Opening balances and inventory cash payments are not included.
              </p>
            </div>

            <button
              onClick={() => setShowBreakdown(false)}
              className="w-full mt-5 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
