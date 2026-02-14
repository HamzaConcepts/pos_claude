'use client'

import { useEffect, useState } from 'react'
import { UsersIcon, ShieldIcon, UserIcon, ClockIcon, CheckCircleIcon, XCircleIcon, StorefrontIcon, TagIcon, GridFourIcon, PlusIcon, PencilSimpleIcon, TrashIcon, XIcon, CurrencyDollarIcon, ReceiptIcon, FileTextIcon, PrinterIcon, UserPlusIcon } from '@phosphor-icons/react'
import { getStoreId } from '@/lib/supabase'
import AddStockModal from '@/components/AddStockModal'
import PredefinedExpensesManager from '@/components/PredefinedExpensesManager'
import { useDarkMode } from '@/hooks/useDarkMode'

interface UserData {
  id: string
  email: string
  full_name: string
  role: 'Manager' | 'Cashier'
  created_at: string
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

export default function StorePage() {
  const isDarkMode = useDarkMode()
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
  const [settingsSubTab, setSettingsSubTab] = useState<'info' | 'expenses' | 'withdrawals'>('info')
  
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
      fetchWithdrawals()
    ])
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
        return 'bg-gray-200 text-gray-900'
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${isDarkMode ? 'border-cyan-500' : 'border-black'}`}></div>
          <p className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading store data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className={`text-2xl font-bold mb-1.5 ${isDarkMode ? 'text-white' : ''}`}>Store Management</h1>
          <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-text-secondary'}`}>Manage users, categories, and store settings</p>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-status-error text-white rounded text-sm">
          {error}
        </div>
      )}

      {/* Tab Navigation - Simplified with 4 main tabs */}
      <div className={`mb-5 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'team'
                ? (isDarkMode ? 'border-cyan-500 bg-gray-700 text-cyan-400' : 'border-cyan-600 bg-cyan-50 text-cyan-700')
                : (isDarkMode ? 'border-transparent hover:bg-gray-800 text-gray-400' : 'border-transparent hover:bg-gray-50 text-gray-600')
            }`}>
            <UsersIcon size={16} />
            Team
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'products'
                ? (isDarkMode ? 'border-cyan-500 bg-gray-700 text-cyan-400' : 'border-cyan-600 bg-cyan-50 text-cyan-700')
                : (isDarkMode ? 'border-transparent hover:bg-gray-800 text-gray-400' : 'border-transparent hover:bg-gray-50 text-gray-600')
            }`}>
            <GridFourIcon size={16} />
            Products
          </button>
          <button
            onClick={() => setActiveTab('partners')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'partners'
                ? (isDarkMode ? 'border-cyan-500 bg-gray-700 text-cyan-400' : 'border-cyan-600 bg-cyan-50 text-cyan-700')
                : (isDarkMode ? 'border-transparent hover:bg-gray-800 text-gray-400' : 'border-transparent hover:bg-gray-50 text-gray-600')
            }`}>
            <UserPlusIcon size={16} />
            Partners
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'settings'
                ? (isDarkMode ? 'border-cyan-500 bg-gray-700 text-cyan-400' : 'border-cyan-600 bg-cyan-50 text-cyan-700')
                : (isDarkMode ? 'border-transparent hover:bg-gray-800 text-gray-400' : 'border-transparent hover:bg-gray-50 text-gray-600')
            }`}>
            <StorefrontIcon size={16} />
            Settings
          </button>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      {activeTab === 'team' && (
        <div className={`mb-4 flex gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          <button
            onClick={() => setTeamSubTab('users')}
            className={`px-3 py-1.5 text-sm rounded ${
              teamSubTab === 'users'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700')
                : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')
            }`}>
            Users
          </button>
          <button
            onClick={() => setTeamSubTab('cashiers')}
            className={`px-3 py-1.5 text-sm rounded ${
              teamSubTab === 'cashiers'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700')
                : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')
            }`}>
            Cashiers
          </button>
        </div>
      )}

      {activeTab === 'products' && (
        <div className={`mb-4 flex gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          <button
            onClick={() => setProductsSubTab('categories')}
            className={`px-3 py-1.5 text-sm rounded ${
              productsSubTab === 'categories'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700')
                : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')
            }`}>
            Categories
          </button>
          <button
            onClick={() => setProductsSubTab('initial-stock')}
            className={`px-3 py-1.5 text-sm rounded ${
              productsSubTab === 'initial-stock'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700')
                : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')
            }`}>
            Initial Stock
          </button>
        </div>
      )}

      {activeTab === 'partners' && (
        <div className={`mb-4 flex gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          <button
            onClick={() => setPartnersSubTab('initial-suppliers')}
            className={`px-3 py-1.5 text-sm rounded ${
              partnersSubTab === 'initial-suppliers'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700')
                : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')
            }`}>
            Initial Suppliers
          </button>
          <button
            onClick={() => setPartnersSubTab('initial-customers')}
            className={`px-3 py-1.5 text-sm rounded ${
              partnersSubTab === 'initial-customers'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700')
                : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')
            }`}>
            Initial Customers
          </button>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className={`mb-4 flex gap-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          <button
            onClick={() => setSettingsSubTab('info')}
            className={`px-3 py-1.5 text-sm rounded ${
              settingsSubTab === 'info'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700')
                : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')
            }`}>
            Store Info
          </button>
          <button
            onClick={() => setSettingsSubTab('expenses')}
            className={`px-3 py-1.5 text-sm rounded ${
              settingsSubTab === 'expenses'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700')
                : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')
            }`}>
            Expense Types
          </button>
          <button
            onClick={() => setSettingsSubTab('withdrawals')}
            className={`px-3 py-1.5 text-sm rounded ${
              settingsSubTab === 'withdrawals'
                ? (isDarkMode ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700')
                : (isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')
            }`}>
            Owner Withdrawals
          </button>
        </div>
      )}

      {/* Team Tab - Users */}
      {activeTab === 'team' && teamSubTab === 'users' && (
        <div>
          {/* Pending Join Requests */}
          {joinRequests.length > 0 && (
            <div className="mb-5 bg-white rounded border border-gray-200 overflow-hidden">
              <div className="p-3 bg-yellow-50 border-b border-yellow-200">
                <div className="flex items-center gap-2">
                  <ClockIcon className="text-yellow-600" size={16} />
                  <h2 className="text-base font-semibold text-gray-900">Pending Join Requests ({joinRequests.length})</h2>
                </div>
              </div>

              <div className="p-3">
                {joinRequests.map((request: JoinRequest) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 mb-2.5 bg-gray-50 rounded border border-gray-200 last:mb-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-gray-400 text-white rounded-full flex items-center justify-center font-semibold text-sm">
                          {request.user_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-gray-900">{request.user_name}</p>
                          <p className="text-xs text-gray-600">
                            {request.user_email || request.user_phone}
                          </p>
                          <div className="flex items-center gap-2.5 mt-0.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                              request.user_type === 'Manager' ? 'bg-cyan-600 text-white' : 'bg-gray-500 text-white'
                            }`}>
                              {request.user_type === 'Manager' ? <ShieldIcon size={10} /> : <UserIcon size={10} />}
                              {request.user_type}
                            </span>
                            <span className="text-xs text-gray-600">
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
            <div className="bg-white p-4 rounded border border-gray-200">
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldIcon className="text-cyan-600" size={18} />
                <span className="text-sm font-medium text-gray-700">Managers</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {users.filter(u => u.role === 'Manager').length}
              </p>
            </div>

            <div className="bg-white p-4 rounded border border-gray-200">
              <div className="flex items-center gap-2 mb-1.5">
                <UserIcon className="text-cyan-600" size={18} />
                <span className="text-sm font-medium text-gray-700">Cashiers</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {cashiersForUserTab.length}
              </p>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">All Users ({users.filter(u => u.role === 'Manager').length + cashiersForUserTab.length})</h2>
            </div>

            {users.filter(u => u.role === 'Manager').length === 0 && cashiersForUserTab.length === 0 ? (
              <div className="p-6 text-center text-gray-600 text-sm">
                No users found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700">Name</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700">Contact</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700">Role</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => u.role === 'Manager').map((user, index) => (
                      <tr
                        key={`manager-${user.id}`}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-cyan-600 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                              {user.full_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-sm text-gray-900">{user.full_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{user.email}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium ${getRoleColor('Manager')}`}>
                            {getRoleIcon('Manager')}
                            Manager
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">
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
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gray-500 text-white rounded-full flex items-center justify-center font-semibold text-xs">
                              {cashier.full_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-sm text-gray-900">{cashier.full_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{cashier.phone_number}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium ${getRoleColor('Cashier')}`}>
                            {getRoleIcon('Cashier')}
                            Cashier
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">
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
          <div className="mt-5 bg-gray-50 p-4 rounded border border-gray-200">
            <h3 className="font-semibold mb-2.5 text-sm text-gray-900">Role Permissions</h3>
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
        <div className={`rounded border p-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <PredefinedExpensesManager />
        </div>
      )}

      {/* Settings Tab - Owner Withdrawals */}
      {activeTab === 'settings' && settingsSubTab === 'withdrawals' && (
        <div className={`rounded border p-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Owner Withdrawals</h2>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
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
          <div className={`mb-6 p-4 rounded border ${isDarkMode ? 'bg-blue-900/20 border-blue-700/50' : 'bg-blue-50 border-blue-200'}`}>
            <p className={`text-sm ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
              <strong>Important:</strong> Owner withdrawals only reduce cash in hand or bank balance. They do not affect profit/loss calculations since they are capital outflows, not business expenses.
            </p>
          </div>

          {/* Withdrawals List */}
          {withdrawals.length === 0 ? (
            <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No withdrawals recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`border-b ${isDarkMode ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
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
                      className={`border-b ${isDarkMode ? 'border-gray-700 bg-gray-800 hover:bg-gray-750' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
                    >
                      <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        {new Date(withdrawal.withdrawal_date).toLocaleDateString('en-PK', {
                          timeZone: 'Asia/Karachi',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                        PKR {withdrawal.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          withdrawal.withdrawal_from === 'Cash'
                            ? isDarkMode ? 'bg-green-900/30 text-green-400 border border-green-700' : 'bg-green-100 text-green-700 border border-green-300'
                            : isDarkMode ? 'bg-blue-900/30 text-blue-400 border border-blue-700' : 'bg-blue-100 text-blue-700 border border-blue-300'
                        }`}>
                          {withdrawal.withdrawal_from}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        {withdrawal.description || '-'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {withdrawal.recorded_by_name || 'System'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => deleteWithdrawal(withdrawal.id)}
                          className={`p-1.5 rounded hover:bg-red-100 ${isDarkMode ? 'text-red-400 hover:bg-red-900/30' : 'text-red-600'}`}
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

      {/* Withdrawal Modal */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg p-6 max-w-md w-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Record Owner Withdrawal</h3>
              <button
                onClick={() => setShowWithdrawalModal(false)}
                className={`p-1 rounded ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <XIcon size={20} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block mb-1 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Amount <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={withdrawalForm.amount}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                  className={`w-full px-3 py-2 border rounded focus:outline-none focus:border-cyan-600 ${
                    isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className={`block mb-1 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Withdraw From <span className="text-red-600">*</span>
                </label>
                <select
                  value={withdrawalForm.withdrawal_from}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, withdrawal_from: e.target.value })}
                  className={`w-full px-3 py-2 border rounded focus:outline-none focus:border-cyan-600 ${
                    isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                </select>
              </div>

              <div>
                <label className={`block mb-1 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={withdrawalForm.withdrawal_date}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, withdrawal_date: e.target.value })}
                  className={`w-full px-3 py-2 border rounded focus:outline-none focus:border-cyan-600 ${
                    isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className={`block mb-1 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Description (Optional)
                </label>
                <textarea
                  value={withdrawalForm.description}
                  onChange={(e) => setWithdrawalForm({ ...withdrawalForm, description: e.target.value })}
                  className={`w-full px-3 py-2 border rounded focus:outline-none focus:border-cyan-600 ${
                    isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
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
                  className={`flex-1 px-4 py-2 rounded ${
                    isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
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
        <div className="bg-white rounded border border-gray-200 p-8 text-center">
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
            <div key={category.id} className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="p-3 bg-gray-100 flex justify-between items-center">
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
                    className="flex items-center gap-1 px-2.5 py-1 bg-white border border-black rounded hover:bg-gray-50 transition-colors text-xs"
                  >
                    <PlusIcon size={12} />
                    Add Subcategory
                  </button>
                  <button
                    onClick={() => onEditCategory(category)}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
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
                        className="flex items-center justify-between p-2 bg-bg-secondary rounded border border-gray-300"
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
                            className="p-1 hover:bg-gray-300 rounded transition-colors"
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
  const [receiptType, setReceiptType] = useState<'pdf' | 'thermal'>('pdf')

  useEffect(() => {
    fetchCashiers()
    // Load receipt type from localStorage
    const savedReceiptType = localStorage.getItem('pos_receipt_type')
    if (savedReceiptType === 'thermal' || savedReceiptType === 'pdf') {
      setReceiptType(savedReceiptType)
    }
  }, [])

  // Update state when storeInfo changes
  useEffect(() => {
    if (storeInfo) {
      setStoreCode(storeInfo.store_code || '')
      setCurrency(storeInfo.currency || 'PKR')
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

  return (
    <div>
      {/* Grid Layout for Store Information and Receipt Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Store Information Card */}
        <div className="bg-white rounded border border-gray-200 p-4">
          <h2 className="text-base font-bold mb-3 flex items-center gap-2">
            <StorefrontIcon size={18} />
            Store Information
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600">Store Name</label>
              <div className="p-2 bg-gray-100 rounded border border-gray-300 text-sm">
                {storeInfo?.store_name || 'Not set'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600">Auto-Generated Store Code (3-Digit)</label>
              <div className="p-2 bg-gray-100 rounded border border-gray-300">
                <span className="font-mono font-bold">{storeInfo?.store_code || 'Not set'}</span>
              </div>
              <p className="text-xs text-text-secondary mt-1">Automatically generated</p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600">Custom Store Code</label>
              {editing ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm"
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
                    className="px-3 py-1.5 border border-gray-200 rounded hover:bg-gray-100 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2 bg-gray-100 rounded border border-gray-300">
                  <span className="text-sm font-mono">{storeInfo?.store_code || 'Not set'}</span>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 px-2 py-1 bg-white border border-black rounded hover:bg-gray-50 text-xs"
                  >
                    <PencilSimpleIcon size={12} />
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600">Store Currency</label>
              {editing ? (
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
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
                <div className="flex items-center justify-between p-2 bg-gray-100 rounded border border-gray-300">
                  <span className="text-sm font-mono">{storeInfo?.currency || 'PKR'}</span>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 px-2 py-1 bg-white border border-black rounded hover:bg-gray-50 text-xs"
                  >
                    <PencilSimpleIcon size={12} />
                    Edit
                  </button>
                </div>
              )}
              <p className="text-xs text-text-secondary mt-1">Currency used throughout the app</p>
            </div>
          </div>
        </div>

        {/* Receipt Settings Card */}
        <div className="bg-white rounded border border-gray-200 p-4">
          <h2 className="text-base font-bold mb-3 flex items-center gap-2">
            <ReceiptIcon size={18} />
            Receipt Settings
          </h2>

          <div>
            <label className="block text-xs font-medium mb-2 text-gray-600">Receipt Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setReceiptType('pdf')
                  localStorage.setItem('pos_receipt_type', 'pdf')
                }}
                className={`p-3 rounded border-2 transition-all ${
                  receiptType === 'pdf'
                    ? 'border-cyan-600 bg-cyan-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <FileTextIcon size={24} className={receiptType === 'pdf' ? 'text-cyan-600' : 'text-gray-500'} />
                  <span className={`font-medium text-sm ${receiptType === 'pdf' ? 'text-cyan-600' : 'text-gray-700'}`}>
                    PDF
                  </span>
                  <span className="text-xs text-gray-500 text-center">
                    A4/Letter
                  </span>
                </div>
              </button>
              <button
                onClick={() => {
                  setReceiptType('thermal')
                  localStorage.setItem('pos_receipt_type', 'thermal')
                }}
                className={`p-3 rounded border-2 transition-all ${
                  receiptType === 'thermal'
                    ? 'border-cyan-600 bg-cyan-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <PrinterIcon size={24} className={receiptType === 'thermal' ? 'text-cyan-600' : 'text-gray-500'} />
                  <span className={`font-medium text-sm ${receiptType === 'thermal' ? 'text-cyan-600' : 'text-gray-700'}`}>
                    Thermal
                  </span>
                  <span className="text-xs text-gray-500 text-center">
                    58mm/80mm
                  </span>
                </div>
              </button>
            </div>
            <p className="text-xs text-text-secondary mt-2">
              Select receipt format for your printer type.
            </p>
          </div>
        </div>
      </div>

      {/* Cashiers Information Card - Full Width */}
      <div className="bg-white rounded border border-gray-200 p-4">
        <h2 className="text-base font-bold mb-3 flex items-center gap-2">
          <UserIcon size={18} />
          Cashiers Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Summary Card */}
          <div className="p-3 bg-gray-50 rounded border border-gray-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Total Cashiers</p>
                <p className="text-xl font-bold">{cashiers.length}</p>
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
                  <div key={cashier.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gray-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {cashier.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{cashier.full_name}</p>
                        <p className="text-xs text-gray-500">{cashier.phone_number}</p>
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
      <div className="bg-white rounded border border-gray-200 w-full max-w-md">
        <div className="p-3 bg-gray-50 border-b border-gray-200 text-gray-900 flex justify-between items-center">
          <h2 className="text-lg font-bold">{category ? 'Edit Category' : 'Add Category'}</h2>
          <button onClick={() => onClose(false)} className="hover:bg-gray-800 p-1 rounded">
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
            <label className="block text-sm font-medium mb-1.5">Category Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
              placeholder="e.g., Electronics, Clothing"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
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
            <p className="text-xs text-gray-500 mt-1 ml-6">
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
              className="px-4 py-2 border border-gray-200 rounded hover:bg-gray-100 text-sm"
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
      <div className="bg-white rounded border border-gray-200 w-full max-w-md">
        <div className="p-3 bg-gray-50 border-b border-gray-200 text-gray-900 flex justify-between items-center">
          <h2 className="text-lg font-bold">{subcategory ? 'Edit Subcategory' : 'Add Subcategory'}</h2>
          <button onClick={() => onClose(false)} className="hover:bg-gray-800 p-1 rounded">
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
            <label className="block text-sm font-medium mb-1.5">Subcategory Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
              placeholder="e.g., Smartphones, T-Shirts"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
              rows={3}
              placeholder="Optional description"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-4 py-2 border border-gray-200 rounded hover:bg-gray-100 text-sm"
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
          Use this section to add your existing inventory when first migrating to this POS system.
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

      <div className="bg-white border border-gray-200 rounded p-6">
        <div className="text-center">
          <div className="mb-4">
            <PlusIcon size={48} className="mx-auto text-gray-400 mb-2" />
            <h3 className="text-lg font-bold mb-2">Add Initial Stock</h3>
            <p className="text-sm text-gray-600 mb-4">
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
    <div className="bg-white rounded border border-gray-200 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b-2 border-black flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold">Cashiers</h2>
          <p className="text-sm text-gray-600">Manage store cashiers and their commission rates</p>
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
                className="p-4 border-2 border-gray-300 rounded flex justify-between items-center hover:border-black transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center font-bold">
                      {cashier.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold">{cashier.full_name}</p>
                      <p className="text-sm text-gray-600">{cashier.phone_number}</p>
                      <div className="flex gap-3 mt-1">
                        <p className="text-xs text-gray-500">Salary: ${cashier.salary?.toLocaleString() || 0}</p>
                        <p className="text-xs text-gray-500">Commission: {cashier.commission_rate}%</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditCashier(cashier)}
                    className="p-2 text-gray-600 hover:text-black hover:bg-gray-100 rounded transition-colors"
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
      <div className="bg-white rounded border border-gray-200 w-full max-w-md">
        <div className="p-4 border-b-2 border-black flex justify-between items-center">
          <h2 className="text-lg font-bold">{cashier ? 'Edit Cashier' : 'Add Cashier'}</h2>
          <button onClick={() => onClose()} className="text-gray-500 hover:text-black">
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
            <label className="block text-sm font-bold mb-2">
              Full Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
              placeholder="Enter cashier name"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-2">
              Phone Number <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
              placeholder="Enter phone number"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-2">
              Monthly Salary
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
              placeholder="Enter monthly salary (e.g., 25000)"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold mb-2">
              Commission Rate (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.commission_rate}
              onChange={(e) => setFormData({ ...formData, commission_rate: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
              placeholder="Enter commission rate (e.g., 5.5 for 5.5%)"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 border border-gray-200 rounded hover:bg-gray-100 text-sm"
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
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-5 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold">Suppliers</h2>
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
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Phone</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Initial Balance</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Balance Owed</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Paid</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Last Payment</th>
              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">
                  No suppliers found. Add your first supplier to get started.
                </td>
              </tr>
            ) : (
              suppliers.map((supplier: any) => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm font-medium">{supplier.supplier_name}</td>
                  <td className="px-5 py-3 text-sm">{supplier.phone_number}</td>
                  <td className="px-5 py-3 text-sm">{formatCurrency(supplier.initial_balance || 0)}</td>
                  <td className="px-5 py-3 text-sm">
                    <span className={supplier.balance_owed > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                      {formatCurrency(supplier.balance_owed || 0)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm">{formatCurrency(supplier.total_paid || 0)}</td>
                  <td className="px-5 py-3 text-sm">
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
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold">{supplier ? 'Edit Supplier' : 'Add New Supplier'}</h3>
          <button onClick={() => onClose()} className="text-gray-400 hover:text-gray-600">
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
            <label className="block text-sm font-medium mb-1">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
              placeholder="Enter supplier name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
              placeholder="Enter phone number"
            />
          </div>

          {!supplier && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Initial Balance (if migrating existing supplier)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.initial_balance}
                onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter any existing balance owed to this supplier (for migration purposes)
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 border border-gray-200 rounded hover:bg-gray-100 text-sm"
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
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setError('Please enter a valid payment amount')
      return
    }

    if (paymentAmount > supplier.balance_owed) {
      setError('Payment amount cannot exceed balance owed')
      return
    }

    setSaving(true)

    try {
      const storeId = getStoreId()
      if (!storeId) throw new Error('Store ID not found')

      const response = await fetch('/api/supplier-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplier.id,
          store_id: storeId,
          amount: paymentAmount,
          payment_method: paymentMethod,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Record Payment</h3>
          <button onClick={() => onClose()} className="text-gray-400 hover:text-gray-600">
            <XIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded text-sm">
              {error}
            </div>
          )}

          <div className="bg-gray-50 p-4 rounded border border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Supplier:</span>
              <span className="font-semibold">{supplier.supplier_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Current Balance Owed:</span>
              <span className="font-bold text-red-600">{formatCurrency(supplier.balance_owed)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Payment Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
              placeholder="0.00"
              max={supplier.balance_owed}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'Cash' | 'Digital')}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
            >
              <option value="Cash">Cash</option>
              <option value="Digital">Digital</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
              placeholder="Add any notes about this payment..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 border border-gray-200 rounded hover:bg-gray-100 text-sm"
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

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b-2 border-black flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold">Initial Customer Balances</h2>
            <p className="text-sm text-gray-600">Total Owed: PKR {totalOwed.toFixed(2)}</p>
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
                  className="p-4 border-2 border-gray-300 rounded hover:border-black transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{entry.customer_name}</h3>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        {entry.customer_phone && (
                          <div>
                            <span className="text-gray-600">Phone:</span>
                            <span className="ml-2 text-gray-900">{entry.customer_phone}</span>
                          </div>
                        )}
                        {entry.customer_cnic && (
                          <div>
                            <span className="text-gray-600">CNIC:</span>
                            <span className="ml-2 text-gray-900">{entry.customer_cnic}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Amount Owed:</span>
                          <span className="ml-2 font-bold text-red-600">PKR {entry.amount_owed.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Added:</span>
                          <span className="ml-2 text-gray-900">
                            {new Date(entry.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                          </span>
                        </div>
                      </div>
                      {entry.notes && (
                        <p className="mt-2 text-sm text-gray-600 italic">{entry.notes}</p>
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

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b-2 border-black flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold">Initial Supplier Balances</h2>
            <p className="text-sm text-gray-600">Total Owed: PKR {totalOwed.toFixed(2)}</p>
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
                  className="p-4 border-2 border-gray-300 rounded hover:border-black transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{entry.supplier_name}</h3>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        {entry.contact_person && (
                          <div>
                            <span className="text-gray-600">Contact:</span>
                            <span className="ml-2 text-gray-900">{entry.contact_person}</span>
                          </div>
                        )}
                        {entry.supplier_phone && (
                          <div>
                            <span className="text-gray-600">Phone:</span>
                            <span className="ml-2 text-gray-900">{entry.supplier_phone}</span>
                          </div>
                        )}
                        {entry.supplier_email && (
                          <div>
                            <span className="text-gray-600">Email:</span>
                            <span className="ml-2 text-gray-900">{entry.supplier_email}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Amount Owed:</span>
                          <span className="ml-2 font-bold text-red-600">PKR {entry.amount_owed.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Added:</span>
                          <span className="ml-2 text-gray-900">
                            {new Date(entry.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                          </span>
                        </div>
                      </div>
                      {entry.address && (
                        <div className="mt-2 text-sm">
                          <span className="text-gray-600">Address:</span>
                          <span className="ml-2 text-gray-900">{entry.address}</span>
                        </div>
                      )}
                      {entry.notes && (
                        <p className="mt-2 text-sm text-gray-600 italic">{entry.notes}</p>
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
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold">{entry ? 'Edit' : 'Add'} Initial Customer Entry</h3>
          <button onClick={() => onClose()} className="text-gray-400 hover:text-gray-600">
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
            <label className="block text-sm font-medium mb-1">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Customer Phone</label>
            <input
              type="text"
              value={formData.customer_phone}
              onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Customer CNIC</label>
            <input
              type="text"
              value={formData.customer_cnic}
              onChange={(e) => setFormData({ ...formData, customer_cnic: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
              placeholder="XXXXX-XXXXXXX-X"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Amount Owed <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount_owed}
              onChange={(e) => setFormData({ ...formData, amount_owed: e.target.value })}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 border border-gray-200 rounded hover:bg-gray-100 text-sm"
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
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b border-gray-200 sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">{entry ? 'Edit' : 'Add'} Initial Supplier Entry</h3>
          <button onClick={() => onClose()} className="text-gray-400 hover:text-gray-600">
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
            <label className="block text-sm font-medium mb-1">
              Supplier Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.supplier_name}
              onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Contact Person</label>
            <input
              type="text"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone Number</label>
            <input
              type="text"
              value={formData.supplier_phone}
              onChange={(e) => setFormData({ ...formData, supplier_phone: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.supplier_email}
              onChange={(e) => setFormData({ ...formData, supplier_email: e.target.value })}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Amount Owed <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount_owed}
              onChange={(e) => setFormData({ ...formData, amount_owed: e.target.value })}
              required
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:border-black outline-none"
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 border border-gray-200 rounded hover:bg-gray-100 text-sm"
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
