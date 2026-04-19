'use client'

import { Fragment, useEffect, useState } from 'react'
import { MagnifyingGlassIcon, PencilSimpleIcon, TrashIcon, CaretDownIcon, CaretRightIcon, PackageIcon, CurrencyDollarIcon } from '@phosphor-icons/react'
import { getStoreId, supabase } from '@/lib/supabase'
import { useCurrency } from '@/lib/currency-context'

interface SupplierKhaata {
  id: number
  stock_batch_id: number
  supplier_id: number
  supplier_name: string
  supplier_phone: string
  supplier_contact: string | null
  total_amount: number
  amount_paid: number
  amount_remaining: number
  notes: string | null
  store_id: number
  created_at: string
  updated_at?: string
  suppliers?: {
    id: number
    supplier_name: string
    phone_number: string
    email?: string
    address?: string
  }
  stock_batches?: {
    id: number
    batch_number: string
    purchase_date: string
    products?: {
      id: number
      name: string
      sku: string
    }
  }
}

interface AggregatedSupplier {
  supplier_name: string
  supplier_phone: string
  supplier_id: number
  total_amount: number
  amount_paid: number
  amount_remaining: number
  transactions: SupplierKhaata[]
}

interface InitialSupplier {
  id: number
  supplier_name: string
  contact_person: string | null
  supplier_phone: string | null
  supplier_email: string | null
  address: string | null
  amount_owed: number
  notes: string | null
  created_at: string
}

interface SupplierPaymentHistory {
  id: number
  supplier_id: number | null
  supplier_khaata_id: number
  payment_amount: number
  payment_date: string
  payment_method: string
  notes: string | null
  payment_reference: string | null
  transaction_remaining_before: number | null
  transaction_remaining_after: number | null
  supplier_remaining_before: number | null
  supplier_remaining_after: number | null
  supplier_khaata?: {
    id: number
    stock_batches?: {
      id: number
      batch_number: string
      products?: {
        id: number
        name: string
        sku: string
      }
    }
  }
}

