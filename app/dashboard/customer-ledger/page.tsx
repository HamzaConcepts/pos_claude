'use client'

import { useEffect, useState } from 'react'
import { UserCircleIcon, MagnifyingGlassIcon, PencilSimpleIcon, TrashIcon, CaretDownIcon, CaretRightIcon, CurrencyDollarIcon } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { getStoreId, isManager, getCashierId } from '@/lib/supabase'
import { useDarkMode } from '@/hooks/useDarkMode'

interface KhaataCustomer {
  id: number
  sale_id: number
  customer_name: string
  customer_phone: string
  total_amount: number
  amount_paid: number
  amount_remaining: number
  notes: string | null
  store_id: number
  created_at: string
  updated_at?: string
  sales?: {
    sale_description: string | null
  }
}

interface AggregatedCustomer {
  customer_name: string
  customer_phone: string
  total_amount: number
  amount_paid: number
  amount_remaining: number
  transactions: KhaataCustomer[]
}

interface InitialCustomer {
  id: number
  customer_name: string
  customer_cnic: string | null
  customer_phone: string | null
  amount_owed: number
  notes: string | null
  created_at: string
}

export default function CustomerLedgerPage() {
  const router = useRouter()
  const isDarkMode = useDarkMode()
  const [customers, setCustomers] = useState<KhaataCustomer[]>([])
  const [initialCustomers, setInitialCustomers] = useState<InitialCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set())

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<KhaataCustomer | null>(null)
  const [editFormData, setEditFormData] = useState({
    amount_paid: '',
    payment_method: 'Cash',
    notes: ''
  })

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<KhaataCustomer | null>(null)

  // Pay Dues modal states
  const [showPayDuesModal, setShowPayDuesModal] = useState(false)
  const [selectedForPayment, setSelectedForPayment] = useState<any>(null)
  const [paymentFormData, setPaymentFormData] = useState({
    payment_amount: '',
    payment_method: 'Cash',
    notes: ''
  })

  useEffect(() => {
    fetchCustomers()
    fetchInitialCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        router.push('/login')
        return
      }

      const response = await fetch(`/api/partial-payment-customers?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setCustomers(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to fetch customers')
    } finally {
      setLoading(false)
    }
  }

  const fetchInitialCustomers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/initial-customers?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setInitialCustomers(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch initial customers:', err)
    }
  }

  const aggregateCustomers = (): AggregatedCustomer[] => {
    const grouped = new Map<string, AggregatedCustomer>()

    customers.forEach(customer => {
      const key = customer.customer_phone
      if (!grouped.has(key)) {
        grouped.set(key, {
          customer_name: customer.customer_name,
          customer_phone: customer.customer_phone,
          total_amount: 0,
          amount_paid: 0,
          amount_remaining: 0,
          transactions: []
        })
      }
      
      const agg = grouped.get(key)!
      agg.total_amount += customer.total_amount
      agg.amount_paid += customer.amount_paid
      agg.amount_remaining += customer.amount_remaining
      agg.transactions.push(customer)
    })

    return Array.from(grouped.values()).sort((a, b) => 
      b.amount_remaining - a.amount_remaining
    )
  }

  const toggleCustomerExpansion = (phone: string) => {
    const newExpanded = new Set(expandedCustomers)
    if (newExpanded.has(phone)) {
      newExpanded.delete(phone)
    } else {
      newExpanded.add(phone)
    }
    setExpandedCustomers(newExpanded)
  }

  const openEditModal = (customer: KhaataCustomer) => {
    setSelectedCustomer(customer)
    setEditFormData({
      amount_paid: customer.amount_paid.toString(),
      payment_method: 'Cash',
      notes: customer.notes || ''
    })
    setShowEditModal(true)
    setError('')
  }

  const handleUpdate = async () => {
    if (!selectedCustomer) return

    try {
      const response = await fetch('/api/partial-payment-customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedCustomer.id,
          amount_paid: parseFloat(editFormData.amount_paid),
          notes: editFormData.notes
        })
      })

      const result = await response.json()

      if (result.success) {
        setShowEditModal(false)
        setSelectedCustomer(null)
        fetchCustomers()
      } else {
        setError(result.error || 'Failed to update customer')
      }
    } catch (err) {
      setError('Failed to update customer')
    }
  }

  const handleDeleteCustomer = (id: number) => {
    const customer = customers.find(c => c.id === id)
    if (customer) {
      setCustomerToDelete(customer)
      setShowDeleteModal(true)
    }
  }

  const confirmDelete = async () => {
    if (!customerToDelete) return

    try {
      const response = await fetch('/api/partial-payment-customers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: customerToDelete.id })
      })

      const result = await response.json()

      if (result.success) {
        setShowDeleteModal(false)
        setCustomerToDelete(null)
        fetchCustomers()
      } else {
        setError(result.error || 'Failed to delete customer')
      }
    } catch (err) {
      setError('Failed to delete customer')
    }
  }

  const handlePayDues = async () => {
    if (!selectedForPayment) return

    const paymentAmount = parseFloat(paymentFormData.payment_amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setError('Please enter a valid payment amount')
      return
    }

    if (paymentAmount > selectedForPayment.remaining_balance) {
      setError('Payment amount cannot exceed remaining balance')
      return
    }

    try {
      const payload = {
        customer_phone: selectedForPayment.customer_phone,
        payment_amount: paymentAmount,
        payment_method: paymentFormData.payment_method,
        notes: paymentFormData.notes.trim() || null,
        store_id: getStoreId()
      }

      const response = await fetch('/api/khaata-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (result.success) {
        setShowPayDuesModal(false)
        setSelectedForPayment(null)
        setPaymentFormData({ payment_amount: '', payment_method: 'Cash', notes: '' })
        fetchCustomers()
      } else {
        setError(result.error || 'Failed to record payment')
      }
    } catch (err) {
      setError('Failed to record payment: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const aggregatedCustomers = aggregateCustomers()
  const filteredAggregatedCustomers = aggregatedCustomers.filter(customer =>
    customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.customer_phone.includes(searchTerm)
  )

  return (
    <div className="animate-fadeIn">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Customer Ledger</h1>
        <p className="text-xs text-gray-600">View and manage customer accounts with outstanding balances</p>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
          />
        </div>
      </div>

      {/* Info Message */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
        <p className="text-blue-900">
          <strong>ℹ️ Note:</strong> Customers are automatically added when partial payments are made in POS. 
          Use the Edit button to update payment status or add notes.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Customers Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${isDarkMode ? 'border-cyan-500' : 'border-black'}`}></div>
          <p className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading customers...</p>
        </div>
      ) : filteredAggregatedCustomers.length === 0 ? (
        <div className="text-center py-8 border border-gray-200 rounded">
          <p className="text-gray-500 text-sm">No customers found</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-gray-700 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left w-12"></th>
                <th className="px-3 py-2.5 text-left text-sm font-semibold">Customer Name</th>
                <th className="px-3 py-2.5 text-left text-sm font-semibold">Phone Number</th>
                <th className="px-3 py-2.5 text-right text-sm font-semibold">Total Owed</th>
                <th className="px-3 py-2.5 text-right text-sm font-semibold">Total Paid</th>
                <th className="px-3 py-2.5 text-right text-sm font-semibold">Remaining Balance</th>
                <th className="px-3 py-2.5 text-center text-sm font-semibold">Transactions</th>
                <th className="px-3 py-2.5 text-center text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAggregatedCustomers.map((customer) => {
                const isExpanded = expandedCustomers.has(customer.customer_phone)
                return (
                  <>
                    {/* Aggregated Row */}
                    <tr 
                      key={customer.customer_phone} 
                      className="cursor-pointer hover:bg-gray-50 border-b border-gray-100 bg-white"
                      onClick={() => toggleCustomerExpansion(customer.customer_phone)}
                    >
                      <td className="px-3 py-2.5">
                        {isExpanded ? <CaretDownIcon size={16} className="text-gray-400" /> : <CaretRightIcon size={16} className="text-gray-400" />}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-sm text-gray-900">{customer.customer_name}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-900">{customer.customer_phone}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-sm text-gray-900">${customer.total_amount.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-green-600 font-semibold text-sm">${customer.amount_paid.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-sm text-orange-600">
                        ${customer.amount_remaining.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium">
                          {customer.transactions.length}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedForPayment({
                              type: 'customer',
                              customer_name: customer.customer_name,
                              customer_phone: customer.customer_phone,
                              remaining_balance: customer.amount_remaining
                            })
                            setShowPayDuesModal(true)
                          }}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium flex items-center gap-1 mx-auto"
                          disabled={customer.amount_remaining <= 0}
                        >
                          <CurrencyDollarIcon size={14} />
                          Pay Dues
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Transactions */}
                    {isExpanded && customer.transactions.map((transaction) => (
                      <tr 
                        key={transaction.id}
                        className="bg-cyan-50 border-t border-cyan-200"
                      >
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2" colSpan={2}>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-700 font-medium">
                              {transaction.sales?.sale_description || `Sale #${transaction.sale_id}`}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600">{new Date(transaction.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}</span>
                            {transaction.notes && (
                              <>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600 italic">{transaction.notes}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-gray-900">${transaction.total_amount.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-sm text-green-600">${transaction.amount_paid.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-sm font-medium text-orange-600">
                          ${transaction.amount_remaining.toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditModal(transaction)
                              }}
                              className="p-1.5 hover:bg-cyan-100 rounded transition-colors"
                              title="Edit"
                            >
                              <PencilSimpleIcon size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteCustomer(transaction.id)
                              }}
                              className="p-1.5 hover:bg-red-100 rounded transition-colors text-status-error"
                              title="Delete"
                            >
                              <TrashIcon size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-cyan-600 text-white font-semibold">
                <td colSpan={3} className="px-3 py-2.5 text-sm">TOTAL</td>
                <td className="px-3 py-2.5 text-right text-sm">
                  ${filteredAggregatedCustomers.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm">
                  ${filteredAggregatedCustomers.reduce((sum, c) => sum + c.amount_paid, 0).toFixed(2)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm">
                  ${filteredAggregatedCustomers.reduce((sum, c) => sum + c.amount_remaining, 0).toFixed(2)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Initial Customers Section */}
      {initialCustomers.length > 0 && (
        <div className="mt-8">
          <div className="mb-4">
            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Initial Customers (Migration)</h2>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Customers imported when you started using this POS system</p>
          </div>
          
          <div className={`border rounded overflow-hidden ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <table className="w-full">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Customer Name</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Phone</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">CNIC</th>
                  <th className="px-3 py-2.5 text-right text-sm font-semibold">Amount Owed</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Notes</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Added On</th>
                </tr>
              </thead>
              <tbody>
                {initialCustomers.map((customer) => (
                  <tr 
                    key={customer.id}
                    className={`border-b ${isDarkMode ? 'bg-gray-900 border-gray-700 hover:bg-gray-800' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                  >
                    <td className={`px-3 py-2.5 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {customer.customer_name}
                    </td>
                    <td className={`px-3 py-2.5 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {customer.customer_phone || '-'}
                    </td>
                    <td className={`px-3 py-2.5 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {customer.customer_cnic || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-semibold text-orange-600">
                      ${customer.amount_owed.toFixed(2)}
                    </td>
                    <td className={`px-3 py-2.5 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {customer.notes || '-'}
                    </td>
                    <td className={`px-3 py-2.5 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {new Date(customer.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-orange-600 text-white font-semibold">
                  <td colSpan={3} className="px-3 py-2.5 text-sm">TOTAL INITIAL BALANCE</td>
                  <td className="px-3 py-2.5 text-right text-sm">
                    ${initialCustomers.reduce((sum, c) => sum + c.amount_owed, 0).toFixed(2)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Pay Dues Modal */}
      {showPayDuesModal && selectedForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Pay Dues - {selectedForPayment.customer_name}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <p className="text-blue-900">
                <strong>Current Balance:</strong> ${selectedForPayment.remaining_balance.toFixed(2)}
              </p>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">Payment Amount*</label>
                <input
                  type="number"
                  value={paymentFormData.payment_amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="Enter payment amount"
                  step="0.01"
                  min="0"
                  max={selectedForPayment.remaining_balance}
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">Payment Method*</label>
                <select
                  value={paymentFormData.payment_method}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                >
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Mobile Payment">Mobile Payment</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">Notes</label>
                <textarea
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  rows={3}
                  placeholder="Add payment notes..."
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPayDuesModal(false)
                  setSelectedForPayment(null)
                  setPaymentFormData({ payment_amount: '', payment_method: 'Cash', notes: '' })
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
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
