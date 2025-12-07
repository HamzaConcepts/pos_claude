'use client'

import { useEffect, useState } from 'react'
import { Users, Shield, User, Clock, CheckCircle, XCircle, Store, Tag, Grid, Plus, Edit2, Trash2, X } from 'lucide-react'
import { getStoreId } from '@/lib/supabase'
import AddStockModal from '@/components/AddStockModal'

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
}

export default function StorePage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState<number | null>(null)
  
  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null)
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState<number | null>(null)
  
  // Active tab
  const [activeTab, setActiveTab] = useState<'users' | 'categories' | 'info' | 'initial-stock'>('users')

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    await Promise.all([
      fetchUsers(),
      fetchJoinRequests(),
      fetchCategories(),
      fetchStoreInfo()
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
        return 'bg-black text-white'
      case 'Cashier':
        return 'bg-gray-400 text-white'
      default:
        return 'bg-gray-200 text-black'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Manager':
        return <Shield size={14} />
      case 'Cashier':
        return <User size={14} />
      default:
        return <User size={14} />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Loading store data...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold mb-1.5">Store Management</h1>
          <p className="text-sm text-text-secondary">Manage users, categories, and store settings</p>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-status-error text-white rounded text-sm">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-5 border-b-2 border-black">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'users'
                ? 'border-black bg-black text-white'
                : 'border-transparent hover:bg-gray-100'
            }`}
          >
            <Users size={17} />
            Users
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'categories'
                ? 'border-black bg-black text-white'
                : 'border-transparent hover:bg-gray-100'
            }`}
          >
            <Grid size={17} />
            Categories
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'info'
                ? 'border-black bg-black text-white'
                : 'border-transparent hover:bg-gray-100'
            }`}
          >
            <Store size={17} />
            Store Info
          </button>
          <button
            onClick={() => setActiveTab('initial-stock')}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition-colors text-sm ${
              activeTab === 'initial-stock'
                ? 'border-black bg-black text-white'
                : 'border-transparent hover:bg-gray-100'
            }`}
          >
            <Plus size={17} />
            Initial Stock
          </button>
        </div>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          {/* Pending Join Requests */}
          {joinRequests.length > 0 && (
            <div className="mb-5 bg-white rounded border-2 border-black overflow-hidden">
              <div className="p-3 bg-yellow-100 border-b-2 border-black">
                <div className="flex items-center gap-2">
                  <Clock size={17} />
                  <h2 className="text-base font-bold">Pending Join Requests ({joinRequests.length})</h2>
                </div>
              </div>

              <div className="p-3">
                {joinRequests.map((request: JoinRequest) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 mb-2.5 bg-bg-secondary rounded border-2 border-gray-300 last:mb-0"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-gray-400 text-white rounded-full flex items-center justify-center font-bold text-sm">
                          {request.user_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{request.user_name}</p>
                          <p className="text-xs text-text-secondary">
                            {request.user_email || request.user_phone}
                          </p>
                          <div className="flex items-center gap-2.5 mt-0.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                              request.user_type === 'Manager' ? 'bg-black text-white' : 'bg-gray-400 text-white'
                            }`}>
                              {request.user_type === 'Manager' ? <Shield size={10} /> : <User size={10} />}
                              {request.user_type}
                            </span>
                            <span className="text-xs text-text-secondary">
                              {new Date(request.requested_at).toLocaleDateString('en-US', {
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
                        <CheckCircle size={14} />
                        {processing === request.id ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleJoinRequest(request.id, 'reject')}
                        disabled={processing === request.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <XCircle size={14} />
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
            <div className="bg-white p-3 rounded border-2 border-black">
              <div className="flex items-center gap-2 mb-1.5">
                <Shield size={17} />
                <span className="text-sm text-text-secondary">Managers</span>
              </div>
              <p className="text-xl font-bold">
                {users.filter(u => u.role === 'Manager').length}
              </p>
            </div>

            <div className="bg-white p-3 rounded border-2 border-black">
              <div className="flex items-center gap-2 mb-1.5">
                <User size={17} />
                <span className="text-sm text-text-secondary">Cashiers</span>
              </div>
              <p className="text-xl font-bold">
                {users.filter(u => u.role === 'Cashier').length}
              </p>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded border-2 border-black overflow-hidden">
            <div className="p-3 bg-black text-white">
              <h2 className="text-base font-bold">All Users ({users.length})</h2>
            </div>

            {users.length === 0 ? (
              <div className="p-6 text-center text-text-secondary text-sm">
                No users found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-bold">Name</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold">Email</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold">Role</th>
                      <th className="px-3 py-2.5 text-left text-xs font-bold">Created Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user, index) => (
                      <tr
                        key={user.id}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-bg-secondary'}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-black text-white rounded-full flex items-center justify-center font-bold text-xs">
                              {user.full_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-sm">{user.full_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs">{user.email}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium ${getRoleColor(user.role)}`}>
                            {getRoleIcon(user.role)}
                            {user.role}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-text-secondary">
                          {new Date(user.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Role Permissions Info */}
          <div className="mt-5 bg-bg-secondary p-3 rounded border-2 border-black">
            <h3 className="font-bold mb-2.5 text-sm">Role Permissions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Shield size={14} />
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
                  <User size={14} />
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

      {/* Categories Tab */}
      {activeTab === 'categories' && (
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

      {/* Store Info Tab */}
      {activeTab === 'info' && (
        <StoreInfoTab storeInfo={storeInfo} onRefresh={fetchStoreInfo} />
      )}

      {/* Initial Stock Tab */}
      {activeTab === 'initial-stock' && (
        <InitialStockTab />
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
          className="flex items-center gap-1.5 px-3 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Add Category
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="bg-white rounded border-2 border-black p-8 text-center">
          <Tag size={40} className="mx-auto mb-3 text-gray-400" />
          <p className="text-text-secondary text-sm mb-3">No categories yet</p>
          <button
            onClick={onAddCategory}
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors text-sm"
          >
            Create First Category
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((category: Category) => (
            <div key={category.id} className="bg-white rounded border-2 border-black overflow-hidden">
              <div className="p-3 bg-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Tag size={17} />
                  <h3 className="font-bold text-sm">{category.name}</h3>
                  {category.description && (
                    <span className="text-xs text-text-secondary">- {category.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAddSubcategory(category.id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white border border-black rounded hover:bg-gray-50 transition-colors text-xs"
                  >
                    <Plus size={12} />
                    Add Subcategory
                  </button>
                  <button
                    onClick={() => onEditCategory(category)}
                    className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                    title="Edit category"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    disabled={deleting === category.id}
                    className="p-1.5 hover:bg-red-100 text-red-600 rounded transition-colors disabled:opacity-50"
                    title="Delete category"
                  >
                    <Trash2 size={14} />
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
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteSubcategory(sub.id)}
                            className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"
                            title="Delete subcategory"
                          >
                            <Trash2 size={12} />
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
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    try {
      setSaving(true)
      const storeId = getStoreId()
      
      const response = await fetch('/api/store-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, store_code: storeCode.trim() })
      })

      const result = await response.json()
      
      if (result.success) {
        setEditing(false)
        onRefresh()
      } else {
        alert(result.error || 'Failed to update store code')
      }
    } catch (err) {
      alert('Failed to update store code')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="bg-white rounded border-2 border-black p-4">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Store size={20} />
          Store Information
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Store Name</label>
            <div className="p-3 bg-gray-100 rounded border border-gray-300 text-sm">
              {storeInfo?.store_name || 'Not set'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Auto-Generated Store Code (3-Digit)</label>
            <div className="p-3 bg-gray-100 rounded border border-gray-300">
              <span className="text-sm font-mono font-bold text-lg">{storeInfo?.store_code || 'Not set'}</span>
            </div>
            <p className="text-xs text-text-secondary mt-1">This code is automatically generated and cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Custom Store Code (Optional)</label>
            {editing ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={storeCode}
                  onChange={(e) => setStoreCode(e.target.value)}
                  className="flex-1 px-3 py-2 border-2 border-black rounded text-sm"
                  placeholder="Enter custom store code"
                  maxLength={20}
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 text-sm"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false)
                    setStoreCode(storeInfo?.store_code || '')
                  }}
                  className="px-4 py-2 border-2 border-black rounded hover:bg-gray-100 text-sm"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-gray-100 rounded border border-gray-300">
                <span className="text-sm font-mono">{storeInfo?.store_code || 'Not set'}</span>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 px-3 py-1 bg-white border border-black rounded hover:bg-gray-50 text-sm"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
              </div>
            )}
            <p className="text-xs text-text-secondary mt-1">An additional custom identifier for your store</p>
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
        ? { id: category.id, name: name.trim(), description: description.trim() || null }
        : { store_id: storeId, name: name.trim(), description: description.trim() || null }

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded border-2 border-black w-full max-w-md">
        <div className="p-4 bg-black text-white flex justify-between items-center">
          <h2 className="text-lg font-bold">{category ? 'Edit Category' : 'Add Category'}</h2>
          <button onClick={() => onClose(false)} className="hover:bg-gray-800 p-1 rounded">
            <X size={20} />
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
              className="w-full px-3 py-2 border-2 border-black rounded text-sm"
              placeholder="e.g., Electronics, Clothing"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded text-sm"
              rows={3}
              placeholder="Optional description"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-4 py-2 border-2 border-black rounded hover:bg-gray-100 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 text-sm"
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded border-2 border-black w-full max-w-md">
        <div className="p-4 bg-black text-white flex justify-between items-center">
          <h2 className="text-lg font-bold">{subcategory ? 'Edit Subcategory' : 'Add Subcategory'}</h2>
          <button onClick={() => onClose(false)} className="hover:bg-gray-800 p-1 rounded">
            <X size={20} />
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
              className="w-full px-3 py-2 border-2 border-black rounded text-sm"
              placeholder="e.g., Smartphones, T-Shirts"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded text-sm"
              rows={3}
              placeholder="Optional description"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-4 py-2 border-2 border-black rounded hover:bg-gray-100 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 text-sm"
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

      <div className="bg-white border-2 border-black rounded p-6">
        <div className="text-center">
          <div className="mb-4">
            <Plus size={48} className="mx-auto text-gray-400 mb-2" />
            <h3 className="text-lg font-bold mb-2">Add Initial Stock</h3>
            <p className="text-sm text-gray-600 mb-4">
              Click below to add products and their initial quantities to your inventory
            </p>
          </div>

          <button
            onClick={() => setShowRestockModal(true)}
            className="px-6 py-3 bg-black text-white rounded hover:bg-gray-800 transition-colors font-medium"
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
