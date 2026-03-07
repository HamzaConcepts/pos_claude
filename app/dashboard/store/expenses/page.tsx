'use client'

import { useEffect, useState } from 'react'
import { CurrencyDollarIcon, PlusIcon, PencilSimpleIcon, TrashIcon, XIcon, ToggleLeftIcon, ToggleRightIcon } from '@phosphor-icons/react'
import { supabase, getStoreId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import PageLoader from '@/components/ui/PageLoader'

interface PredefinedExpense {
  id: number
  name: string
  category: string
  default_amount: number
  description: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Salaries',
  'Supplies',
  'Maintenance',
  'Marketing',
  'Transportation',
  'Equipment',
  'Insurance',
  'Miscellaneous'
]

export default function StoreExpensesPage() {
  const router = useRouter()
  const [expenses, setExpenses] = useState<PredefinedExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<PredefinedExpense | null>(null)
  const [userId, setUserId] = useState<string>('')
  
  // Form states
  const [name, setName] = useState('')
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [defaultAmount, setDefaultAmount] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCurrentUser()
    fetchExpenses()
  }, [])

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUserId(user.id)
    }
  }

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        router.push('/login')
        return
      }

      const response = await fetch(`/api/predefined-expenses?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setExpenses(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to fetch predefined expenses')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (expense?: PredefinedExpense) => {
    if (expense) {
      setEditingExpense(expense)
      setName(expense.name)
      setCategory(expense.category)
      setDefaultAmount(expense.default_amount.toString())
      setDescription(expense.description || '')
      setIsActive(expense.is_active)
    } else {
      setEditingExpense(null)
      setName('')
      setCategory(EXPENSE_CATEGORIES[0])
      setDefaultAmount('')
      setDescription('')
      setIsActive(true)
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingExpense(null)
    setName('')
    setCategory(EXPENSE_CATEGORIES[0])
    setDefaultAmount('')
    setDescription('')
    setIsActive(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || !defaultAmount) {
      setError('Please fill in all required fields')
      return
    }

    const amount = parseFloat(defaultAmount)
    if (isNaN(amount) || amount < 0) {
      setError('Please enter a valid amount')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found')
        return
      }

      if (editingExpense) {
        // Update existing expense
        const response = await fetch('/api/predefined-expenses', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingExpense.id,
            name,
            category,
            default_amount: amount,
            description: description.trim() || null,
            is_active: isActive
          })
        })

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error)
        }
      } else {
        // Create new expense
        const response = await fetch('/api/predefined-expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId,
            name,
            category,
            default_amount: amount,
            description: description.trim() || null,
            is_active: isActive,
            created_by: userId
          })
        })

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error)
        }
      }

      await fetchExpenses()
      handleCloseModal()
    } catch (err: any) {
      setError(err.message || 'Failed to save predefined expense')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (expense: PredefinedExpense) => {
    try {
      const response = await fetch('/api/predefined-expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: expense.id,
          is_active: !expense.is_active
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error)
      }

      await fetchExpenses()
    } catch (err: any) {
      setError(err.message || 'Failed to toggle expense status')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this predefined expense?')) {
      return
    }

    try {
      const response = await fetch(`/api/predefined-expenses?id=${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error)
      }

      await fetchExpenses()
    } catch (err: any) {
      setError(err.message || 'Failed to delete predefined expense')
    }
  }

  const groupByCategory = () => {
    const grouped: { [key: string]: PredefinedExpense[] } = {}
    expenses.forEach(expense => {
      if (!grouped[expense.category]) {
        grouped[expense.category] = []
      }
      grouped[expense.category].push(expense)
    })
    return grouped
  }

  if (loading) {
    return <PageLoader message="Loading expenses" />
  }

  const groupedExpenses = groupByCategory()

  return (
    <div className="animate-fadeIn p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pre-defined Expenses</h1>
          <p className="text-gray-600 mt-1">
            Manage recurring expenses for quick selection
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="text-center py-12 bg-white border-2 border-dashed border-gray-300 rounded-lg">
          <CurrencyDollarIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Pre-defined Expenses
          </h3>
          <p className="text-gray-600 mb-4">
            Create pre-defined expenses for quick selection when recording expenses.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
          >
            Add Your First Expense
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedExpenses).map(([category, categoryExpenses]) => (
            <div key={category} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-lg">{category}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Default Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {categoryExpenses.map((expense) => (
                      <tr key={expense.id} className={!expense.is_active ? 'opacity-50' : ''}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium">{expense.name}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          PKR {expense.default_amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-600">
                            {expense.description || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleActive(expense)}
                            className="flex items-center gap-2"
                          >
                            {expense.is_active ? (
                              <>
                                <ToggleRightIcon className="w-5 h-5 text-green-600" />
                                <span className="text-sm text-green-600">Active</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeftIcon className="w-5 h-5 text-gray-400" />
                                <span className="text-sm text-gray-500">Inactive</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal(expense)}
                              className="p-2 hover:bg-gray-100 rounded"
                              title="Edit"
                            >
                              <PencilSimpleIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(expense.id)}
                              className="p-2 hover:bg-red-50 rounded text-red-600"
                              title="Delete"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                {editingExpense ? 'Edit Pre-defined Expense' : 'Add Pre-defined Expense'}
              </h2>
              <button onClick={handleCloseModal} className="p-1 hover:bg-gray-100 rounded">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="e.g., Monthly Rent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-black focus:border-transparent"
                  required
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Default Amount (Rs.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={defaultAmount}
                  onChange={(e) => setDefaultAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-black focus:border-transparent"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="isActive" className="text-sm">
                  Active (Available for selection)
                </label>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : editingExpense ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