export default function SupplierKhaataPage() {
  const { currency, formatCurrency } = useCurrency()
  const [suppliers, setSuppliers] = useState<SupplierKhaata[]>([])
  const [initialSuppliers, setInitialSuppliers] = useState<InitialSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<SupplierKhaata | null>(null)
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    amount_paid: '',
    notes: ''
  })

  // Pay Dues modal states
  const [showPayDuesModal, setShowPayDuesModal] = useState(false)
  const [selectedForPayment, setSelectedForPayment] = useState<any>(null)
  const [paymentFormData, setPaymentFormData] = useState({
    payment_amount: '',
    payment_method: 'Cash',
    notes: ''
  })
  const [paymentHistoryBySupplier, setPaymentHistoryBySupplier] = useState<Record<number, SupplierPaymentHistory[]>>({})
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState<Record<number, boolean>>({})
  const [recorderManagerId, setRecorderManagerId] = useState<string | null>(null)
  const [recorderCashierId, setRecorderCashierId] = useState<number | null>(null)

  useEffect(() => {
    resolvePaymentRecorder()
    fetchSuppliers()
    fetchInitialSuppliers()
  }, [])

  const resolvePaymentRecorder = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        setRecorderManagerId(user.id)
        setRecorderCashierId(null)
        return
      }

      const userSession = localStorage.getItem('user_session')
      if (userSession) {
        const parsed = JSON.parse(userSession)
        const parsedCashierId = Number.parseInt(String(parsed?.id), 10)
        if (!Number.isNaN(parsedCashierId)) {
          setRecorderManagerId(null)
          setRecorderCashierId(parsedCashierId)
          return
        }
      }

      setRecorderManagerId(null)
      setRecorderCashierId(null)
    } catch (err) {
      console.error('Failed to resolve payment recorder:', err)
      setRecorderManagerId(null)
      setRecorderCashierId(null)
    }
  }

  const fetchPaymentHistory = async (supplierId: number) => {
    if (paymentHistoryBySupplier[supplierId]) {
      return
    }

    try {
      const storeId = getStoreId()
      if (!storeId) return

      setPaymentHistoryLoading((prev) => ({ ...prev, [supplierId]: true }))

      const response = await fetch(`/api/supplier-khaata-payments?store_id=${storeId}&supplier_id=${supplierId}`)
      const result = await response.json()

      if (result.success) {
        setPaymentHistoryBySupplier((prev) => ({
          ...prev,
          [supplierId]: result.data || [],
        }))
      }
    } catch (err) {
      console.error('Failed to fetch supplier payment history:', err)
    } finally {
      setPaymentHistoryLoading((prev) => ({ ...prev, [supplierId]: false }))
    }
  }

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      setError('')
      const storeId = getStoreId()
      if (!storeId) {
        setError('Store ID not found')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/supplier-khaata?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setSuppliers(result.data || [])
      } else {
        setError('Failed to fetch supplier khaata: ' + (result.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Error fetching supplier khaata:', err)
      setError('Failed to fetch supplier khaata: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const fetchInitialSuppliers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/initial-suppliers?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setInitialSuppliers(result.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch initial suppliers:', err)
    }
  }

  // Aggregate suppliers by supplier_id
  const aggregateSuppliers = (): AggregatedSupplier[] => {
    const grouped = new Map<number, SupplierKhaata[]>()
    
    suppliers.forEach(record => {
      const key = record.supplier_id
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(record)
    })

    return Array.from(grouped.values()).map(transactions => {
      const totalAmount = transactions.reduce((sum, t) => sum + t.total_amount, 0)
      const amountPaid = transactions.reduce((sum, t) => sum + t.amount_paid, 0)
      const amountRemaining = transactions.reduce((sum, t) => sum + t.amount_remaining, 0)

      return {
        supplier_id: transactions[0].supplier_id,
        supplier_name: transactions[0].supplier_name,
        supplier_phone: transactions[0].supplier_phone,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        amount_remaining: amountRemaining,
        transactions: transactions.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }
    }).sort((a, b) => b.amount_remaining - a.amount_remaining)
  }

  const toggleSupplierExpansion = (supplierId: number) => {
    const key = supplierId.toString()
    const newExpanded = new Set(expandedSuppliers)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
      fetchPaymentHistory(supplierId)
    }
    setExpandedSuppliers(newExpanded)
  }

  const aggregatedSuppliers = aggregateSuppliers()
  const filteredSuppliers = aggregatedSuppliers.filter(supplier =>
    supplier.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.supplier_phone.includes(searchTerm)
  )

  const handleEdit = (record: SupplierKhaata) => {
    setSelectedRecord(record)
    setFormData({
      amount_paid: record.amount_paid.toString(),
      notes: record.notes || ''
    })
    setShowEditModal(true)
    setError('')
  }

  const handleUpdatePayment = async () => {
    if (!selectedRecord) return

    try {
      setError('')
      const amountPaid = parseFloat(formData.amount_paid) || 0

      if (amountPaid > selectedRecord.total_amount) {
        setError('Amount paid cannot exceed total amount')
        return
      }

      const response = await fetch('/api/supplier-khaata', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRecord.id,
          amount_paid: amountPaid,
          notes: formData.notes.trim() || null
        }),
      })

      const result = await response.json()

      if (result.success) {
        setShowEditModal(false)
        fetchSuppliers()
      } else {
        setError(result.error || 'Failed to update payment')
      }
    } catch (err) {
      setError('Failed to update payment: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const handleDelete = (record: SupplierKhaata) => {
    setSelectedRecord(record)
    setShowDeleteModal(true)
    setError('')
  }

  const handlePayDues = async () => {
    if (!selectedForPayment) return

    const paymentAmount = parseFloat(paymentFormData.payment_amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setError('Please enter a valid payment amount')
      return
    }

    if (paymentAmount > selectedForPayment.amount_remaining) {
      setError('Payment amount cannot exceed remaining balance')
      return
    }

    try {
      const payload = {
        supplier_id: selectedForPayment.supplier_id,
        payment_amount: paymentAmount,
        payment_method: paymentFormData.payment_method,
        notes: paymentFormData.notes.trim() || null,
        store_id: getStoreId(),
        recorded_by: recorderManagerId,
        cashier_id: recorderCashierId,
      }

      const response = await fetch('/api/supplier-khaata-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (result.success) {
        setShowPayDuesModal(false)
        setSelectedForPayment(null)
        setPaymentFormData({ payment_amount: '', payment_method: 'Cash', notes: '' })
        setPaymentHistoryBySupplier((prev) => {
          const next = { ...prev }
          delete next[selectedForPayment.supplier_id]
          return next
        })
        fetchSuppliers()
        fetchPaymentHistory(selectedForPayment.supplier_id)
      } else {
        setError(result.error || 'Failed to record payment')
      }
    } catch (err) {
      setError('Failed to record payment: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const confirmDelete = async () => {
    if (!selectedRecord) return

    try {
      const response = await fetch(`/api/supplier-khaata?id=${selectedRecord.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        setShowDeleteModal(false)
        setSelectedRecord(null)
        fetchSuppliers()
      } else {
        setError(result.error || 'Failed to delete record')
      }
    } catch (err) {
      setError('Failed to delete record: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1">Supplier Khaata (Accounts)</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Track pending payments to suppliers
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-5">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by supplier name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && !showEditModal && !showDeleteModal && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="mx-auto mb-3 animate-pulse">
              <svg width={40} height={Math.round(40 * (1196 / 1061))} viewBox="0 0 1061 1196" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-current text-cyan-500 mx-auto"><path d="M538.795 609.092L871.505 276.381C976.486 372.749 1042.32 511.172 1042.38 664.993C1041.64 664.973 1040.9 664.949 1040.16 664.926C1046.75 665.171 1053.37 665.296 1060.02 665.298C777.219 665.385 546.193 886.933 530.915 1165.94L530.096 1180.67C530.596 1189.81 530.158 1186.07 530.102 1193.71L530.096 1195.39C530.096 1190.47 529.746 1185.56 529.88 1180.67C522.081 894.715 287.839 665.299 0 665.299C6.05981 665.299 12.0958 665.194 18.1064 664.992C18.1652 506.975 88.0333 365.252 198.592 268.889L538.795 609.092ZM674.459 135.664L538.795 271.328L403.132 135.664L538.795 0L674.459 135.664Z" /></svg>
            </div>
            <div className="w-40 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mx-auto mb-3">
              <div className="h-full bg-cyan-500 rounded-full animate-pulse" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading supplier accounts...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded">
            <PackageIcon className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {searchTerm ? 'No suppliers found matching your search' : 'No pending payments to suppliers'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-sm">Supplier</th>
                  <th className="px-4 py-3 text-left font-semibold text-sm">Contact</th>
                  <th className="px-4 py-3 text-right font-semibold text-sm">Total Amount</th>
                  <th className="px-4 py-3 text-right font-semibold text-sm">Amount Paid</th>
                  <th className="px-4 py-3 text-right font-semibold text-sm">Remaining</th>
                  <th className="px-4 py-3 text-center font-semibold text-sm">Transactions</th>
                  <th className="px-4 py-3 text-center font-semibold text-sm"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => {
                  const isExpanded = expandedSuppliers.has(supplier.supplier_id.toString())
                  
                  return (
                    <Fragment key={`supplier-block-${supplier.supplier_id}`}>
                      {/* Aggregated Row */}
                      <tr 
                        className="border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => toggleSupplierExpansion(supplier.supplier_id)}
                      >
                        <td className="px-4 py-3 font-medium text-sm text-gray-900 dark:text-white">{supplier.supplier_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{supplier.supplier_phone}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">{formatCurrency(supplier.total_amount, 0)}</td>
                        <td className="px-4 py-3 text-right text-sm text-green-600">{formatCurrency(supplier.amount_paid, 0)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-red-600">
                          {formatCurrency(supplier.amount_remaining, 0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-block px-2 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded text-xs font-medium">
                            {supplier.transactions.length}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2 justify-center">
                            {supplier.amount_remaining > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedForPayment(supplier)
                                  setPaymentFormData({ payment_amount: '', payment_method: 'Cash', notes: '' })
                                  setShowPayDuesModal(true)
                                  setError('')
                                }}
                                className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 flex items-center gap-1"
                                title="Pay Dues"
                              >
                                <CurrencyDollarIcon size={14} />
                                Pay Dues
                              </button>
                            )}
                            {isExpanded ? <CaretDownIcon className="text-gray-400" size={16} /> : <CaretRightIcon className="text-gray-400" size={16} />}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Transactions */}
                      {isExpanded && supplier.transactions.map((record) => (
                        <tr 
                          key={`transaction-${record.id}`}
                          className="border-b border-gray-100 dark:border-gray-700 bg-cyan-50 dark:bg-cyan-900/20"
                        >
                          <td className="px-4 py-2 pl-10 text-sm">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {record.stock_batches?.products?.name || 'Unknown Product'}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              Batch: {record.stock_batches?.batch_number || 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {new Date(record.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-white">
                            {formatCurrency(record.total_amount, 0)}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-green-600">
                            {formatCurrency(record.amount_paid, 0)}
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-medium text-red-600">
                            {formatCurrency(record.amount_remaining, 0)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {record.notes && (
                              <div className="text-xs italic">{record.notes}</div>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEdit(record)
                                }}
                                className="p-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors"
                                title="Edit Payment"
                              >
                                <PencilSimpleIcon className="text-gray-700 dark:text-gray-300" size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(record)
                                }}
                                className="p-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <TrashIcon size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {isExpanded && (
                        <tr className="border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[#161616]">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="rounded border border-gray-200 dark:border-gray-700">
                              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Payment History (FIFO allocations)</p>
                              </div>

                              {paymentHistoryLoading[supplier.supplier_id] ? (
                                <p className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">Loading payment history...</p>
                              ) : (paymentHistoryBySupplier[supplier.supplier_id] || []).length === 0 ? (
                                <p className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">No payment records yet.</p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                      <tr>
                                        <th className="px-3 py-2 text-left">Date</th>
                                        <th className="px-3 py-2 text-left">Reference</th>
                                        <th className="px-3 py-2 text-left">Product / Batch</th>
                                        <th className="px-3 py-2 text-right">Applied</th>
                                        <th className="px-3 py-2 text-right">Txn Remaining</th>
                                        <th className="px-3 py-2 text-right">Supplier Remaining</th>
                                        <th className="px-3 py-2 text-left">Method</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(paymentHistoryBySupplier[supplier.supplier_id] || []).map((payment) => {
                                        const productName = payment.supplier_khaata?.stock_batches?.products?.name || 'Unknown Product'
                                        const batchNumber = payment.supplier_khaata?.stock_batches?.batch_number || 'N/A'

                                        return (
                                          <tr key={`payment-${payment.id}`} className="border-t border-gray-100 dark:border-gray-700">
                                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                              {new Date(payment.payment_date).toLocaleString('en-PK', {
                                                timeZone: 'Asia/Karachi',
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: true,
                                              })}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">{payment.payment_reference || '-'}</td>
                                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                              <div>{productName}</div>
                                              <div className="text-[11px] text-gray-500 dark:text-gray-400">Batch: {batchNumber}</div>
                                            </td>
                                            <td className="px-3 py-2 text-right font-semibold text-green-600">{formatCurrency(payment.payment_amount, 0)}</td>
                                            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                                              {formatCurrency(payment.transaction_remaining_before || 0, 0)} {'->'} {formatCurrency(payment.transaction_remaining_after || 0, 0)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                                              {formatCurrency(payment.supplier_remaining_before || 0, 0)} {'->'} {formatCurrency(payment.supplier_remaining_after || 0, 0)}
                                            </td>
                                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                              <div>{payment.payment_method}</div>
                                              {payment.notes && <div className="text-[11px] text-gray-500 dark:text-gray-400">{payment.notes}</div>}
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-cyan-600 text-white font-semibold">
                  <td colSpan={2} className="px-4 py-2.5 text-sm">TOTAL</td>
                  <td className="px-4 py-2.5 text-right text-sm">
                    {formatCurrency(filteredSuppliers.reduce((sum, supplier) => sum + supplier.total_amount, 0), 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm">
                    {formatCurrency(filteredSuppliers.reduce((sum, supplier) => sum + supplier.amount_paid, 0), 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm">
                    {formatCurrency(filteredSuppliers.reduce((sum, supplier) => sum + supplier.amount_remaining, 0), 0)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

      {/* Initial Suppliers Section */}
      {initialSuppliers.length > 0 && (
        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Initial Suppliers (Migration)</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">Suppliers imported when you started using Atom</p>
          </div>
          
          <div className="border rounded overflow-hidden border-gray-200 dark:border-gray-700">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Supplier Name</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Contact Person</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Phone</th>
                  <th className="px-3 py-2.5 text-right text-sm font-semibold">Amount Owed</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Notes</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Added On</th>
                </tr>
              </thead>
              <tbody>
                {initialSuppliers.map((supplier) => (
                  <tr 
                    key={supplier.id}
                    className="border-b bg-white border-gray-100 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-white">
                      {supplier.supplier_name}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">
                      {supplier.contact_person || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">
                      {supplier.supplier_phone || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-semibold text-orange-600">
                      ${supplier.amount_owed.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                      {supplier.notes || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(supplier.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-orange-600 text-white font-semibold">
                  <td colSpan={3} className="px-3 py-2.5 text-sm">TOTAL INITIAL BALANCE</td>
                  <td className="px-3 py-2.5 text-right text-sm">
                    ${initialSuppliers.reduce((sum, s) => sum + s.amount_owed, 0).toFixed(2)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {showEditModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 p-5 max-w-md w-full">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Update Payment</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded">
              <p className="text-sm text-gray-900 dark:text-white"><strong>Supplier:</strong> {selectedRecord.supplier_name}</p>
              <p className="text-sm text-gray-900 dark:text-white"><strong>Total Amount:</strong> {formatCurrency(selectedRecord.total_amount, 0)}</p>
              <p className="text-sm text-gray-900 dark:text-white"><strong>Current Remaining:</strong> {formatCurrency(selectedRecord.amount_remaining, 0)}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Amount Paid <span className="text-red-600">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedRecord.total_amount}
                  value={formData.amount_paid}
                  onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                  title="Amount paid"
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                />
                {formData.amount_paid && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    New Remaining: {formatCurrency(selectedRecord.total_amount - parseFloat(formData.amount_paid || '0'), 0)}
                  </p>
                )}
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  rows={3}
                  placeholder="Add any notes..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePayment}
                className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 p-5 max-w-md w-full">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete Record</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <p className="mb-5 text-sm text-gray-900 dark:text-white">
              Are you sure you want to delete this payment record for <strong>{selectedRecord.supplier_name}</strong>?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Dues Modal */}
      {showPayDuesModal && selectedForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 p-5 max-w-md w-full">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pay Supplier Dues</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded">
              <p className="text-sm text-gray-900 dark:text-white"><strong>Supplier:</strong> {selectedForPayment.supplier_name}</p>
              <p className="text-sm text-gray-900 dark:text-white"><strong>Phone:</strong> {selectedForPayment.supplier_phone}</p>
              <p className="text-sm text-gray-900 dark:text-white"><strong>Total Amount:</strong> {formatCurrency(selectedForPayment.total_amount, 0)}</p>
              <p className="text-sm text-gray-900 dark:text-white"><strong>Amount Paid:</strong> {formatCurrency(selectedForPayment.amount_paid, 0)}</p>
              <p className="text-sm text-red-600 font-semibold"><strong>Remaining Balance:</strong> {formatCurrency(selectedForPayment.amount_remaining, 0)}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Payment Amount <span className="text-red-600">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedForPayment.amount_remaining}
                  value={paymentFormData.payment_amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  placeholder="Enter payment amount"
                />
                {paymentFormData.payment_amount && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    New Remaining: {formatCurrency(selectedForPayment.amount_remaining - parseFloat(paymentFormData.payment_amount || '0'), 0)}
                  </p>
                )}
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Payment Method <span className="text-red-600">*</span></label>
                <select
                  value={paymentFormData.payment_method}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value })}
                  title="Payment method"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="Digital">Digital</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  rows={3}
                  placeholder="Add any notes..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setShowPayDuesModal(false)
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handlePayDues}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

