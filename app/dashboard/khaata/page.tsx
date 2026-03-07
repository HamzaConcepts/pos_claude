'use client'

import { useEffect, useState } from 'react'
import { UserCircleIcon, BuildingsIcon, MagnifyingGlassIcon, PencilSimpleIcon, TrashIcon, CaretDownIcon, CaretRightIcon, PackageIcon, CurrencyDollarIcon } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { getStoreId, getManagerId, getCashierId } from '@/lib/supabase'
import { useCurrency } from '@/lib/currency-context'
import { Skeleton } from '@/components/ui/Skeleton'

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

export default function KhaataPage() {
  const router = useRouter()
  const { currency, formatCurrency } = useCurrency()
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers')
  
  // Customer state
  const [customers, setCustomers] = useState<KhaataCustomer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<KhaataCustomer | null>(null)
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set())
  
  // Supplier state
  const [suppliers, setSuppliers] = useState<SupplierKhaata[]>([])
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierKhaata | null>(null)
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set())
  
  // Shared state
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [error, setError] = useState('')
  
  // Pay Dues state
  const [showPayDuesModal, setShowPayDuesModal] = useState(false)
  const [selectedForPayment, setSelectedForPayment] = useState<any>(null)
  const [paymentFormData, setPaymentFormData] = useState({
    payment_amount: '',
    payment_method: 'Cash',
    notes: ''
  })
  
  // Customer form data
  const [customerFormData, setCustomerFormData] = useState({
    customer_name: '',
    customer_phone: '',
    total_amount: '',
    amount_paid: '',
    notes: ''
  })
  
  // Supplier form data
  const [supplierFormData, setSupplierFormData] = useState({
    amount_paid: '',
    notes: ''
  })

  useEffect(() => {
    if (activeTab === 'customers') {
      fetchCustomers()
    } else if (activeTab === 'suppliers') {
      fetchSuppliers()
    }
  }, [activeTab])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      setError('')
      
      const storeId = getStoreId()
      if (!storeId) {
        setError('Store ID not found')
        setLoading(false)
        return
      }
      
      const response = await fetch(`/api/khaata-customers?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setCustomers(result.data)
      } else {
        setError('Failed to fetch customers: ' + (result.error || 'Unknown error'))
      }
    } catch (err) {
      setError('Failed to fetch customers: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  // Aggregate customers by phone number
  const aggregateCustomers = (): AggregatedCustomer[] => {
    const grouped = new Map<string, KhaataCustomer[]>()
    
    customers.forEach(customer => {
      const key = customer.customer_phone
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(customer)
    })

    return Array.from(grouped.values()).map(transactions => {
      const totalAmount = transactions.reduce((sum, t) => sum + t.total_amount, 0)
      const amountPaid = transactions.reduce((sum, t) => sum + t.amount_paid, 0)
      const amountRemaining = transactions.reduce((sum, t) => sum + t.amount_remaining, 0)

      return {
        customer_name: transactions[0].customer_name,
        customer_phone: transactions[0].customer_phone,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        amount_remaining: amountRemaining,
        transactions: transactions.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }
    }).sort((a, b) => b.amount_remaining - a.amount_remaining)
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

  const aggregatedCustomers = aggregateCustomers()
  const filteredAggregatedCustomers = aggregatedCustomers.filter(customer =>
    customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.customer_phone.includes(searchTerm)
  )

  const handleEditCustomer = async () => {
    if (!selectedCustomer) return

    try {
      setError('')

      const totalAmount = parseFloat(customerFormData.total_amount) || 0
      const amountPaid = parseFloat(customerFormData.amount_paid) || 0

      const response = await fetch(`/api/khaata-customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_name: customerFormData.customer_name.trim(),
          customer_phone: customerFormData.customer_phone.trim(),
          total_amount: totalAmount,
          amount_paid: amountPaid,
          notes: customerFormData.notes.trim() || null
        }),
      })

      const result = await response.json()

      if (result.success) {
        setShowEditModal(false)
        setSelectedCustomer(null)
        setCustomerFormData({
          customer_name: '',
          customer_phone: '',
          total_amount: '',
          amount_paid: '',
          notes: ''
        })
        fetchCustomers()
      } else {
        setError(result.error || 'Failed to update customer')
      }
    } catch (err) {
      setError('Failed to update customer')
    }
  }

  const handleDeleteCustomer = async (id: number) => {
    if (!confirm('Are you sure you want to delete this customer?')) return

    try {
      const response = await fetch(`/api/khaata-customers/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        fetchCustomers()
      } else {
        setError(result.error || 'Failed to delete customer')
      }
    } catch (err) {
      setError('Failed to delete customer')
    }
  }

  const openEditModal = (customer: KhaataCustomer) => {
    setSelectedCustomer(customer)
    setCustomerFormData({
      customer_name: customer.customer_name,
      customer_phone: customer.customer_phone,
      total_amount: customer.total_amount.toString(),
      amount_paid: customer.amount_paid.toString(),
      notes: customer.notes || ''
    })
    setShowEditModal(true)
  }

  // ========== SUPPLIER FUNCTIONS ==========

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

  const handleEditSupplier = (record: SupplierKhaata) => {
    setSelectedSupplier(record)
    setSupplierFormData({
      amount_paid: record.amount_paid.toString(),
      notes: record.notes || ''
    })
    setShowEditModal(true)
    setError('')
  }

  const handleUpdateSupplierPayment = async () => {
    if (!selectedSupplier) return

    try {
      setError('')
      const amountPaid = parseFloat(supplierFormData.amount_paid) || 0

      if (amountPaid > selectedSupplier.total_amount) {
        setError('Amount paid cannot exceed total amount')
        return
      }

      const response = await fetch('/api/supplier-khaata', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedSupplier.id,
          amount_paid: amountPaid,
          notes: supplierFormData.notes.trim() || null
        }),
      })

      const result = await response.json()

      if (result.success) {
        setShowEditModal(false)
        setSelectedSupplier(null)
        fetchSuppliers()
      } else {
        setError(result.error || 'Failed to update payment')
      }
    } catch (err) {
      setError('Failed to update payment: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const handleDeleteSupplier = (record: SupplierKhaata) => {
    setSelectedSupplier(record)
    setShowDeleteModal(true)
    setError('')
  }

  const confirmDeleteSupplier = async () => {
    if (!selectedSupplier) return

    try {
      const response = await fetch(`/api/supplier-khaata?id=${selectedSupplier.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        setShowDeleteModal(false)
        setSelectedSupplier(null)
        fetchSuppliers()
      } else {
        setError(result.error || 'Failed to delete record')
      }
    } catch (err) {
      setError('Failed to delete record: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  // Handle Pay Dues functionality
  const handlePayDues = async () => {
    if (!selectedForPayment) return

    try {
      setError('')
      const amount = parseFloat(paymentFormData.payment_amount)
      
      if (amount <= 0) {
        setError('Payment amount must be greater than 0')
        return
      }
      
      if (amount > selectedForPayment.remaining) {
        setError('Payment amount cannot exceed remaining balance')
        return
      }

      const storeId = getStoreId()
      const managerId = await getManagerId()
      const cashierId = getCashierId()

      const endpoint = selectedForPayment.type === 'customer' 
        ? '/api/khaata-payments'
        : '/api/supplier-khaata-payments'

      const payload = {
        [selectedForPayment.type === 'customer' ? 'partial_payment_customer_id' : 'supplier_khaata_id']: selectedForPayment.id,
        payment_amount: amount,
        payment_method: paymentFormData.payment_method,
        notes: paymentFormData.notes.trim() || null,
        store_id: storeId,
        recorded_by: managerId,
        cashier_id: cashierId
      }

      // Add sale_id for customer payments
      if (selectedForPayment.type === 'customer' && selectedForPayment.sale_id) {
        payload.sale_id = selectedForPayment.sale_id
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (result.success) {
        setShowPayDuesModal(false)
        setSelectedForPayment(null)
        setPaymentFormData({ payment_amount: '', payment_method: 'Cash', notes: '' })
        
        // Refresh the appropriate list
        if (selectedForPayment.type === 'customer') {
          fetchCustomers()
        } else {
          fetchSuppliers()
        }
      } else {
        setError(result.error || 'Failed to record payment')
      }
    } catch (err) {
      setError('Failed to record payment: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  return (
    <div className="animate-fadeIn">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1">Khaata System</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400">View and manage customer accounts with outstanding balances</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'customers'
              ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 border-cyan-600'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 border-transparent'
          }`}
        >
          <div className="flex items-center gap-2">
            <UserCircleIcon size={16} />
            <span>Customers</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'suppliers'
              ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 border-cyan-600'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 border-transparent'
          }`}
        >
          <div className="flex items-center gap-2">
            <BuildingsIcon size={16} />
            <span>Suppliers</span>
          </div>
        </button>
      </div>

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div>
          {/* Search Only (removed Add button since customers come from sales) */}
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
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Customers Table */}
          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1.5" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-5 w-20 mb-1" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAggregatedCustomers.length === 0 ? (
            <div className="text-center py-8 border border-gray-200 dark:border-gray-700 rounded">
              <p className="text-gray-500 dark:text-gray-400 text-sm">No customers found</p>
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
                  {filteredAggregatedCustomers.map((customer, index) => {
                    const isExpanded = expandedCustomers.has(customer.customer_phone)
                    return (
                      <>
                        {/* Aggregated Row */}
                        <tr 
                          key={customer.customer_phone} 
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1a1a1a]"
                          onClick={() => toggleCustomerExpansion(customer.customer_phone)}
                        >
                          <td className="px-3 py-2.5">
                            {isExpanded ? <CaretDownIcon size={16} className="text-gray-400" /> : <CaretRightIcon size={16} className="text-gray-400" />}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-sm text-gray-900 dark:text-white">{customer.customer_name}</td>
                          <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-gray-300">{customer.customer_phone}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-sm text-gray-900 dark:text-white">{formatCurrency(customer.total_amount, 2)}</td>
                          <td className="px-3 py-2.5 text-right text-green-600 font-semibold text-sm">{formatCurrency(customer.amount_paid, 2)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-sm text-orange-600">
                            {formatCurrency(customer.amount_remaining, 2)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded text-xs font-medium">
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
                        {isExpanded && customer.transactions.map((transaction, txIndex) => (
                          <tr 
                            key={transaction.id}
                            className="bg-cyan-50 dark:bg-cyan-900/20 border-t border-cyan-200 dark:border-cyan-800"
                          >
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2" colSpan={2}>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-700 dark:text-gray-300 font-medium">
                                  {transaction.sales?.sale_description || `Sale #${transaction.sale_id}`}
                                </span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600 dark:text-gray-400">{new Date(transaction.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}</span>
                                {transaction.notes && (
                                  <>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-600 dark:text-gray-400 italic">{transaction.notes}</span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-sm text-gray-900 dark:text-white">{formatCurrency(transaction.total_amount, 2)}</td>
                            <td className="px-3 py-2 text-right text-sm text-green-600">{formatCurrency(transaction.amount_paid, 2)}</td>
                            <td className="px-3 py-2 text-right text-sm font-medium text-orange-600">
                              {formatCurrency(transaction.amount_remaining, 2)}
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
                                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors text-status-error"
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
                      {formatCurrency(filteredAggregatedCustomers.reduce((sum, c) => sum + c.total_amount, 0), 2)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm">
                      {formatCurrency(filteredAggregatedCustomers.reduce((sum, c) => sum + c.amount_paid, 0), 2)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm">
                      {formatCurrency(filteredAggregatedCustomers.reduce((sum, c) => sum + c.amount_remaining, 0), 2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Suppliers Tab */}
      {activeTab === 'suppliers' && (
        <div>
          {/* Search */}
          <div className="flex gap-3 mb-5">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search by supplier name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Info Message */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm">
            <p className="text-blue-900 dark:text-blue-300">
              <strong>ℹ️ Note:</strong> Suppliers are automatically added when making partial payments for inventory purchases. 
              Use the Edit button to update payment status or add notes.
            </p>
          </div>

          {/* Error Message */}
          {error && !showEditModal && !showDeleteModal && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Suppliers Table */}
          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1.5" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-5 w-20 mb-1" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-600 rounded">
              <PackageIcon className="mx-auto mb-4 text-gray-400" size={40} />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {searchTerm ? 'No suppliers found matching your search' : 'No pending payments to suppliers'}
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-3 py-2.5 text-left w-12"></th>
                    <th className="px-3 py-2.5 text-left text-sm font-semibold">Supplier Name</th>
                    <th className="px-3 py-2.5 text-left text-sm font-semibold">Phone Number</th>
                    <th className="px-3 py-2.5 text-right text-sm font-semibold">Total Amount</th>
                    <th className="px-3 py-2.5 text-right text-sm font-semibold">Amount Paid</th>
                    <th className="px-3 py-2.5 text-right text-sm font-semibold">Remaining</th>
                    <th className="px-3 py-2.5 text-center text-sm font-semibold">Transactions</th>
                    <th className="px-3 py-2.5 text-center text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier, index) => {
                    const isExpanded = expandedSuppliers.has(supplier.supplier_id.toString())
                    return (
                      <>
                        {/* Aggregated Row */}
                        <tr 
                          key={`supplier-${supplier.supplier_id}`}
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1a1a1a]"
                          onClick={() => toggleSupplierExpansion(supplier.supplier_id)}
                        >
                          <td className="px-3 py-2.5">
                            {isExpanded ? <CaretDownIcon size={16} className="text-gray-400" /> : <CaretRightIcon size={16} className="text-gray-400" />}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-sm text-gray-900 dark:text-white">{supplier.supplier_name}</td>
                          <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-gray-300">{supplier.supplier_phone}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-sm text-gray-900 dark:text-white">{formatCurrency(supplier.total_amount, 0)}</td>
                          <td className="px-3 py-2.5 text-right text-green-600 font-semibold text-sm">{formatCurrency(supplier.amount_paid, 0)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-sm text-red-600">
                            {formatCurrency(supplier.amount_remaining, 0)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded text-xs font-medium">
                              {supplier.transactions.length}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedForPayment({
                                  type: 'supplier',
                                  supplier_id: supplier.supplier_id,
                                  supplier_name: supplier.supplier_name,
                                  remaining_balance: supplier.amount_remaining
                                })
                                setShowPayDuesModal(true)
                              }}
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium flex items-center gap-1 mx-auto"
                              disabled={supplier.amount_remaining <= 0}
                            >
                              <CurrencyDollarIcon size={14} />
                              Pay Dues
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Transactions */}
                        {isExpanded && supplier.transactions.map((record) => (
                          <tr 
                            key={`transaction-${record.id}`}
                            className="bg-cyan-50 dark:bg-cyan-900/20 border-t border-cyan-200 dark:border-cyan-800"
                          >
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2" colSpan={2}>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-gray-900 dark:text-white">{record.stock_batches?.products?.name || 'Unknown Product'}</span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600 dark:text-gray-400">Batch: {record.stock_batches?.batch_number || 'N/A'}</span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600 dark:text-gray-400">{new Date(record.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}</span>
                                {record.notes && (
                                  <>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-600 dark:text-gray-400 italic">{record.notes}</span>
                                  </>
                                )}
                              </div>
                            </td>
                                                      <td className="px-3 py-2 text-right text-sm text-gray-900 dark:text-white">{formatCurrency(record.total_amount, 0)}</td>
                            <td className="px-3 py-2 text-right text-sm text-green-600">{formatCurrency(record.amount_paid, 0)}</td>
                            <td className="px-3 py-2 text-right text-sm font-medium text-red-600">
                              {formatCurrency(record.amount_remaining, 0)}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditSupplier(record)
                                  }}
                                  className="p-1.5 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded transition-colors"
                                  title="Edit"
                                >
                                  <PencilSimpleIcon size={14} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteSupplier(record)
                                  }}
                                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors text-red-600"
                                  title="Delete"
                                >
                                  <TrashIcon size={14} />
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
                      {formatCurrency(filteredSuppliers.reduce((sum, s) => sum + s.total_amount, 0), 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm">
                      {formatCurrency(filteredSuppliers.reduce((sum, s) => sum + s.amount_paid, 0), 0)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm">
                      {formatCurrency(filteredSuppliers.reduce((sum, s) => sum + s.amount_remaining, 0), 0)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Customer</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-4 mb-5">
              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Customer Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={customerFormData.customer_name}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, customer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Enter customer name"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Phone Number <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={customerFormData.customer_phone}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, customer_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Total Amount Owed
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={customerFormData.total_amount}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, total_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Amount Paid
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={customerFormData.amount_paid}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, amount_paid: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Notes
                </label>
                <textarea
                  value={customerFormData.notes}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="e.g., Sold iPhone 12, said will pay Friday"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedCustomer(null)
                  setCustomerFormData({ customer_name: '', customer_phone: '', total_amount: '', amount_paid: '', notes: '' })
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleEditCustomer}
                className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors"
              >
                Update Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {showEditModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Update Payment</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded">
              <p className="text-sm text-gray-900 dark:text-white"><strong>Supplier:</strong> {selectedSupplier.supplier_name}</p>
              <p className="text-sm text-gray-900 dark:text-white"><strong>Total Amount:</strong> Rs. {selectedSupplier.total_amount.toLocaleString()}</p>
              <p className="text-sm text-gray-900 dark:text-white"><strong>Current Remaining:</strong> Rs. {selectedSupplier.amount_remaining.toLocaleString()}</p>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Amount Paid <span className="text-red-600">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedSupplier.total_amount}
                  value={supplierFormData.amount_paid}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, amount_paid: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                {supplierFormData.amount_paid && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    New Remaining: Rs. {(selectedSupplier.total_amount - parseFloat(supplierFormData.amount_paid || '0')).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  value={supplierFormData.notes}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Add any notes..."
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedSupplier(null)
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSupplierPayment}
                className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Supplier Modal */}
      {showDeleteModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete Record</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <p className="mb-5 text-sm text-gray-900 dark:text-gray-300">
              Are you sure you want to delete this payment record for <strong>{selectedSupplier.supplier_name}</strong>?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedSupplier(null)
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSupplier}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Pay Dues - {selectedForPayment.type === 'customer' ? selectedForPayment.customer_name : selectedForPayment.supplier_name}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm">
              <p className="text-blue-900 dark:text-blue-300">
                <strong>Current Balance:</strong> {formatCurrency(selectedForPayment.remaining_balance, 2)}
              </p>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Payment Amount*</label>
                <input
                  type="number"
                  value={paymentFormData.payment_amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Enter payment amount"
                  step="0.01"
                  min="0"
                  max={selectedForPayment.remaining_balance}
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Payment Method*</label>
                <select
                  value={paymentFormData.payment_method}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Mobile Payment">Mobile Payment</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
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

