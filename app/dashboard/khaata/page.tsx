'use client'

import { useEffect, useState } from 'react'
import { UserCircle, Building2, Search, Edit, Trash2, ChevronDown, ChevronRight, Package } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getStoreId } from '@/lib/supabase'

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
      console.log('[KHAATA] Fetching customers...')
      
      const storeId = getStoreId()
      if (!storeId) {
        setError('Store ID not found')
        setLoading(false)
        return
      }
      
      const response = await fetch(`/api/khaata-customers?store_id=${storeId}`)
      console.log('[KHAATA] Response status:', response.status)
      const result = await response.json()
      console.log('[KHAATA] Result:', result)

      if (result.success) {
        setCustomers(result.data)
        console.log('[KHAATA] Customers loaded:', result.data.length)
      } else {
        console.error('[KHAATA] Failed to fetch:', result.error)
        setError('Failed to fetch customers: ' + (result.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('[KHAATA] Exception:', err)
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Khaata System</h1>
        <p className="text-text-secondary">View and manage customer accounts with outstanding balances</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b-2 border-black">
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'customers'
              ? 'bg-black text-white'
              : 'hover:bg-bg-secondary'
          }`}
        >
          <div className="flex items-center gap-2">
            <UserCircle size={20} />
            <span>Customers</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'suppliers'
              ? 'bg-black text-white'
              : 'hover:bg-bg-secondary'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 size={20} />
            <span>Suppliers</span>
          </div>
        </button>
      </div>

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <div>
          {/* Search Only (removed Add button since customers come from sales) */}
          <div className="flex gap-3 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border-2 border-black rounded focus:outline-none"
              />
            </div>
          </div>

          {/* Info Message */}
          <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-600 rounded">
            <p className="text-sm text-blue-900">
              <strong>ℹ️ Note:</strong> Customers are automatically added when partial payments are made in POS. 
              Use the Edit button to update payment status or add notes.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-status-error rounded">
              <p className="text-status-error">{error}</p>
            </div>
          )}

          {/* Customers Table */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-text-secondary">Loading...</p>
            </div>
          ) : filteredAggregatedCustomers.length === 0 ? (
            <div className="text-center py-12 border-2 border-black rounded">
              <p className="text-text-secondary">No customers found</p>
            </div>
          ) : (
            <div className="border-2 border-black rounded overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="px-4 py-3 text-left w-12"></th>
                    <th className="px-4 py-3 text-left">Customer Name</th>
                    <th className="px-4 py-3 text-left">Phone Number</th>
                    <th className="px-4 py-3 text-right">Total Owed</th>
                    <th className="px-4 py-3 text-right">Total Paid</th>
                    <th className="px-4 py-3 text-right">Remaining Balance</th>
                    <th className="px-4 py-3 text-center">Transactions</th>
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
                          className={`cursor-pointer hover:bg-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-bg-secondary'}`}
                          onClick={() => toggleCustomerExpansion(customer.customer_phone)}
                        >
                          <td className="px-4 py-3">
                            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                          </td>
                          <td className="px-4 py-3 font-medium">{customer.customer_name}</td>
                          <td className="px-4 py-3">{customer.customer_phone}</td>
                          <td className="px-4 py-3 text-right font-semibold">${customer.total_amount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-green-600 font-semibold">${customer.amount_paid.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-bold text-orange-600">
                            ${customer.amount_remaining.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                              {customer.transactions.length}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded Transactions */}
                        {isExpanded && customer.transactions.map((transaction, txIndex) => (
                          <tr 
                            key={transaction.id}
                            className="bg-blue-50 border-t border-blue-200"
                          >
                            <td className="px-4 py-2"></td>
                            <td className="px-4 py-2" colSpan={2}>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-700 font-medium">
                                  {transaction.sales?.sale_description || `Sale #${transaction.sale_id}`}
                                </span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-500">{new Date(transaction.created_at).toLocaleDateString()}</span>
                                {transaction.notes && (
                                  <>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-600 italic">{transaction.notes}</span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right text-sm">${transaction.total_amount.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right text-sm text-green-600">${transaction.amount_paid.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right text-sm font-medium text-orange-600">
                              ${transaction.amount_remaining.toFixed(2)}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openEditModal(transaction)
                                  }}
                                  className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteCustomer(transaction.id)
                                  }}
                                  className="p-1.5 hover:bg-red-100 rounded transition-colors text-status-error"
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
                <tfoot>
                  <tr className="bg-black text-white font-bold">
                    <td colSpan={3} className="px-4 py-3">TOTAL</td>
                    <td className="px-4 py-3 text-right">
                      ${filteredAggregatedCustomers.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ${filteredAggregatedCustomers.reduce((sum, c) => sum + c.amount_paid, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ${filteredAggregatedCustomers.reduce((sum, c) => sum + c.amount_remaining, 0).toFixed(2)}
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
          <div className="flex gap-3 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
              <input
                type="text"
                placeholder="Search by supplier name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border-2 border-black rounded focus:outline-none"
              />
            </div>
          </div>

          {/* Info Message */}
          <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-600 rounded">
            <p className="text-sm text-blue-900">
              <strong>ℹ️ Note:</strong> Suppliers are automatically added when making partial payments for inventory purchases. 
              Use the Edit button to update payment status or add notes.
            </p>
          </div>

          {/* Error Message */}
          {error && !showEditModal && !showDeleteModal && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-status-error rounded">
              <p className="text-status-error">{error}</p>
            </div>
          )}

          {/* Suppliers Table */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-text-secondary">Loading...</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded">
              <Package className="mx-auto mb-4 text-text-secondary" size={48} />
              <p className="text-text-secondary">
                {searchTerm ? 'No suppliers found matching your search' : 'No pending payments to suppliers'}
              </p>
            </div>
          ) : (
            <div className="border-2 border-black rounded overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="px-4 py-3 text-left w-12"></th>
                    <th className="px-4 py-3 text-left">Supplier Name</th>
                    <th className="px-4 py-3 text-left">Phone Number</th>
                    <th className="px-4 py-3 text-right">Total Amount</th>
                    <th className="px-4 py-3 text-right">Amount Paid</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                    <th className="px-4 py-3 text-center">Transactions</th>
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
                          className={`cursor-pointer hover:bg-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-bg-secondary'}`}
                          onClick={() => toggleSupplierExpansion(supplier.supplier_id)}
                        >
                          <td className="px-4 py-3">
                            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                          </td>
                          <td className="px-4 py-3 font-medium">{supplier.supplier_name}</td>
                          <td className="px-4 py-3">{supplier.supplier_phone}</td>
                          <td className="px-4 py-3 text-right font-semibold">Rs. {supplier.total_amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-green-600 font-semibold">Rs. {supplier.amount_paid.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-bold text-red-600">
                            Rs. {supplier.amount_remaining.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                              {supplier.transactions.length}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded Transactions */}
                        {isExpanded && supplier.transactions.map((record) => (
                          <tr 
                            key={`transaction-${record.id}`}
                            className="bg-blue-50 border-t border-blue-200"
                          >
                            <td className="px-4 py-2"></td>
                            <td className="px-4 py-2" colSpan={2}>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium">{record.stock_batches?.products?.name || 'Unknown Product'}</span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-500">Batch: {record.stock_batches?.batch_number || 'N/A'}</span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-500">{new Date(record.created_at).toLocaleDateString()}</span>
                                {record.notes && (
                                  <>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-600 italic">{record.notes}</span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right text-sm">Rs. {record.total_amount.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-sm text-green-600">Rs. {record.amount_paid.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-sm font-medium text-red-600">
                              Rs. {record.amount_remaining.toLocaleString()}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-2 justify-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditSupplier(record)
                                  }}
                                  className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteSupplier(record)
                                  }}
                                  className="p-1.5 hover:bg-red-100 rounded transition-colors text-status-error"
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
                <tfoot>
                  <tr className="bg-black text-white font-bold">
                    <td colSpan={3} className="px-4 py-3">TOTAL</td>
                    <td className="px-4 py-3 text-right">
                      Rs. {filteredSuppliers.reduce((sum, s) => sum + s.total_amount, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      Rs. {filteredSuppliers.reduce((sum, s) => sum + s.amount_paid, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      Rs. {filteredSuppliers.reduce((sum, s) => sum + s.amount_remaining, 0).toLocaleString()}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border-2 border-black max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Edit Customer</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-status-error rounded text-sm">
                <p className="text-status-error">{error}</p>
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block mb-2 font-medium text-sm">
                  Customer Name <span className="text-status-error">*</span>
                </label>
                <input
                  type="text"
                  value={customerFormData.customer_name}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, customer_name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                  placeholder="Enter customer name"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm">
                  Phone Number <span className="text-status-error">*</span>
                </label>
                <input
                  type="text"
                  value={customerFormData.customer_phone}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, customer_phone: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm">
                  Total Amount Owed
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={customerFormData.total_amount}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, total_amount: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm">
                  Amount Paid
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={customerFormData.amount_paid}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, amount_paid: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm">
                  Notes
                </label>
                <textarea
                  value={customerFormData.notes}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
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
                className="flex-1 px-4 py-2 border-2 border-black rounded hover:bg-bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditCustomer}
                className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
              >
                Update Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {showEditModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border-2 border-black max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Update Payment</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-status-error rounded text-sm">
                <p className="text-status-error">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm"><strong>Supplier:</strong> {selectedSupplier.supplier_name}</p>
              <p className="text-sm"><strong>Total Amount:</strong> Rs. {selectedSupplier.total_amount.toLocaleString()}</p>
              <p className="text-sm"><strong>Current Remaining:</strong> Rs. {selectedSupplier.amount_remaining.toLocaleString()}</p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block mb-2 font-medium text-sm">Amount Paid *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedSupplier.total_amount}
                  value={supplierFormData.amount_paid}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, amount_paid: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                />
                {supplierFormData.amount_paid && (
                  <p className="text-sm text-text-secondary mt-1">
                    New Remaining: Rs. {(selectedSupplier.total_amount - parseFloat(supplierFormData.amount_paid || '0')).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm">Notes</label>
                <textarea
                  value={supplierFormData.notes}
                  onChange={(e) => setSupplierFormData({ ...supplierFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
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
                className="flex-1 px-4 py-2 border-2 border-black rounded hover:bg-bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSupplierPayment}
                className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Supplier Modal */}
      {showDeleteModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border-2 border-black max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Delete Record</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-status-error rounded text-sm">
                <p className="text-status-error">{error}</p>
              </div>
            )}

            <p className="mb-6">
              Are you sure you want to delete this payment record for <strong>{selectedSupplier.supplier_name}</strong>?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedSupplier(null)
                  setError('')
                }}
                className="flex-1 px-4 py-2 border-2 border-black rounded hover:bg-bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSupplier}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
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
