'use client'

import { useEffect, useState } from 'react'
import { Search, Edit, Trash2, ChevronDown, ChevronRight, Package } from 'lucide-react'
import { getStoreId } from '@/lib/supabase'

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
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Supplier Khaata (Accounts)</h1>
          <p className="text-text-secondary">
            Track pending payments to suppliers
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
            <input
              type="text"
              placeholder="Search by supplier name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border-2 border-black rounded focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && !showEditModal && !showDeleteModal && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-500 rounded">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-black border-t-transparent"></div>
            <p className="mt-4 text-text-secondary">Loading supplier accounts...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded">
            <Package className="mx-auto mb-4 text-text-secondary" size={48} />
            <p className="text-text-secondary">
              {searchTerm ? 'No suppliers found matching your search' : 'No pending payments to suppliers'}
            </p>
          </div>
        ) : (
          <div className="bg-white border-2 border-black rounded overflow-hidden">
            <table className="w-full">
              <thead className="bg-black text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-bold">Supplier</th>
                  <th className="px-6 py-4 text-left font-bold">Contact</th>
                  <th className="px-6 py-4 text-right font-bold">Total Amount</th>
                  <th className="px-6 py-4 text-right font-bold">Amount Paid</th>
                  <th className="px-6 py-4 text-right font-bold">Remaining</th>
                  <th className="px-6 py-4 text-center font-bold">Transactions</th>
                  <th className="px-6 py-4 text-center font-bold"></th>
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
                        className="border-t-2 border-black hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleSupplierExpansion(supplier.supplier_id)}
                      >
                        <td className="px-6 py-4 font-medium">{supplier.supplier_name}</td>
                        <td className="px-6 py-4 text-text-secondary">{supplier.supplier_phone}</td>
                        <td className="px-6 py-4 text-right">Rs. {supplier.total_amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-green-600">Rs. {supplier.amount_paid.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-bold text-red-600">
                          Rs. {supplier.amount_remaining.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                            {supplier.transactions.length}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </td>
                      </tr>

                      {/* Expanded Transactions */}
                      {isExpanded && supplier.transactions.map((record) => (
                        <tr 
                          key={`transaction-${record.id}`}
                          className="border-t border-gray-200 bg-blue-50"
                        >
                          <td className="px-6 py-3 pl-12 text-sm">
                            <div className="font-medium">
                              {record.stock_batches?.products?.name || 'Unknown Product'}
                            </div>
                            <div className="text-xs text-text-secondary">
                              Batch: {record.stock_batches?.batch_number || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-sm text-text-secondary">
                            {new Date(record.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3 text-right text-sm">
                            Rs. {record.total_amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-3 text-right text-sm text-green-600">
                            Rs. {record.amount_paid.toLocaleString()}
                          </td>
                          <td className="px-6 py-3 text-right text-sm font-medium text-red-600">
                            Rs. {record.amount_remaining.toLocaleString()}
                          </td>
                          <td className="px-6 py-3 text-sm text-text-secondary">
                            {record.notes && (
                              <div className="text-xs italic">{record.notes}</div>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEdit(record)
                                }}
                                className="p-2 border-2 border-black rounded hover:bg-gray-100"
                                title="Edit Payment"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDelete(record)
                                }}
                                className="p-2 border-2 border-red-500 text-red-500 rounded hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 size={16} />
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
      </div>

      {/* Edit Payment Modal */}
      {showEditModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border-2 border-black p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Update Payment</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 rounded">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm"><strong>Supplier:</strong> {selectedRecord.supplier_name}</p>
              <p className="text-sm"><strong>Total Amount:</strong> Rs. {selectedRecord.total_amount.toLocaleString()}</p>
              <p className="text-sm"><strong>Current Remaining:</strong> Rs. {selectedRecord.amount_remaining.toLocaleString()}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block mb-2 font-medium">Amount Paid *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedRecord.total_amount}
                  value={formData.amount_paid}
                  onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                />
                {formData.amount_paid && (
                  <p className="text-sm text-text-secondary mt-1">
                    New Remaining: Rs. {(selectedRecord.total_amount - parseFloat(formData.amount_paid || '0')).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <label className="block mb-2 font-medium">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                  rows={3}
                  placeholder="Add any notes..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setError('')
                }}
                className="flex-1 px-4 py-2 border-2 border-black rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePayment}
                className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border-2 border-black p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Delete Record</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 rounded">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <p className="mb-6">
              Are you sure you want to delete this payment record for <strong>{selectedRecord.supplier_name}</strong>?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setError('')
                }}
                className="flex-1 px-4 py-2 border-2 border-black rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
