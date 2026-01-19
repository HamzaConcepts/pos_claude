'use client'

import { useEffect, useState } from 'react'
import { Search, Edit, Trash2, ChevronDown, ChevronRight, Package, DollarSign } from 'lucide-react'
import { getStoreId } from '@/lib/supabase'
import { useDarkMode } from '@/hooks/useDarkMode'

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

export default function SupplierKhaataPage() {
  const isDarkMode = useDarkMode()
  const [suppliers, setSuppliers] = useState<SupplierKhaata[]>([])
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

  useEffect(() => {
    fetchSuppliers()
  }, [])

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
        store_id: getStoreId()
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
        fetchSuppliers()
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
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Supplier Khaata (Accounts)</h1>
          <p className="text-sm text-gray-600">
            Track pending payments to suppliers
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by supplier name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
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
            <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${isDarkMode ? 'border-cyan-500' : 'border-black'}`}></div>
            <p className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading supplier accounts...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-300 rounded">
            <Package className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-sm text-gray-600">
              {searchTerm ? 'No suppliers found matching your search' : 'No pending payments to suppliers'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-700">
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
                    <>
                      {/* Aggregated Row */}
                      <tr 
                        key={`supplier-${supplier.supplier_id}`}
                        className="border-b border-gray-100 bg-white hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleSupplierExpansion(supplier.supplier_id)}
                      >
                        <td className="px-4 py-3 font-medium text-sm text-gray-900">{supplier.supplier_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{supplier.supplier_phone}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">Rs. {supplier.total_amount.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-sm text-green-600">Rs. {supplier.amount_paid.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-red-600">
                          Rs. {supplier.amount_remaining.toLocaleString()}
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
                                <DollarSign size={14} />
                                Pay Dues
                              </button>
                            )}
                            {isExpanded ? <ChevronDown className="text-gray-400" size={16} /> : <ChevronRight className="text-gray-400" size={16} />}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Transactions */}
                      {isExpanded && supplier.transactions.map((record) => (
                        <tr 
                          key={`transaction-${record.id}`}
                          className="border-b border-gray-100 bg-cyan-50"
                        >
                          <td className="px-4 py-2 pl-10 text-sm">
                            <div className="font-medium text-gray-900">
                              {record.stock_batches?.products?.name || 'Unknown Product'}
                            </div>
                            <div className="text-xs text-gray-600">
                              Batch: {record.stock_batches?.batch_number || 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {new Date(record.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-900">
                            Rs. {record.total_amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-green-600">
                            Rs. {record.amount_paid.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-medium text-red-600">
                            Rs. {record.amount_remaining.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
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
                                className="p-1.5 border border-gray-300 rounded hover:bg-cyan-100 transition-colors"
                                title="Edit Payment"
                              >
                                <Edit className="text-gray-700" size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(record)
                                }}
                                className="p-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      {/* Edit Payment Modal */}
      {showEditModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border border-gray-200 p-5 max-w-md w-full">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Update Payment</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
              <p className="text-sm text-gray-900"><strong>Supplier:</strong> {selectedRecord.supplier_name}</p>
              <p className="text-sm text-gray-900"><strong>Total Amount:</strong> Rs. {selectedRecord.total_amount.toLocaleString()}</p>
              <p className="text-sm text-gray-900"><strong>Current Remaining:</strong> Rs. {selectedRecord.amount_remaining.toLocaleString()}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">Amount Paid <span className="text-red-600">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedRecord.total_amount}
                  value={formData.amount_paid}
                  onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                />
                {formData.amount_paid && (
                  <p className="text-sm text-gray-600 mt-1">
                    New Remaining: Rs. {(selectedRecord.total_amount - parseFloat(formData.amount_paid || '0')).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
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
          <div className="bg-white rounded border border-gray-200 p-5 max-w-md w-full">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Delete Record</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <p className="mb-5 text-sm text-gray-900">
              Are you sure you want to delete this payment record for <strong>{selectedRecord.supplier_name}</strong>?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
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
          <div className="bg-white rounded border border-gray-200 p-5 max-w-md w-full">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pay Supplier Dues</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
              <p className="text-sm text-gray-900"><strong>Supplier:</strong> {selectedForPayment.supplier_name}</p>
              <p className="text-sm text-gray-900"><strong>Phone:</strong> {selectedForPayment.supplier_phone}</p>
              <p className="text-sm text-gray-900"><strong>Total Amount:</strong> Rs. {selectedForPayment.total_amount.toLocaleString()}</p>
              <p className="text-sm text-gray-900"><strong>Amount Paid:</strong> Rs. {selectedForPayment.amount_paid.toLocaleString()}</p>
              <p className="text-sm text-red-600 font-semibold"><strong>Remaining Balance:</strong> Rs. {selectedForPayment.amount_remaining.toLocaleString()}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">Payment Amount <span className="text-red-600">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedForPayment.amount_remaining}
                  value={paymentFormData.payment_amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="Enter payment amount"
                />
                {paymentFormData.payment_amount && (
                  <p className="text-sm text-gray-600 mt-1">
                    New Remaining: Rs. {(selectedForPayment.amount_remaining - parseFloat(paymentFormData.payment_amount || '0')).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">Payment Method <span className="text-red-600">*</span></label>
                <select
                  value={paymentFormData.payment_method}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Check">Check</option>
                  <option value="Digital">Digital</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">Notes</label>
                <textarea
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
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

