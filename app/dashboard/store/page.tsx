'use client'

import { useEffect, useState } from 'react'
import { UsersIcon, ShieldIcon, UserIcon, ClockIcon, CheckCircleIcon, XCircleIcon, StorefrontIcon, TagIcon, GridFourIcon, PlusIcon, PencilSimpleIcon, TrashIcon, XIcon, CurrencyDollarIcon, UserPlusIcon } from '@phosphor-icons/react'
import { getStoreId } from '@/lib/supabase'
import AddStockModal from '@/components/AddStockModal'
import PredefinedExpensesManager from '@/components/PredefinedExpensesManager'
import StoreSkeleton from '@/components/skeletons/StoreSkeleton'

interface UserData {
  id: string
  email: string
  full_name: string
  role: 'Manager' | 'Cashier'
  created_at: string
}

// Investors Tab Component
function InvestorsTab({ investors, onRefresh }: { investors: Investor[]; onRefresh: () => Promise<void> }) {
  const [showModal, setShowModal] = useState(false)
  const [editingInvestor, setEditingInvestor] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    investor_name: '',
    invested_amount: '',
    profit_share_percent: '',
    notes: '',
    is_active: true,
  })

  const totalInvested = investors.reduce((sum, inv) => sum + Number(inv.invested_amount || 0), 0)
  const averageShare = investors.length > 0
    ? investors.reduce((sum, inv) => sum + Number(inv.profit_share_percent || 0), 0) / investors.length
    : 0

  const openCreate = () => {
    setEditingInvestor(null)
    setFormData({
      investor_name: '',
      invested_amount: '',
      profit_share_percent: '',
      notes: '',
      is_active: true,
    })
    setShowModal(true)
  }

  const openEdit = (investor: any) => {
    setEditingInvestor(investor)
    setFormData({
      investor_name: investor.investor_name || '',
      invested_amount: String(investor.invested_amount ?? ''),
      profit_share_percent: String(investor.profit_share_percent ?? ''),
      notes: investor.notes || '',
      is_active: Boolean(investor.is_active),
    })
    setShowModal(true)
  }

  const submitInvestor = async () => {
    try {
      if (!formData.investor_name.trim()) {
        alert('Investor name is required')
        return
      }

      const amount = Number(formData.invested_amount)
      const share = Number(formData.profit_share_percent)

      if (!Number.isFinite(amount) || amount < 0) {
        alert('Invested amount must be a non-negative number')
        return
      }

      if (!Number.isFinite(share) || share < 0 || share > 100) {
        alert('Profit share percent must be between 0 and 100')
        return
      }

      const storeId = getStoreId()
      if (!storeId) {
        alert('Store ID not found')
        return
      }

      setSaving(true)

      const payload = {
        ...(editingInvestor ? { id: editingInvestor.id } : { store_id: storeId }),
        investor_name: formData.investor_name.trim(),
        invested_amount: amount,
        profit_share_percent: share,
        notes: formData.notes.trim() || null,
        is_active: formData.is_active,
      }

      const response = await fetch('/api/investors', {
        method: editingInvestor ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (!result.success) {
        alert(result.error || 'Failed to save investor')
        return
      }

      setShowModal(false)
      await onRefresh()
    } catch (err: any) {
      alert(err.message || 'Failed to save investor')
    } finally {
      setSaving(false)
    }
  }

  const deleteInvestor = async (id: number) => {
    if (!confirm('Delete this investor?')) return

    try {
      const response = await fetch(`/api/investors?id=${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!result.success) {
        alert(result.error || 'Failed to delete investor')
        return
      }
      await onRefresh()
    } catch (err: any) {
      alert(err.message || 'Failed to delete investor')
    }
  }

  return (
    <div className="rounded border p-6 bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Investors</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Manage business investors and their profit share configuration.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700"
        >
          <PlusIcon size={16} />
          Add Investor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="p-3 rounded border bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">Total Investors</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{investors.length}</p>
        </div>
        <div className="p-3 rounded border bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">Total Invested</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">PKR {totalInvested.toLocaleString()}</p>
        </div>
        <div className="p-3 rounded border bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700">
          <p className="text-xs text-gray-600 dark:text-gray-400">Average Profit Share</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{averageShare.toFixed(2)}%</p>
        </div>
      </div>

      {investors.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded">
          No investors added yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Invested</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Profit Share</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {investors.map((investor) => (
                <tr key={investor.id} className="border-b border-gray-100 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">
                    <div className="font-medium">{investor.investor_name}</div>
                    {investor.notes && <div className="text-xs text-gray-500 dark:text-gray-400">{investor.notes}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">PKR {Number(investor.invested_amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">{Number(investor.profit_share_percent || 0).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${investor.is_active
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {investor.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(investor)} className="p-1.5 rounded text-cyan-600 hover:bg-cyan-100 dark:text-cyan-400 dark:hover:bg-cyan-900/30" title="Edit investor">
                        <PencilSimpleIcon size={16} />
                      </button>
                      <button onClick={() => deleteInvestor(investor.id)} className="p-1.5 rounded text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30" title="Delete investor">
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg p-6 max-w-md w-full bg-white dark:bg-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{editingInvestor ? 'Edit Investor' : 'Add Investor'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Close investor modal">
                <XIcon size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Investor Name</label>
                <input
                  type="text"
                  value={formData.investor_name}
                  onChange={(e) => setFormData({ ...formData, investor_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Enter investor name"
                  title="Investor name"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Invested Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.invested_amount}
                  onChange={(e) => setFormData({ ...formData, invested_amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="0.00"
                  title="Invested amount"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Profit Share %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.profit_share_percent}
                  onChange={(e) => setFormData({ ...formData, profit_share_percent: e.target.value })}
                  className="w-full px-3 py-2 border rounded bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="0 - 100"
                  title="Profit share percent"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  rows={3}
                  placeholder="Optional notes"
                  title="Investor notes"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  title="Investor active status"
                />
                Active investor
              </label>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={submitInvestor}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : (editingInvestor ? 'Update' : 'Create')}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface JoinRequest {
  id: number
  user_id: string
  user_type: string
  user_email: string | null
  user_name: string
  user_phone: string
  requested_at: string
  status: string
}

interface Category {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  requires_imei?: boolean
  subcategories?: Subcategory[]
}

interface Subcategory {
  id: number
  category_id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

interface StoreInfo {
  store_code: string
  store_name: string
  currency: string
  logo_url: string | null
  order_fee_per_order?: number
  order_fee_enabled?: boolean
  order_fee_amount_owed?: number
}

interface Cashier {
  id: number
  store_id: number
  full_name: string
  phone_number: string
  commission_rate: number
  salary?: number
  is_active: boolean
  created_at: string
}

interface Supplier {
  id: number
  store_id: number
  name: string
  contact_person: string | null
  phone_number: string
  email: string | null
  address: string | null
  balance_owed: number
  initial_balance: number
  last_payment_date: string | null
  total_paid: number
  created_at: string
}

interface SupplierPayment {
  id: number
  supplier_id: number
  amount: number
  payment_method: string
  payment_date: string
  notes: string | null
}

interface Investor {
  id: number
  store_id: number
  investor_name: string
  invested_amount: number
  profit_share_percent: number
  notes: string | null
  is_active: boolean
  created_at: string
}

export default function StorePage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null)
  const [cashiers, setCashiers] = useState<Cashier[]>([])
  const [cashiersForUserTab, setCashiersForUserTab] = useState<Cashier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState<number | null>(null)
  
  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false)
  const [showCashierModal, setShowCashierModal] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<Supplier | null>(null)
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([])
  const [investors, setInvestors] = useState<Investor[]>([])
  const [editingCashier, setEditingCashier] = useState<Cashier | null>(null)
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState<number | null>(null)
  
  // Initial entries state
  const [initialCustomers, setInitialCustomers] = useState<any[]>([])
  const [initialSuppliers, setInitialSuppliers] = useState<any[]>([])
  const [showInitialCustomerModal, setShowInitialCustomerModal] = useState(false)
  const [showInitialSupplierModal, setShowInitialSupplierModal] = useState(false)
  const [editingInitialCustomer, setEditingInitialCustomer] = useState<any>(null)
  const [editingInitialSupplier, setEditingInitialSupplier] = useState<any>(null)
  
  // Active tab - Simplified structure
  const [activeTab, setActiveTab] = useState<'team' | 'products' | 'partners' | 'settings'>('team')
  // Sub-tabs for each main tab
  const [teamSubTab, setTeamSubTab] = useState<'users' | 'cashiers'>('users')
  const [productsSubTab, setProductsSubTab] = useState<'categories' | 'initial-stock'>('categories')
  const [partnersSubTab, setPartnersSubTab] = useState<'initial-suppliers' | 'initial-customers'>('initial-suppliers')
  const [settingsSubTab, setSettingsSubTab] = useState<'info' | 'expenses' | 'withdrawals' | 'investors'>('info')
  
  // Owner Withdrawals state
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: '',
    withdrawal_from: 'Cash',
    description: '',
    withdrawal_date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    await Promise.all([
      fetchUsers(),
      fetchJoinRequests(),
      fetchCategories(),
      fetchStoreInfo(),
      fetchCashiers(),
      fetchCashiersForUserTab(),
      fetchSuppliers(),
      fetchInitialCustomers(),
      fetchInitialSuppliers(),
      fetchWithdrawals(),
      fetchInvestors()
    ])
  }

  const fetchInvestors = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/investors?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setInvestors(result.data || [])
      }
    } catch (err) {
      console.error('Error fetching investors:', err)
    }
  }

  const fetchStoreInfo = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/store-info?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()
      
      if (result.success) {
        setStoreInfo(result.data)
      }
    } catch (err) {
      console.error('Error fetching store info:', err)
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError('')
      
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/users?store_id=${storeId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const result = await response.json()

      if (result.success) {
        setUsers(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to fetch users')
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchJoinRequests = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) {
        console.error('No store ID found')
        return
      }

      const response = await fetch(`/api/join-requests?storeId=${storeId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const result = await response.json()

      if (result.requests) {
        setJoinRequests(result.requests)
      }
    } catch (err) {
      console.error('Error fetching join requests:', err)
    }
  }

  const fetchCategories = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/categories?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setCategories(result.data || [])
      }
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }

  const fetchCashiers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/cashiers?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setCashiers(result.data || [])
      }
    } catch (err) {
      console.error('Error fetching cashiers:', err)
    }
  }

  const fetchInitialCustomers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/initial-customers?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setInitialCustomers(result.data || [])
      }
    } catch (err) {
      console.error('Error fetching initial customers:', err)
    }
  }

  const fetchInitialSuppliers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/initial-suppliers?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setInitialSuppliers(result.data || [])
      }
    } catch (err) {
      console.error('Error fetching initial suppliers:', err)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/suppliers?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setSuppliers(result.data || [])
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err)
    }
  }

  const fetchWithdrawals = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/owner-withdrawals?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setWithdrawals(result.data || [])
      }
    } catch (err) {
      console.error('Error fetching withdrawals:', err)
    }
  }

  const createWithdrawal = async () => {
    try {
      if (!withdrawalForm.amount || parseFloat(withdrawalForm.amount) <= 0) {
        alert('Please enter a valid amount')
        return
      }

      const storeId = getStoreId()
      if (!storeId) {
        alert('Store ID not found')
        return
      }

      const response = await fetch('/api/owner-withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          amount: parseFloat(withdrawalForm.amount),
          withdrawal_from: withdrawalForm.withdrawal_from,
          description: withdrawalForm.description,
          withdrawal_date: withdrawalForm.withdrawal_date,
          recorded_by: null // Will be set by the API from the auth session
        })
      })

      const result = await response.json()

      if (result.success) {
        alert('Withdrawal recorded successfully')
        setShowWithdrawalModal(false)
        setWithdrawalForm({
          amount: '',
          withdrawal_from: 'Cash',
          description: '',
          withdrawal_date: new Date().toISOString().split('T')[0]
        })
        await fetchWithdrawals()
      } else {
        alert('Error: ' + result.error)
      }
    } catch (err: any) {
      console.error('Error creating withdrawal:', err)
      alert('Failed to create withdrawal: ' + err.message)
    }
  }

  const deleteWithdrawal = async (id: number) => {
    if (!confirm('Are you sure you want to delete this withdrawal?')) return

    try {
      const response = await fetch(`/api/owner-withdrawals?id=${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        alert('Withdrawal deleted successfully')
        await fetchWithdrawals()
      } else {
        alert('Error: ' + result.error)
      }
    } catch (err: any) {
      console.error('Error deleting withdrawal:', err)
      alert('Failed to delete withdrawal: ' + err.message)
    }
  }

  const fetchCashiersForUserTab = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/cashiers?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setCashiersForUserTab(result.data || [])
      }
    } catch (err) {
      console.error('Error fetching cashiers for user tab:', err)
    }
  }

  const handleJoinRequest = async (requestId: number, action: 'approve' | 'reject') => {
    try {
      setProcessing(requestId)
      setError('')

      const reviewerId = sessionStorage.getItem('user_id') || ''
      
      if (!reviewerId) {
        setError('Unable to identify reviewer. Please login again.')
        setProcessing(null)
        return
      }

      const response = await fetch('/api/join-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          action,
          reviewerId,
        }),
      })

      const result = await response.json()

      if (result.success) {
        await fetchJoinRequests()
        await fetchUsers()
      } else {
        setError(result.error || 'Failed to process join request')
      }
    } catch (err) {
      setError('Failed to process join request')
      console.error('Error processing join request:', err)
    } finally {
      setProcessing(null)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Manager':
        return 'bg-cyan-600 text-white'
      case 'Cashier':
        return 'bg-gray-500 text-white'
      default:
        return 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Manager':
        return <ShieldIcon size={14} />
      case 'Cashier':
        return <UserIcon size={14} />
      default:
        return <UserIcon size={14} />
    }
  }

  if (loading) {
    return <StoreSkeleton />
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold mb-1.5 dark:text-white">Store Management</h1>
          <p className="text-sm text-text-secondary dark:text-gray-300">Manage users, categories, and store settings</p>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-status-error text-white rounded text-sm">
          {error}
        </div>
      )}

      {/* Tab Navigation - Simplified with 4 main tabs */}
      <div className="mb-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'team'
                ? 'border-cyan-600 bg-cyan-50 text-cyan-700 dark:border-cyan-500 dark:bg-gray-700 dark:text-cyan-400'
                : 'border-transparent hover:bg-gray-50 text-gray-600 dark:hover:bg-gray-800 dark:text-gray-400'
            }`}>
            <UsersIcon size={16} />
            Team
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'products'
                ? 'border-cyan-600 bg-cyan-50 text-cyan-700 dark:border-cyan-500 dark:bg-gray-700 dark:text-cyan-400'
                : 'border-transparent hover:bg-gray-50 text-gray-600 dark:hover:bg-gray-800 dark:text-gray-400'
            }`}>
            <GridFourIcon size={16} />
            Products
          </button>
          <button
            onClick={() => setActiveTab('partners')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'partners'
                ? 'border-cyan-600 bg-cyan-50 text-cyan-700 dark:border-cyan-500 dark:bg-gray-700 dark:text-cyan-400'
                : 'border-transparent hover:bg-gray-50 text-gray-600 dark:hover:bg-gray-800 dark:text-gray-400'
            }`}>
            <UserPlusIcon size={16} />
            Partners
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'settings'
                ? 'border-cyan-600 bg-cyan-50 text-cyan-700 dark:border-cyan-500 dark:bg-gray-700 dark:text-cyan-400'
                : 'border-transparent hover:bg-gray-50 text-gray-600 dark:hover:bg-gray-800 dark:text-gray-400'
            }`}>
            <StorefrontIcon size={16} />
            Settings
          </button>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      {activeTab === 'team' && (
        <div className="mb-4 flex gap-2 text-gray-700 dark:text-gray-300">
          <button
            onClick={() => setTeamSubTab('users')}
            className={`px-3 py-1.5 text-sm rounded ${
              teamSubTab === 'users'
                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-600 dark:text-white'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}>
            Users
          </button>
          <button
            onClick={() => setTeamSubTab('cashiers')}
            className={`px-3 py-1.5 text-sm rounded ${
              teamSubTab === 'cashiers'
                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-600 dark:text-white'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}>
            Cashiers
          </button>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="mb-4 flex gap-2 text-gray-700 dark:text-gray-300">
          <button
            onClick={() => setProductsSubTab('categories')}
            className={`px-3 py-1.5 text-sm rounded ${
              productsSubTab === 'categories'
                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-600 dark:text-white'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}>
            Categories
          </button>
          <button
            onClick={() => setProductsSubTab('initial-stock')}
            className={`px-3 py-1.5 text-sm rounded ${
              productsSubTab === 'initial-stock'
                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-600 dark:text-white'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}>
            Initial Stock
          </button>
        </div>
      )}

      {activeTab === 'partners' && (
        <div className="mb-4 flex gap-2 text-gray-700 dark:text-gray-300">
          <button
            onClick={() => setPartnersSubTab('initial-suppliers')}
            className={`px-3 py-1.5 text-sm rounded ${
              partnersSubTab === 'initial-suppliers'
                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-600 dark:text-white'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}>
            Initial Suppliers
          </button>
          <button
            onClick={() => setPartnersSubTab('initial-customers')}
            className={`px-3 py-1.5 text-sm rounded ${
              partnersSubTab === 'initial-customers'
                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-600 dark:text-white'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}>
            Initial Customers
          </button>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="mb-4 flex gap-2 text-gray-700 dark:text-gray-300">
          <button
            onClick={() => setSettingsSubTab('info')}
            className={`px-3 py-1.5 text-sm rounded ${
              settingsSubTab === 'info'
                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-600 dark:text-white'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}>
            Store Info
          </button>
          <button
            onClick={() => setSettingsSubTab('expenses')}
            className={`px-3 py-1.5 text-sm rounded ${
              settingsSubTab === 'expenses'
                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-600 dark:text-white'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}>
            Expense Types
          </button>
          <button
            onClick={() => setSettingsSubTab('withdrawals')}
            className={`px-3 py-1.5 text-sm rounded ${
              settingsSubTab === 'withdrawals'
                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-600 dark:text-white'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}>
            Owner Withdrawals
          </button>
          <button
            onClick={() => setSettingsSubTab('investors')}
            className={`px-3 py-1.5 text-sm rounded ${
              settingsSubTab === 'investors'
                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-600 dark:text-white'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}>
            Investors
          </button>
        </div>
      )}

      {/* Team Tab - Users */}
      {activeTab === 'team' && teamSubTab === 'users' && (
        <div>
          {/* Pending Join Requests */}
          {joinRequests.length > 0 && (
            <div className="mb-5 bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-3 bg-yellow-50 border-b border-yellow-200">
                <div className="flex items-center gap-2">
                  <ClockIcon className="text-yellow-600" size={16} />
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">Pending Join Requests ({joinRequests.length})</h2>
                </div>
              </div>

              <div className="p-3">
                {joinRequests.map((request: JoinRequest) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 mb-2.5 bg-gray-50 dark:bg-[#111] rounded border border-gray-200 dark:border-gray-700 last:mb-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-gray-400 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                          {request.user_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{request.user_name}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {request.user_email || request.user_phone}
                          </p>
                          <div className="flex items-center gap-2.5 mt-0.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                              request.user_type === 'Manager' ? 'bg-cyan-600 text-white' : 'bg-gray-500 text-white'
                            }`}>
                              {request.user_type === 'Manager' ? <ShieldIcon size={10} /> : <UserIcon size={10} />}
                              {request.user_type}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {new Date(request.requested_at).toLocaleDateString('en-PK', {
                                timeZone: 'Asia/Karachi',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-3">
                      <button
                        onClick={() => handleJoinRequest(request.id, 'approve')}
                        disabled={processing === request.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <CheckCircleIcon size={14} />
                        {processing === request.id ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleJoinRequest(request.id, 'reject')}
                        disabled={processing === request.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <XCircleIcon size={14} />
                        {processing === request.id ? 'Processing...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldIcon className="text-cyan-600" size={18} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Managers</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {users.filter(u => u.role === 'Manager').length}
              </p>
            </div>

            <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1.5">
                <UserIcon className="text-cyan-600" size={18} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cashiers</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {cashiersForUserTab.length}
              </p>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">All Users ({users.filter(u => u.role === 'Manager').length + cashiersForUserTab.length})</h2>
            </div>

            {users.filter(u => u.role === 'Manager').length === 0 && cashiersForUserTab.length === 0 ? (
              <div className="p-6 text-center text-gray-600 dark:text-gray-400 text-sm">
                No users found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Name</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Contact</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Role</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => u.role === 'Manager').map((user, index) => (
                      <tr
                        key={`manager-${user.id}`}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-cyan-600 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                              {user.full_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-sm text-gray-900 dark:text-white">{user.full_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{user.email}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium ${getRoleColor('Manager')}`}>
                            {getRoleIcon('Manager')}
                            Manager
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">
                          {new Date(user.created_at).toLocaleDateString('en-PK', {
                            timeZone: 'Asia/Karachi',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </td>
                      </tr>
                    ))}
                    {cashiersForUserTab.map((cashier, index) => (
                      <tr
                        key={`cashier-${cashier.id}`}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gray-500 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                              {cashier.full_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-sm text-gray-900 dark:text-white">{cashier.full_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{cashier.phone_number}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium ${getRoleColor('Cashier')}`}>
                            {getRoleIcon('Cashier')}
                            Cashier
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">
                          Commission: {cashier.commission_rate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Role Permissions Info */}
          <div className="mt-5 bg-gray-50 dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold mb-2.5 text-sm text-gray-900 dark:text-white">Role Permissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldIcon size={14} />
                  <span className="font-bold">Manager</span>
                </div>
                <ul className="text-text-secondary space-y-0.5 ml-5">
                  <li>• Full system access</li>
                  <li>• All pages and features</li>
                  <li>• Create/manage users</li>
                  <li>• Complete control</li>
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <UserIcon size={14} />
                  <span className="font-bold">Cashier</span>
                </div>
                <ul className="text-text-secondary space-y-0.5 ml-5">
                  <li>• Access Inventory page</li>
                  <li>• Access POS page</li>
                  <li>• Access Expenses page</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products Tab - Categories */}
      {activeTab === 'products' && productsSubTab === 'categories' && (
        <CategoriesTab
          categories={categories}
          onAddCategory={() => {
            setEditingCategory(null)
            setShowCategoryModal(true)
          }}
          onEditCategory={(category: Category) => {
            setEditingCategory(category)
            setShowCategoryModal(true)
          }}
          onAddSubcategory={(categoryId: number) => {
            setSelectedCategoryForSub(categoryId)
            setEditingSubcategory(null)
            setShowSubcategoryModal(true)
          }}
          onEditSubcategory={(subcategory: Subcategory) => {
            setEditingSubcategory(subcategory)
            setSelectedCategoryForSub(subcategory.category_id)
            setShowSubcategoryModal(true)
          }}
          onRefresh={fetchCategories}
        />
      )}

      {/* Settings Tab - Store Info */}
      {activeTab === 'settings' && settingsSubTab === 'info' && (
        <StoreInfoTab storeInfo={storeInfo} onRefresh={fetchStoreInfo} />
      )}

      {/* Team Tab - Cashiers */}
      {activeTab === 'team' && teamSubTab === 'cashiers' && (
        <CashiersTab 
          cashiers={cashiers} 
          onAddCashier={() => {
            setEditingCashier(null)
            setShowCashierModal(true)
          }}
          onEditCashier={(cashier: Cashier) => {
            setEditingCashier(cashier)
            setShowCashierModal(true)
          }}
          onRefresh={fetchCashiers}
        />
      )}

      {/* Products Tab - Initial Stock */}
      {activeTab === 'products' && productsSubTab === 'initial-stock' && (
        <InitialStockTab />
      )}

      {/* Partners Tab - Initial Customers */}
      {activeTab === 'partners' && partnersSubTab === 'initial-customers' && (
        <InitialCustomersTab 
          entries={initialCustomers}
          onAddEntry={() => {
            setEditingInitialCustomer(null)
            setShowInitialCustomerModal(true)
          }}
          onEditEntry={(entry: any) => {
            setEditingInitialCustomer(entry)
            setShowInitialCustomerModal(true)
          }}
          onRefresh={fetchInitialCustomers}
        />
      )}

      {/* Partners Tab - Initial Suppliers */}
      {activeTab === 'partners' && partnersSubTab === 'initial-suppliers' && (
        <InitialSuppliersTab 
          entries={initialSuppliers}
          onAddEntry={() => {
            setEditingInitialSupplier(null)
            setShowInitialSupplierModal(true)
          }}
          onEditEntry={(entry: any) => {
            setEditingInitialSupplier(entry)
            setShowInitialSupplierModal(true)
          }}
          onRefresh={fetchInitialSuppliers}
        />
      )}

      {/* Settings Tab - Expense Types */}
      {activeTab === 'settings' && settingsSubTab === 'expenses' && (
        <div className="rounded border p-6 bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <PredefinedExpensesManager />
        </div>
      )}

      {/* Settings Tab - Owner Withdrawals */}
      {activeTab === 'settings' && settingsSubTab === 'withdrawals' && (
        <div className="rounded border p-6 bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Owner Withdrawals</h2>
              <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
                Record money withdrawn from cash or bank. These do NOT affect profit/loss.
              </p>
            </div>
            <button
              onClick={() => setShowWithdrawalModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700"
            >
              <PlusIcon size={18} />
              Record Withdrawal
            </button>
          </div>

          {/* Info Banner */}
          <div className="mb-6 p-4 rounded border bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700/50">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <strong>Important:</strong> Owner withdrawals only reduce cash in hand or bank balance. They do not affect profit/loss calculations since they are capital outflows, not business expenses.
            </p>
          </div>

          {/* Withdrawals List */}
          {withdrawals.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No withdrawals recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">From</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Recorded By</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((withdrawal: any) => (
                    <tr
                      key={withdrawal.id}
                      className="border-b border-gray-100 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">
                        {new Date(withdrawal.withdrawal_date).toLocaleDateString('en-PK', {
                          timeZone: 'Asia/Karachi',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-red-600 dark:text-red-400">
                        PKR {withdrawal.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          withdrawal.withdrawal_from === 'Cash'
                            ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700'
                            : 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
                        }`}>
                          {withdrawal.withdrawal_from}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300">
                        {withdrawal.description || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {withdrawal.recorded_by_name || 'System'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => deleteWithdrawal(withdrawal.id)}
                          className="p-1.5 rounded text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                        >
                          <TrashIcon size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab - Investors */}
      {activeTab === 'settings' && settingsSubTab === 'investors' && (
        <InvestorsTab investors={investors} onRefresh={fetchInvestors} />
      )}

      {/* Withdrawal Modal */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg p-6 max-w-md w-full bg-white dark:bg-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Record Owner Withdrawal</h3>
              <button
                onClick={() => setShowWithdrawalModal(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <XIcon size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Amount <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={withdrawalForm.amount}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:border-cyan-600 bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Withdraw From <span className="text-red-600">*</span>
                </label>
                <select
                  value={withdrawalForm.withdrawal_from}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, withdrawal_from: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:border-cyan-600 bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={withdrawalForm.withdrawal_date}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, withdrawal_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:border-cyan-600 bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description (Optional)
                </label>
                <textarea
                  value={withdrawalForm.description}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:border-cyan-600 bg-white border-gray-300 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  rows={3}
                  placeholder="Enter description (optional)"
                />
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={createWithdrawal}
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700"
                >
                  Record Withdrawal
                </button>
                <button
                  onClick={() => setShowWithdrawalModal(false)}
                  className="flex-1 px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          onClose={(refresh?: boolean) => {
            setShowCategoryModal(false)
            setEditingCategory(null)
            if (refresh) fetchCategories()
          }}
        />
      )}

      {/* Subcategory Modal */}
      {showSubcategoryModal && (
        <SubcategoryModal
          subcategory={editingSubcategory}
          categoryId={selectedCategoryForSub!}
          onClose={(refresh?: boolean) => {
            setShowSubcategoryModal(false)
            setEditingSubcategory(null)
            setSelectedCategoryForSub(null)
            if (refresh) fetchCategories()
          }}
        />
      )}

      {/* Cashier Modal */}
      {showCashierModal && (
        <CashierModal
          cashier={editingCashier}
          onClose={(refresh?: boolean) => {
            setShowCashierModal(false)
            setEditingCashier(null)
            if (refresh) fetchCashiers()
          }}
        />
      )}

      {showSupplierModal && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={(refresh?: boolean) => {
            setShowSupplierModal(false)
            setEditingSupplier(null)
            if (refresh) fetchSuppliers()
          }}
        />
      )}

      {showPaymentModal && selectedSupplierForPayment && (
        <PaymentModal
          supplier={selectedSupplierForPayment}
          onClose={(refresh?: boolean) => {
            setShowPaymentModal(false)
            setSelectedSupplierForPayment(null)
            if (refresh) fetchSuppliers()
          }}
        />
      )}

      {/* Initial Customer Modal */}
      {showInitialCustomerModal && (
        <InitialCustomerModal
          entry={editingInitialCustomer}
          onClose={(refresh?: boolean) => {
            setShowInitialCustomerModal(false)
            setEditingInitialCustomer(null)
            if (refresh) fetchInitialCustomers()
          }}
        />
      )}

      {/* Initial Supplier Modal */}
      {showInitialSupplierModal && (
        <InitialSupplierModal
          entry={editingInitialSupplier}
          onClose={(refresh?: boolean) => {
            setShowInitialSupplierModal(false)
            setEditingInitialSupplier(null)
            if (refresh) fetchInitialSuppliers()
          }}
        />
      )}
    </div>
  )
}

// Categories Tab Component
function CategoriesTab({ categories, onAddCategory, onEditCategory, onAddSubcategory, onEditSubcategory, onRefresh }: any) {
  const [deleting, setDeleting] = useState<number | null>(null)

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category? This will also delete all subcategories.')) return

    try {
      setDeleting(id)
      const response = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        onRefresh()
      } else {
        alert(result.error || 'Failed to delete category')
      }
    } catch (err) {
      alert('Failed to delete category')
    } finally {
      setDeleting(null)
    }
  }

  const handleDeleteSubcategory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this subcategory?')) return

    try {
      const response = await fetch(`/api/subcategories?id=${id}`, { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        onRefresh()
      } else {
        alert(result.error || 'Failed to delete subcategory')
      }
    } catch (err) {
      alert('Failed to delete subcategory')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-text-secondary">Manage product categories and subcategories</p>
        <button
          onClick={onAddCategory}
          className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors text-sm font-medium"
        >
          <PlusIcon size={16} />
          Add Category
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 p-8 text-center">
          <TagIcon size={40} className="mx-auto mb-3 text-gray-400" />
          <p className="text-text-secondary text-sm mb-3">No categories yet</p>
          <button
            onClick={onAddCategory}
            className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors text-sm"
          >
            Create First Category
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((category: Category) => (
            <div key={category.id} className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-3 bg-gray-100 dark:bg-[#111] flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TagIcon size={17} />
                  <h3 className="font-bold text-sm">{category.name}</h3>
                  {category.requires_imei && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      📱 IMEI
                    </span>
                  )}
                  {category.description && (
                    <span className="text-xs text-text-secondary">- {category.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAddSubcategory(category.id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-gray-800 border border-black dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs dark:text-gray-200"
                  >
                    <PlusIcon size={12} />
                    Add Subcategory
                  </button>
                  <button
                    onClick={() => onEditCategory(category)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Edit category"
                  >
                    <PencilSimpleIcon size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    disabled={deleting === category.id}
                    className="p-1.5 hover:bg-red-100 text-red-600 rounded transition-colors disabled:opacity-50"
                    title="Delete category"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>

              {category.subcategories && category.subcategories.length > 0 && (
                <div className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {category.subcategories.map((sub: Subcategory) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between p-2 bg-bg-secondary dark:bg-[#111] rounded border border-gray-300 dark:border-gray-600"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{sub.name}</p>
                          {sub.description && (
                            <p className="text-xs text-text-secondary">{sub.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => onEditSubcategory(sub)}
                            className="p-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
                            title="Edit subcategory"
                          >
                            <PencilSimpleIcon size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteSubcategory(sub.id)}
                            className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"
                            title="Delete subcategory"
                          >
                            <TrashIcon size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Store Info Tab Component
function StoreInfoTab({ storeInfo, onRefresh }: any) {
  const [editing, setEditing] = useState(false)
  const [storeCode, setStoreCode] = useState(storeInfo?.store_code || '')
  const [currency, setCurrency] = useState(storeInfo?.currency || 'PKR')
  const [saving, setSaving] = useState(false)
  const [cashiers, setCashiers] = useState<any[]>([])
  const [loadingCashiers, setLoadingCashiers] = useState(true)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(storeInfo?.logo_url || null)
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [bankAccountsLoading, setBankAccountsLoading] = useState(true)
  const [bankAccountName, setBankAccountName] = useState('')
  const [bankAccountSaving, setBankAccountSaving] = useState(false)
  const [deletingBankAccountId, setDeletingBankAccountId] = useState<number | null>(null)

  useEffect(() => {
    fetchCashiers()
    fetchBankAccounts()
  }, [])

  // Update state when storeInfo changes
  useEffect(() => {
    if (storeInfo) {
      setStoreCode(storeInfo.store_code || '')
      setCurrency(storeInfo.currency || 'PKR')
      setLogoUrl(storeInfo.logo_url || null)
    }
  }, [storeInfo])

  const fetchCashiers = async () => {
    try {
      setLoadingCashiers(true)
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/cashiers?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setCashiers(result.data || [])
      }
    } catch (err) {
      console.error('Error fetching cashiers:', err)
    } finally {
      setLoadingCashiers(false)
    }
  }

  const fetchBankAccounts = async () => {
    try {
      setBankAccountsLoading(true)
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/bank-accounts?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setBankAccounts(result.data || [])
      }
    } catch (err) {
      console.error('Error fetching bank accounts:', err)
    } finally {
      setBankAccountsLoading(false)
    }
  }

  const handleAddBankAccount = async () => {
    const trimmedAccountName = bankAccountName.trim()

    if (!trimmedAccountName) {
      alert('Bank account name is required')
      return
    }

    try {
      setBankAccountSaving(true)
      const storeId = getStoreId()
      if (!storeId) {
        alert('Store ID not found')
        return
      }

      const response = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          account_name: trimmedAccountName,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        alert(result.error || 'Failed to add bank account')
        return
      }

      setBankAccountName('')
      await fetchBankAccounts()
    } catch (err) {
      console.error('Error adding bank account:', err)
      alert('Failed to add bank account')
    } finally {
      setBankAccountSaving(false)
    }
  }

  const handleDeleteBankAccount = async (bankAccountId: number) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return

    try {
      setDeletingBankAccountId(bankAccountId)
      const storeId = getStoreId()
      if (!storeId) {
        alert('Store ID not found')
        return
      }

      const response = await fetch(`/api/bank-accounts?id=${bankAccountId}&store_id=${storeId}`, {
        method: 'DELETE',
      })
      const result = await response.json()

      if (!result.success) {
        alert(result.error || 'Failed to delete bank account')
        return
      }

      await fetchBankAccounts()
    } catch (err) {
      console.error('Error deleting bank account:', err)
      alert('Failed to delete bank account')
    } finally {
      setDeletingBankAccountId(null)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const storeId = getStoreId()
      
      const response = await fetch('/api/store-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          store_id: storeId, 
          store_code: storeCode.trim(),
          currency: currency 
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setEditing(false)
        onRefresh()
        // Dispatch custom event to update currency in context
        window.dispatchEvent(new Event('currencyUpdated'))
      } else {
        alert(result.error || 'Failed to update store settings')
      }
    } catch (err) {
      alert('Failed to update store settings')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side validation
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5 MB')
      return
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      alert('Only PNG, JPEG, WebP, and SVG images are allowed')
      return
    }

    try {
      setLogoUploading(true)
      const storeId = getStoreId()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('store_id', storeId?.toString() || '')

      const response = await fetch('/api/upload-logo', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()

      if (result.success) {
        setLogoUrl(result.data.logo_url)
        onRefresh()
      } else {
        alert(result.error || 'Failed to upload logo')
      }
    } catch (err) {
      alert('Failed to upload logo')
      console.error(err)
    } finally {
      setLogoUploading(false)
      // Reset the file input
      e.target.value = ''
    }
  }

  const handleLogoRemove = async () => {
    if (!confirm('Are you sure you want to remove the store logo?')) return

    try {
      setLogoUploading(true)
      const storeId = getStoreId()

      const response = await fetch(`/api/upload-logo?store_id=${storeId}`, {
        method: 'DELETE',
      })
      const result = await response.json()

      if (result.success) {
        setLogoUrl(null)
        onRefresh()
      } else {
        alert(result.error || 'Failed to remove logo')
      }
    } catch (err) {
      alert('Failed to remove logo')
      console.error(err)
    } finally {
      setLogoUploading(false)
    }
  }

  return (
    <div>
      {/* Grid Layout for Store Information and Receipt Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Store Information Card */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-base font-bold mb-3 flex items-center gap-2 dark:text-white">
            <StorefrontIcon size={18} />
            Store Information
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Store Name</label>
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 text-sm dark:text-white">
                {storeInfo?.store_name || 'Not set'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Auto-Generated Store Code (3-Digit)</label>
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
                <span className="font-mono font-bold dark:text-white">{storeInfo?.store_code || 'Not set'}</span>
              </div>
              <p className="text-xs text-text-secondary mt-1">Automatically generated</p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Custom Store Code</label>
              {editing ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
                    placeholder="Enter custom store code"
                    maxLength={20}
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1.5 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50 text-xs"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false)
                      setStoreCode(storeInfo?.store_code || '')
                      setCurrency(storeInfo?.currency || 'PKR')
                    }}
                    className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-xs dark:text-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
                  <span className="text-sm font-mono dark:text-white">{storeInfo?.store_code || 'Not set'}</span>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 border border-black dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-xs dark:text-gray-200"
                  >
                    <PencilSimpleIcon size={12} />
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Store Currency</label>
              {editing ? (
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
                >
                  <option value="PKR">PKR - Pakistani Rupee</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="INR">INR - Indian Rupee</option>
                  <option value="AED">AED - UAE Dirham</option>
                  <option value="SAR">SAR - Saudi Riyal</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                </select>
              ) : (
                <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
                  <span className="text-sm font-mono dark:text-white">{storeInfo?.currency || 'PKR'}</span>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 border border-black dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-xs dark:text-gray-200"
                  >
                    <PencilSimpleIcon size={12} />
                    Edit
                  </button>
                </div>
              )}
              <p className="text-xs text-text-secondary mt-1">Currency used throughout the app</p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Super Admin Order Fee</label>
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono dark:text-white">
                    {(storeInfo?.order_fee_per_order || 0).toFixed(2)} {storeInfo?.currency || 'PKR'} / order
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${storeInfo?.order_fee_enabled
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {storeInfo?.order_fee_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Estimated amount owed: {(storeInfo?.order_fee_amount_owed || 0).toFixed(2)} {storeInfo?.currency || 'PKR'}
              </p>
            </div>

            {/* Store Logo */}
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Store Logo</label>
              <p className="text-xs text-gray-400 mb-2">Used in receipts and quotation PDFs. Max 5 MB (PNG, JPEG, WebP, SVG)</p>
              {logoUrl ? (
                <div className="flex items-start gap-3">
                  <div className="w-20 h-20 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                    <img
                      src={logoUrl}
                      alt="Store logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="cursor-pointer">
                      <span className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 border border-black dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-xs dark:text-gray-200">
                        <PencilSimpleIcon size={12} />
                        Change
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                        onChange={handleLogoUpload}
                        className="hidden"
                        disabled={logoUploading}
                      />
                    </label>
                    <button
                      onClick={handleLogoRemove}
                      disabled={logoUploading}
                      className="flex items-center gap-1 px-2 py-1 border border-red-300 text-red-600 rounded hover:bg-red-50 text-xs disabled:opacity-50"
                    >
                      <TrashIcon size={12} />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <div className={`w-full p-4 rounded border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-gray-50 dark:bg-gray-800 text-center transition-colors ${logoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    <StorefrontIcon size={28} className="mx-auto mb-1 text-gray-400" />
                    <p className="text-xs text-gray-500">
                      {logoUploading ? 'Uploading...' : 'Click to upload logo'}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={logoUploading}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Receipt Settings Card - Removed: use /dashboard/receipt-settings instead */}
      </div>

      {/* Bank Accounts Card - Full Width */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 p-4 mb-4">
        <h2 className="text-base font-bold mb-2 flex items-center gap-2 dark:text-white">
          <CurrencyDollarIcon size={18} />
          Digital Payment Bank Accounts
        </h2>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          These bank accounts appear in POS when payment method is set to Digital.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            value={bankAccountName}
            onChange={(e) => setBankAccountName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddBankAccount()
              }
            }}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
            placeholder="e.g., Meezan Bank - Main Account"
            maxLength={100}
          />
          <button
            onClick={handleAddBankAccount}
            disabled={bankAccountSaving}
            className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
          >
            <PlusIcon size={14} />
            {bankAccountSaving ? 'Adding...' : 'Add'}
          </button>
        </div>

        {bankAccountsLoading ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">Loading bank accounts...</div>
        ) : bankAccounts.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded p-3">
            No bank accounts added yet.
          </div>
        ) : (
          <div className="space-y-2">
            {bankAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111]"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{account.account_name}</p>
                </div>
                <button
                  onClick={() => handleDeleteBankAccount(account.id)}
                  disabled={deletingBankAccountId === account.id}
                  className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingBankAccountId === account.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cashiers Information Card - Full Width */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-base font-bold mb-3 flex items-center gap-2 dark:text-white">
          <UserIcon size={18} />
          Cashiers Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Summary Card */}
          <div className="p-3 bg-gray-50 dark:bg-[#111] rounded border border-gray-300 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Cashiers</p>
                <p className="text-xl font-bold dark:text-white">{cashiers.length}</p>
              </div>
              <div className="w-10 h-10 bg-cyan-600 text-white rounded-full flex items-center justify-center">
                <UserIcon size={20} />
              </div>
            </div>
          </div>

          {/* Cashier List - spans 2 columns */}
          <div className="md:col-span-2">
            {loadingCashiers ? (
              <div className="text-center py-4 text-gray-500 text-sm">Loading cashiers...</div>
            ) : cashiers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cashiers.map((cashier: any) => (
                  <div key={cashier.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#111] rounded border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gray-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {cashier.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm dark:text-white">{cashier.full_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{cashier.phone_number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{cashier.commission_rate}%</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <UserIcon size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No cashiers added yet</p>
                <p className="text-xs mt-1">Go to Team → Cashiers tab</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Category Modal Component
function CategoryModal({ category, onClose }: any) {
  const [name, setName] = useState(category?.name || '')
  const [description, setDescription] = useState(category?.description || '')
  const [requiresImei, setRequiresImei] = useState(category?.requires_imei || false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Category name is required')
      return
    }

    try {
      setSaving(true)
      setError('')
      
      const storeId = getStoreId()
      const payload = category
        ? { id: category.id, name: name.trim(), description: description.trim() || null, requires_imei: requiresImei }
        : { store_id: storeId, name: name.trim(), description: description.trim() || null, requires_imei: requiresImei }

      const response = await fetch('/api/categories', {
        method: category ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      
      if (result.success) {
        onClose(true)
      } else {
        setError(result.error || 'Failed to save category')
      }
    } catch (err) {
      setError('Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 w-full max-w-md">
        <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white flex justify-between items-center">
          <h2 className="text-lg font-bold">{category ? 'Edit Category' : 'Add Category'}</h2>
          <button onClick={() => onClose(false)} className="hover:bg-gray-800 dark:hover:bg-gray-600 p-1 rounded dark:text-gray-400 dark:hover:text-gray-200">
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          {error && (
            <div className="mb-3 p-2 bg-red-100 border border-red-300 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          <div className="mb-3">
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-200">Category Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
              placeholder="e.g., Electronics, Clothing"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-200">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
              rows={3}
              placeholder="Optional description"
            />
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresImei}
                onChange={(e) => setRequiresImei(e.target.checked)}
                className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
              />
              <span className="text-sm font-medium">
                📱 Requires IMEI Tracking
              </span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
              Products in this category will require IMEI numbers (for phones, tablets, etc.)
            </p>
            {category && requiresImei !== category.requires_imei && (
              <p className="text-xs text-orange-600 font-medium mt-1 ml-6">
                ⚠️ This will update all existing products in this category
              </p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : category ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Subcategory Modal Component
function SubcategoryModal({ subcategory, categoryId, onClose }: any) {
  const [name, setName] = useState(subcategory?.name || '')
  const [description, setDescription] = useState(subcategory?.description || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Subcategory name is required')
      return
    }

    try {
      setSaving(true)
      setError('')
      
      const payload = subcategory
        ? { id: subcategory.id, name: name.trim(), description: description.trim() || null }
        : { category_id: categoryId, name: name.trim(), description: description.trim() || null }

      const response = await fetch('/api/subcategories', {
        method: subcategory ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      
      if (result.success) {
        onClose(true)
      } else {
        setError(result.error || 'Failed to save subcategory')
      }
    } catch (err) {
      setError('Failed to save subcategory')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 w-full max-w-md">
        <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white flex justify-between items-center">
          <h2 className="text-lg font-bold">{subcategory ? 'Edit Subcategory' : 'Add Subcategory'}</h2>
          <button onClick={() => onClose(false)} className="hover:bg-gray-800 dark:hover:bg-gray-600 p-1 rounded dark:text-gray-400 dark:hover:text-gray-200">
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          {error && (
            <div className="mb-3 p-2 bg-red-100 border border-red-300 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          <div className="mb-3">
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-200">Subcategory Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
              placeholder="e.g., Smartphones, T-Shirts"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5 dark:text-gray-200">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded text-sm dark:bg-gray-800 dark:text-white"
              rows={3}
              placeholder="Optional description"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : subcategory ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Initial Stock Tab Component
function InitialStockTab() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showRestockModal, setShowRestockModal] = useState(false)

  return (
    <div>
      <div className="bg-blue-50 border-2 border-blue-600 rounded p-4 mb-6">
        <h3 className="font-bold text-blue-900 mb-2">📦 Initial Stock Setup</h3>
        <p className="text-sm text-blue-800 mb-2">
          Use this section to add your existing inventory when first migrating to Atom.
        </p>
        <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
          <li><strong>Initial stock added here will NOT be counted as expenses</strong></li>
          <li>This is for one-time migration of existing inventory</li>
          <li>Future restocking through the Inventory tab WILL be tracked as expenses</li>
          <li>Stock value will be calculated using the cost prices you enter</li>
        </ul>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded border-2 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-600 text-green-900' 
            : 'bg-red-50 border-red-600 text-red-900'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded p-6">
        <div className="text-center">
          <div className="mb-4">
            <PlusIcon size={48} className="mx-auto text-gray-400 mb-2" />
            <h3 className="text-lg font-bold mb-2 dark:text-white">Add Initial Stock</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Click below to add products and their initial quantities to your inventory
            </p>
          </div>

          <button
            onClick={() => setShowRestockModal(true)}
            className="px-6 py-3 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors font-medium"
          >
            Add Initial Stock Items
          </button>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-300 rounded text-left">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Important:</strong> Once you've added your initial stock, future restocking should be done through the 
              <strong> Inventory → Restock</strong> page. This ensures proper expense tracking and financial reporting.
            </p>
          </div>
        </div>
      </div>

      {/* Restock Modal (marked as initial stock) */}
      {showRestockModal && (
        <AddStockModal
          isInitialStock={true}
          onClose={(refreshed) => {
            setShowRestockModal(false)
            if (refreshed) {
              setMessage({ 
                type: 'success', 
                text: 'Initial stock added successfully! This stock will not affect your expenses.' 
              })
              setTimeout(() => setMessage(null), 5000)
            }
          }}
        />
      )}
    </div>
  )
}

// Cashiers Tab Component
function CashiersTab({ cashiers, onAddCashier, onEditCashier, onRefresh }: any) {
  const [deleting, setDeleting] = useState<number | null>(null)

  const handleDeleteCashier = async (id: number) => {
    if (!confirm('Are you sure you want to delete this cashier?')) return

    try {
      setDeleting(id)
      const response = await fetch(`/api/cashiers?id=${id}`, { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        onRefresh()
      } else {
        alert(result.error || 'Failed to delete cashier')
      }
    } catch (err) {
      alert('Failed to delete cashier')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b-2 border-black dark:border-gray-600 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold dark:text-white">Cashiers</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Manage store cashiers and their commission rates</p>
        </div>
        <button
          onClick={onAddCashier}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 text-sm"
        >
          <PlusIcon size={16} />
          Add Cashier
        </button>
      </div>

      <div className="p-4">
        {cashiers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <UserIcon size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No cashiers added yet</p>
            <p className="text-xs mt-1">Click "Add Cashier" to add your first cashier</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {cashiers.map((cashier: Cashier) => (
              <div
                key={cashier.id}
                className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded flex justify-between items-center hover:border-black dark:hover:border-gray-400 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-bold">
                      {cashier.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold dark:text-white">{cashier.full_name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{cashier.phone_number}</p>
                      <div className="flex gap-3 mt-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Salary: ${cashier.salary?.toLocaleString() || 0}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Commission: {cashier.commission_rate}%</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditCashier(cashier)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Edit Cashier"
                  >
                    <PencilSimpleIcon size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteCashier(cashier.id)}
                    disabled={deleting === cashier.id}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="Delete Cashier"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Cashier Modal Component
function CashierModal({ cashier, onClose }: { cashier: Cashier | null, onClose: (refresh?: boolean) => void }) {
  const [formData, setFormData] = useState({
    full_name: cashier?.full_name || '',
    phone_number: cashier?.phone_number || '',
    commission_rate: cashier?.commission_rate || 0,
    salary: cashier?.salary || 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.full_name.trim()) {
      setError('Cashier name is required')
      return
    }
    if (!formData.phone_number.trim()) {
      setError('Phone number is required')
      return
    }

    try {
      setSaving(true)
      const storeId = getStoreId()
      
      const response = await fetch('/api/cashiers', {
        method: cashier ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          store_id: storeId,
          ...(cashier && { id: cashier.id })
        }),
      })

      const result = await response.json()

      if (result.success) {
        onClose(true)
      } else {
        setError(result.error || 'Failed to save cashier')
      }
    } catch (err) {
      setError('Failed to save cashier')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 w-full max-w-md">
        <div className="p-4 border-b-2 border-black dark:border-gray-600 flex justify-between items-center">
          <h2 className="text-lg font-bold dark:text-white">{cashier ? 'Edit Cashier' : 'Add Cashier'}</h2>
          <button onClick={() => onClose()} className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-gray-200">
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-bold mb-2 dark:text-gray-200">
              Full Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
              placeholder="Enter cashier name"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-2 dark:text-gray-200">
              Phone Number <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
              placeholder="Enter phone number"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-2 dark:text-gray-200">
              Monthly Salary
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
              placeholder="Enter monthly salary (e.g., 25000)"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold mb-2 dark:text-gray-200">
              Commission Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.commission_rate}
              onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
              placeholder="Enter commission rate (e.g., 5.5 for 5.5%)"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : cashier ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Suppliers Tab Component  
function SuppliersTab({ suppliers, onAddSupplier, onEditSupplier, onRecordPayment, onRefresh }: any) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold dark:text-white">Suppliers</h2>
            <p className="text-sm text-text-secondary mt-0.5">Manage your suppliers and track payments</p>
          </div>
          <button
            onClick={onAddSupplier}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 text-sm"
          >
            <PlusIcon size={16} />
            Add Supplier
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Phone</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Initial Balance</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Balance Owed</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total Paid</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Last Payment</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">
                  No suppliers found. Add your first supplier to get started.
                </td>
              </tr>
            ) : (
              suppliers.map((supplier: any) => (
                <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-5 py-3 text-sm font-medium dark:text-white">{supplier.supplier_name}</td>
                  <td className="px-5 py-3 text-sm dark:text-gray-400">{supplier.phone_number}</td>
                  <td className="px-5 py-3 text-sm dark:text-gray-400">{formatCurrency(supplier.initial_balance || 0)}</td>
                  <td className="px-5 py-3 text-sm">
                    <span className={supplier.balance_owed > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                      {formatCurrency(supplier.balance_owed || 0)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm dark:text-gray-400">{formatCurrency(supplier.total_paid || 0)}</td>
                  <td className="px-5 py-3 text-sm dark:text-gray-400">
                    {supplier.last_payment_date ? new Date(supplier.last_payment_date).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' }) : 'Never'}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    <div className="flex items-center justify-center gap-2">
                      {supplier.balance_owed > 0 && (
                        <button
                          onClick={() => onRecordPayment(supplier)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="Record Payment"
                        >
                          <CurrencyDollarIcon size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => onEditSupplier(supplier)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <PencilSimpleIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Supplier Modal Component
function SupplierModal({ supplier, onClose }: { supplier: any, onClose: (refresh?: boolean) => void }) {
  const [formData, setFormData] = useState({
    name: supplier?.supplier_name || '',
    phone_number: supplier?.phone_number || '',
    initial_balance: supplier?.initial_balance?.toString() || '0'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const storeId = getStoreId()
      if (!storeId) throw new Error('Store ID not found')

      const url = supplier 
        ? `/api/suppliers?id=${supplier.id}`
        : '/api/suppliers'

      const response = await fetch(url, {
        method: supplier ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_name: formData.name,
          phone_number: formData.phone_number,
          store_id: storeId.toString(),
          initial_balance: parseFloat(formData.initial_balance) || 0
        })
      })

      const result = await response.json()

      if (result.success) {
        onClose(true)
      } else {
        setError(result.error || 'Failed to save supplier')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold dark:text-white">{supplier ? 'Edit Supplier' : 'Add New Supplier'}</h3>
          <button onClick={() => onClose()} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
              placeholder="Enter supplier name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
              placeholder="Enter phone number"
            />
          </div>

          {!supplier && (
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                Initial Balance (if migrating existing supplier)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.initial_balance}
                onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter any existing balance owed to this supplier (for migration purposes)
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : supplier ? 'Update Supplier' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Payment Recording Modal Component
function PaymentModal({ supplier, onClose }: { supplier: any, onClose: (refresh?: boolean) => void }) {
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Digital'>('Cash')
  const [isSplitPayment, setIsSplitPayment] = useState(false)
  const [cashPaid, setCashPaid] = useState('')
  const [digitalPaid, setDigitalPaid] = useState('')
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false)
  const [selectedBankAccount, setSelectedBankAccount] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchBankAccounts()
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const parseAmountValue = (value: string) => {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const getPaidTotal = () => {
    if (isSplitPayment) {
      return parseAmountValue(cashPaid) + parseAmountValue(digitalPaid)
    }

    return parseAmountValue(amount)
  }

  const hasDigitalPayment = () => {
    if (isSplitPayment) {
      return parseAmountValue(digitalPaid) > 0
    }

    return paymentMethod === 'Digital'
  }

  const fetchBankAccounts = async () => {
    try {
      setBankAccountsLoading(true)
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/bank-accounts?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setBankAccounts(result.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch bank accounts:', err)
    } finally {
      setBankAccountsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const totalPayment = getPaidTotal()
    const cashAmount = parseAmountValue(cashPaid)
    const digitalAmount = parseAmountValue(digitalPaid)
    const requiresDigital = hasDigitalPayment()

    if (isSplitPayment && cashAmount === 0 && digitalAmount === 0) {
      setError('Enter a cash or digital amount for split payment')
      return
    }

    if (!isSplitPayment && totalPayment <= 0) {
      setError('Please enter a valid payment amount')
      return
    }

    if (totalPayment > supplier.balance_owed) {
      setError('Payment amount cannot exceed balance owed')
      return
    }

    if (requiresDigital && bankAccounts.length === 0) {
      setError('No bank account found. Please add one in Store Settings before taking digital payments.')
      return
    }

    if (requiresDigital && !selectedBankAccount) {
      setError('Please select a bank account for Digital payment')
      return
    }

    setSaving(true)

    try {
      const storeId = getStoreId()
      if (!storeId) throw new Error('Store ID not found')

      const paymentSplits = isSplitPayment
        ? [
            cashAmount > 0
              ? { payment_method: 'Cash', amount: cashAmount }
              : null,
            digitalAmount > 0
              ? { payment_method: 'Digital', amount: digitalAmount, bank_account_name: selectedBankAccount }
              : null,
          ].filter(Boolean)
        : [
            {
              payment_method: paymentMethod,
              amount: totalPayment,
              bank_account_name: requiresDigital ? selectedBankAccount : null,
            },
          ]

      const response = await fetch('/api/supplier-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplier.id,
          store_id: storeId,
          amount: totalPayment,
          payment_method: isSplitPayment ? 'Mixed' : paymentMethod,
          payments: paymentSplits,
          bank_account_name: requiresDigital ? selectedBankAccount : null,
          notes: notes || null
        })
      })

      const result = await response.json()

      if (result.success) {
        onClose(true)
      } else {
        setError(result.error || 'Failed to record payment')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-lg font-bold dark:text-white">Record Supplier Payment</h2>
          <button onClick={() => onClose()} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-200 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400">Supplier</p>
                <p className="font-medium dark:text-white">{supplier.company_name}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Balance Owed</p>
                <p className="font-medium dark:text-white">{formatCurrency(supplier.balance_owed)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium dark:text-gray-200">Split Payment</span>
            <button
              type="button"
              onClick={() => {
                setIsSplitPayment((prev) => !prev)
                setAmount('')
                setCashPaid('')
                setDigitalPaid('')
                setPaymentMethod('Cash')
                setSelectedBankAccount('')
              }}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                isSplitPayment
                  ? 'bg-cyan-600 text-white border-cyan-600'
                  : 'bg-white border-gray-300 text-gray-700 dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-gray-300'
              }`}
            >
              {isSplitPayment ? 'On' : 'Off'}
            </button>
          </div>

          {!isSplitPayment ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                  Payment Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
                  placeholder="0.00"
                  max={supplier.balance_owed}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value as 'Cash' | 'Digital')
                    setSelectedBankAccount('')
                  }}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="Digital">Digital</option>
                </select>
              </div>

              {paymentMethod === 'Digital' && (
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                    Bank Account <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedBankAccount}
                    onChange={(e) => setSelectedBankAccount(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">Select bank account</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.account_name}>
                        {account.account_name}
                      </option>
                    ))}
                  </select>
                  {bankAccountsLoading && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Loading bank accounts...</p>
                  )}
                  {!bankAccountsLoading && bankAccounts.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      No bank account found. Add one in Store Settings.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                  Split Amounts <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block mb-1 text-[11px] text-gray-500 dark:text-gray-400">Cash</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cashPaid}
                      onChange={(e) => setCashPaid(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-[11px] text-gray-500 dark:text-gray-400">Digital</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={digitalPaid}
                      onChange={(e) => setDigitalPaid(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Total Paid: {formatCurrency(getPaidTotal())}
                </p>
              </div>

              {parseAmountValue(digitalPaid) > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                    Bank Account <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedBankAccount}
                    onChange={(e) => setSelectedBankAccount(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">Select bank account</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.account_name}>
                        {account.account_name}
                      </option>
                    ))}
                  </select>
                  {bankAccountsLoading && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Loading bank accounts...</p>
                  )}
                  {!bankAccountsLoading && bankAccounts.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      No bank account found. Add one in Store Settings.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
              placeholder="Add any notes about this payment..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
            >
              {saving ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Initial Customers Tab Component
function InitialCustomersTab({ entries, onAddEntry, onEditEntry, onRefresh }: any) {
  const [deleting, setDeleting] = useState<number | null>(null)

  const handleDeleteEntry = async (id: number) => {
    if (!confirm('Are you sure you want to delete this initial customer entry?')) return

    try {
      setDeleting(id)
      const response = await fetch(`/api/initial-customers?id=${id}`, { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        onRefresh()
      } else {
        alert(result.error || 'Failed to delete entry')
      }
    } catch (err) {
      alert('Failed to delete entry')
    } finally {
      setDeleting(null)
    }
  }

  const totalOwed = entries.reduce((sum: number, entry: any) => sum + (entry.amount_owed || 0), 0)

  return (
    <div>
      <div className="bg-blue-50 border-2 border-blue-600 rounded p-4 mb-6">
        <h3 className="font-bold text-blue-900 mb-2">📋 Initial Customer Entries (Migration)</h3>
        <p className="text-sm text-blue-800 mb-2">
          Use this section to record customers who owe you money when migrating from another system.
        </p>
        <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
          <li><strong>These entries DO NOT affect profit/loss calculations</strong></li>
          <li>This is for one-time migration of existing customer debts</li>
          <li>Future customer credit through POS will be tracked separately</li>
        </ul>
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b-2 border-black dark:border-gray-600 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold dark:text-white">Initial Customer Balances</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Owed: PKR {totalOwed.toFixed(2)}</p>
          </div>
          <button
            onClick={onAddEntry}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 text-sm"
          >
            <PlusIcon size={16} />
            Add Customer
          </button>
        </div>

        <div className="p-4">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <UsersIcon size={48} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No initial customer entries added yet</p>
              <p className="text-xs mt-1">Click "Add Customer" to record customers who owe money</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry: any) => (
                <div
                  key={entry.id}
                  className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded hover:border-black dark:hover:border-gray-400 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white">{entry.customer_name}</h3>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        {entry.customer_phone && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-200">{entry.customer_phone}</span>
                          </div>
                        )}
                        {entry.customer_cnic && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">CNIC:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-200">{entry.customer_cnic}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Amount Owed:</span>
                          <span className="ml-2 font-bold text-red-600">PKR {entry.amount_owed.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Added:</span>
                          <span className="ml-2 text-gray-900 dark:text-gray-200">
                            {new Date(entry.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                          </span>
                        </div>
                      </div>
                      {entry.notes && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">{entry.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => onEditEntry(entry)}
                        className="p-2 text-cyan-600 hover:bg-cyan-50 rounded transition-colors"
                      >
                        <PencilSimpleIcon size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={deleting === entry.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      >
                        <TrashIcon size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Initial Suppliers Tab Component
function InitialSuppliersTab({ entries, onAddEntry, onEditEntry, onRefresh }: any) {
  const [deleting, setDeleting] = useState<number | null>(null)

  const handleDeleteEntry = async (id: number) => {
    if (!confirm('Are you sure you want to delete this initial supplier entry?')) return

    try {
      setDeleting(id)
      const response = await fetch(`/api/initial-suppliers?id=${id}`, { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        onRefresh()
      } else {
        alert(result.error || 'Failed to delete entry')
      }
    } catch (err) {
      alert('Failed to delete entry')
    } finally {
      setDeleting(null)
    }
  }

  const totalOwed = entries.reduce((sum: number, entry: any) => sum + (entry.amount_owed || 0), 0)

  return (
    <div>
      <div className="bg-blue-50 border-2 border-blue-600 rounded p-4 mb-6">
        <h3 className="font-bold text-blue-900 mb-2">📦 Initial Supplier Entries (Migration)</h3>
        <p className="text-sm text-blue-800 mb-2">
          Use this section to record suppliers to whom you owe money when migrating from another system.
        </p>
        <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
          <li><strong>These entries DO NOT affect profit/loss calculations</strong></li>
          <li>This is for one-time migration of existing supplier debts</li>
          <li>Future supplier credit through inventory restocking will be tracked separately</li>
        </ul>
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b-2 border-black dark:border-gray-600 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold dark:text-white">Initial Supplier Balances</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Owed: PKR {totalOwed.toFixed(2)}</p>
          </div>
          <button
            onClick={onAddEntry}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 text-sm"
          >
            <PlusIcon size={16} />
            Add Supplier
          </button>
        </div>

        <div className="p-4">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <UsersIcon size={48} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No initial supplier entries added yet</p>
              <p className="text-xs mt-1">Click "Add Supplier" to record suppliers you owe money to</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry: any) => (
                <div
                  key={entry.id}
                  className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded hover:border-black dark:hover:border-gray-400 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white">{entry.supplier_name}</h3>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        {entry.contact_person && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Contact:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-200">{entry.contact_person}</span>
                          </div>
                        )}
                        {entry.supplier_phone && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-200">{entry.supplier_phone}</span>
                          </div>
                        )}
                        {entry.supplier_email && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Email:</span>
                            <span className="ml-2 text-gray-900 dark:text-gray-200">{entry.supplier_email}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Amount Owed:</span>
                          <span className="ml-2 font-bold text-red-600">PKR {entry.amount_owed.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Added:</span>
                          <span className="ml-2 text-gray-900 dark:text-gray-200">
                            {new Date(entry.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                          </span>
                        </div>
                      </div>
                      {entry.address && (
                        <div className="mt-2 text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Address:</span>
                          <span className="ml-2 text-gray-900 dark:text-gray-200">{entry.address}</span>
                        </div>
                      )}
                      {entry.notes && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">{entry.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => onEditEntry(entry)}
                        className="p-2 text-cyan-600 hover:bg-cyan-50 rounded transition-colors"
                      >
                        <PencilSimpleIcon size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={deleting === entry.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      >
                        <TrashIcon size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Initial Customer Modal Component
function InitialCustomerModal({ entry, onClose }: { entry: any, onClose: (refresh?: boolean) => void }) {
  const [formData, setFormData] = useState({
    customer_name: entry?.customer_name || '',
    customer_cnic: entry?.customer_cnic || '',
    customer_phone: entry?.customer_phone || '',
    amount_owed: entry?.amount_owed || '',
    notes: entry?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.customer_name || !formData.amount_owed) {
      setError('Customer name and amount owed are required')
      return
    }

    const amount = parseFloat(formData.amount_owed)
    if (isNaN(amount) || amount < 0) {
      setError('Amount owed must be a positive number')
      return
    }

    setSaving(true)

    try {
      const storeId = getStoreId()
      if (!storeId) throw new Error('Store ID not found')

      const url = entry ? '/api/initial-customers' : '/api/initial-customers'
      const method = entry ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry?.id,
          store_id: storeId,
          ...formData,
          amount_owed: amount,
        })
      })

      const result = await response.json()

      if (result.success) {
        onClose(true)
      } else {
        setError(result.error || 'Failed to save entry')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold dark:text-white">{entry ? 'Edit' : 'Add'} Initial Customer Entry</h3>
          <button onClick={() => onClose()} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Customer Phone</label>
            <input
              type="text"
              value={formData.customer_phone}
              onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Customer CNIC</label>
            <input
              type="text"
              value={formData.customer_cnic}
              onChange={(e) => setFormData({ ...formData, customer_cnic: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
              placeholder="XXXXX-XXXXXXX-X"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">
              Amount Owed <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount_owed}
              onChange={(e) => setFormData({ ...formData, amount_owed: e.target.value })}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : entry ? 'Update Entry' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Initial Supplier Modal Component
function InitialSupplierModal({ entry, onClose }: { entry: any, onClose: (refresh?: boolean) => void }) {
  const [formData, setFormData] = useState({
    supplier_name: entry?.supplier_name || '',
    contact_person: entry?.contact_person || '',
    supplier_phone: entry?.supplier_phone || '',
    supplier_email: entry?.supplier_email || '',
    address: entry?.address || '',
    amount_owed: entry?.amount_owed || '',
    notes: entry?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.supplier_name || !formData.amount_owed) {
      setError('Supplier name and amount owed are required')
      return
    }

    const amount = parseFloat(formData.amount_owed)
    if (isNaN(amount) || amount < 0) {
      setError('Amount owed must be a positive number')
      return
    }

    setSaving(true)

    try {
      const storeId = getStoreId()
      if (!storeId) throw new Error('Store ID not found')

      const url = '/api/initial-suppliers'
      const method = entry ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry?.id,
          store_id: storeId,
          ...formData,
          amount_owed: amount,
        })
      })

      const result = await response.json()

      if (result.success) {
        onClose(true)
      } else {
        setError(result.error || 'Failed to save entry')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-[#1a1a1a]">
          <h3 className="text-lg font-semibold dark:text-white">{entry ? 'Edit' : 'Add'} Initial Supplier Entry</h3>
          <button onClick={() => onClose()} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.supplier_name}
              onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Contact Person</label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Phone Number</label>
            <input
              type="text"
              value={formData.supplier_phone}
              onChange={(e) => setFormData({ ...formData, supplier_phone: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Email</label>
            <input
              type="email"
              value={formData.supplier_email}
              onChange={(e) => setFormData({ ...formData, supplier_email: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">
              Amount Owed <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount_owed}
              onChange={(e) => setFormData({ ...formData, amount_owed: e.target.value })}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded focus:border-black dark:focus:border-gray-400 outline-none dark:bg-gray-800 dark:text-white"
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t sticky bottom-0 bg-white dark:bg-[#1a1a1a]">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : entry ? 'Update Entry' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
