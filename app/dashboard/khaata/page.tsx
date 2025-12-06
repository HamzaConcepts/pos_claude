'use client'

import { useEffect, useState } from 'react'
import { UserCircle, Building2, Plus, Search, Edit, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
}

export default function KhaataPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers')
  const [customers, setCustomers] = useState<KhaataCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<KhaataCustomer | null>(null)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    total_amount: '',
    amount_paid: '',
    notes: ''
  })

  useEffect(() => {
    if (activeTab === 'customers') {
      fetchCustomers()
    }
  }, [activeTab])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      setError('')
      console.log('[KHAATA] Fetching customers...')
      const response = await fetch('/api/khaata-customers')
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

  const handleEditCustomer = async () => {
    if (!selectedCustomer) return

    try {
      setError('')

      const totalAmount = parseFloat(formData.total_amount) || 0
      const amountPaid = parseFloat(formData.amount_paid) || 0

      const response = await fetch(`/api/khaata-customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_name: formData.customer_name.trim(),
          customer_phone: formData.customer_phone.trim(),
          total_amount: totalAmount,
          amount_paid: amountPaid,
          notes: formData.notes.trim() || null
        }),
      })

      const result = await response.json()

      if (result.success) {
        setShowEditModal(false)
        setSelectedCustomer(null)
        setFormData({
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
    setFormData({
      customer_name: customer.customer_name,
      customer_phone: customer.customer_phone,
      total_amount: customer.total_amount.toString(),
      amount_paid: customer.amount_paid.toString(),
      notes: customer.notes || ''
    })
    setShowEditModal(true)
  }

  const filteredCustomers = customers.filter(c =>
    c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customer_phone.includes(searchTerm)
  )

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
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12 border-2 border-black rounded">
              <p className="text-text-secondary">No customers found</p>
            </div>
          ) : (
            <div className="border-2 border-black rounded overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-black text-white">
                    <th className="px-4 py-3 text-left">Customer Name</th>
                    <th className="px-4 py-3 text-left">Phone Number</th>
                    <th className="px-4 py-3 text-right">Amount Owed</th>
                    <th className="px-4 py-3 text-right">Amount Paid</th>
                    <th className="px-4 py-3 text-right">Remaining Balance</th>
                    <th className="px-4 py-3 text-left">Notes</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer, index) => (
                    <tr key={customer.id} className={index % 2 === 0 ? 'bg-white' : 'bg-bg-secondary'}>
                      <td className="px-4 py-3 font-medium">{customer.customer_name}</td>
                      <td className="px-4 py-3">{customer.customer_phone}</td>
                      <td className="px-4 py-3 text-right">${customer.total_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-green-600">${customer.amount_paid.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-orange-600">
                        ${customer.amount_remaining.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {customer.notes || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => openEditModal(customer)}
                            className="p-2 hover:bg-gray-200 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(customer.id)}
                            className="p-2 hover:bg-red-100 rounded transition-colors text-status-error"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-black text-white font-bold">
                    <td colSpan={2} className="px-4 py-3">TOTAL</td>
                    <td className="px-4 py-3 text-right">
                      ${filteredCustomers.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ${filteredCustomers.reduce((sum, c) => sum + c.amount_paid, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ${filteredCustomers.reduce((sum, c) => sum + c.amount_remaining, 0).toFixed(2)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Suppliers Tab (Coming Soon) */}
      {activeTab === 'suppliers' && (
        <div className="text-center py-12 border-2 border-black rounded">
          <Building2 size={48} className="mx-auto mb-4 text-text-secondary" />
          <p className="text-text-secondary text-lg">Supplier management coming soon</p>
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
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
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
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
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
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
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
                  value={formData.amount_paid}
                  onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                  setFormData({ customer_name: '', customer_phone: '', total_amount: '', amount_paid: '', notes: '' })
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
    </div>
  )
}
