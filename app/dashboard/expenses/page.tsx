'use client'

import { useEffect, useState } from 'react'
import { CurrencyDollarIcon, TrendUpIcon, CalendarIcon, PlusIcon, XIcon, PencilSimpleIcon, TrashIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { supabase, getStoreId, isManager, isCashier } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useDarkMode } from '@/hooks/useDarkMode'
import { getPKTDate } from '@/lib/date-utils'
import { useCurrency } from '@/lib/currency-context'

interface Expense {
  id: number
  description: string
  amount: number
  category: string
  payment_method?: string
  expense_date: string
  recorded_by: string
  recorded_by_name?: string
  marked_for_review?: boolean
  review_note?: string
  product_display?: string
  product_name?: string
  product_sku?: string
  managers?: {
    full_name: string
  }
  created_at: string
}

interface PredefinedExpense {
  id: number
  name: string
  category: string
  default_amount: number
  description: string | null
  is_active: boolean
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

// Format category for display - convert database values to user-friendly labels
const formatCategory = (category: string): string => {
  const categoryMap: Record<string, string> = {
    'new_product': 'New Product',
    'inventory_restock': 'Restock',
  }
  return categoryMap[category] || category
}

// Get appropriate styling for category badge
const getCategoryStyle = (category: string, isDark: boolean): string => {
  if (category === 'new_product') {
    return isDark 
      ? 'bg-green-900/30 border-green-700 text-green-400' 
      : 'bg-green-100 border-green-300 text-green-700'
  }
  if (category === 'inventory_restock') {
    return isDark 
      ? 'bg-blue-900/30 border-blue-700 text-blue-400' 
      : 'bg-blue-100 border-blue-300 text-blue-700'
  }
  return isDark 
    ? 'bg-gray-800 border-gray-600 text-gray-300' 
    : 'bg-gray-100 border-gray-200 text-gray-700'
}

export default function ExpensesPage() {
  const router = useRouter()
  const isDarkMode = useDarkMode()
  const { currency, formatCurrency } = useCurrency()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [predefinedExpenses, setPredefinedExpenses] = useState<PredefinedExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [userId, setUserId] = useState<string>('')
  
  // Role checks
  const [userIsManager, setUserIsManager] = useState(false)
  const [userIsCashier, setUserIsCashier] = useState(false)

  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Mark for review modal states
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewingExpense, setReviewingExpense] = useState<Expense | null>(null)
  const [reviewNote, setReviewNote] = useState('')

  // View marked expense modal
  const [showMarkedModal, setShowMarkedModal] = useState(false)
  const [viewingMarkedExpense, setViewingMarkedExpense] = useState<Expense | null>(null)

  // Form states
  const [selectedPredefined, setSelectedPredefined] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Digital'>('Cash')
  const [expenseDate, setExpenseDate] = useState(getPKTDate())
  const [submitting, setSubmitting] = useState(false)
  const [selectedCashier, setSelectedCashier] = useState<any>(null)

  useEffect(() => {
    // Check roles
    const checkRole = async () => {
      setUserIsManager(await isManager())
      setUserIsCashier(isCashier())
    }
    checkRole()
    
    fetchCurrentUser()
    fetchExpenses()
    fetchPredefinedExpenses()
    loadSelectedCashier()
  }, [])

  const loadSelectedCashier = () => {
    const savedCashier = localStorage.getItem('selected_cashier')
    if (savedCashier) {
      try {
        setSelectedCashier(JSON.parse(savedCashier))
      } catch (err) {
        console.error('Failed to parse saved cashier:', err)
      }
    }
  }

  const fetchCurrentUser = async () => {
    // Check for cashier session first
    const cashierSession = localStorage.getItem('user_session')
    if (cashierSession) {
      const session = JSON.parse(cashierSession)
      setUserId(session.id.toString()) // Cashier ID from localStorage
      return
    }
    
    // Check for manager auth session
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

      const response = await fetch(`/api/expenses?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setExpenses(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to fetch expenses')
    } finally {
      setLoading(false)
    }
  }

  const fetchPredefinedExpenses = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/predefined-expenses?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        // Only show active predefined expenses
        setPredefinedExpenses(result.data.filter((e: PredefinedExpense) => e.is_active))
      }
    } catch (err) {
      console.error('Failed to fetch predefined expenses:', err)
    }
  }

  const calculateStats = () => {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOfYear = new Date(today.getFullYear(), 0, 1)

    // EXCLUDE inventory-related expenses from operating expense calculations
    const operatingExpenses = expenses.filter(e => 
      e.category !== 'new_product' && e.category !== 'inventory_restock'
    )

    const todayExpenses = operatingExpenses.filter(e => 
      new Date(e.expense_date).toDateString() === today.toDateString()
    )
    const monthExpenses = operatingExpenses.filter(e => 
      new Date(e.expense_date) >= startOfMonth
    )
    const yearExpenses = operatingExpenses.filter(e => 
      new Date(e.expense_date) >= startOfYear
    )

    return {
      today: todayExpenses.reduce((sum, e) => sum + e.amount, 0),
      month: monthExpenses.reduce((sum, e) => sum + e.amount, 0),
      year: yearExpenses.reduce((sum, e) => sum + e.amount, 0),
      total: operatingExpenses.reduce((sum, e) => sum + e.amount, 0)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!description.trim() || !amount || parseFloat(amount) <= 0) {
      setError('Please fill all required fields with valid values')
      return
    }

    // Validate cashier selection for cashier accounts
    if (userIsCashier && !userIsManager && !selectedCashier) {
      setError('Please select which staff member is recording this expense')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        router.push('/login')
        return
      }

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          amount: parseFloat(amount),
          category,
          payment_method: paymentMethod,
          expense_date: expenseDate,
          recorded_by: userId,
          recorded_by_cashier_id: selectedCashier?.id || null,
          recorded_by_name: selectedCashier?.full_name || null,
          store_id: storeId
        })
      })

      const result = await response.json()

      if (result.success) {
        setShowAddModal(false)
        setSelectedPredefined(null)
        setDescription('')
        setAmount('')
        setCategory(EXPENSE_CATEGORIES[0])
        setPaymentMethod('Cash')
        setExpenseDate(getPKTDate())
        fetchExpenses()
      } else {
        setError(result.error || 'Failed to add expense')
      }
    } catch (err) {
      setError('Failed to add expense')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setDescription(expense.description)
    setAmount(expense.amount.toString())
    setCategory(expense.category)
    setExpenseDate(expense.expense_date)
    setShowEditModal(true)
    setError('')
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingExpense || !description.trim() || !amount || parseFloat(amount) <= 0) {
      setError('Please fill all required fields with valid values')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingExpense.id,
          description: description.trim(),
          amount: parseFloat(amount),
          category,
          expense_date: expenseDate
        })
      })

      const result = await response.json()

      if (result.success) {
        setShowEditModal(false)
        setEditingExpense(null)
        setDescription('')
        setAmount('')
        setCategory(EXPENSE_CATEGORIES[0])
        setExpenseDate(getPKTDate())
        fetchExpenses()
      } else {
        setError(result.error || 'Failed to update expense')
      }
    } catch (err) {
      setError('Failed to update expense')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteExpense = async () => {
    if (!deletingExpense) return

    try {
      setIsDeleting(true)
      const storeId = getStoreId()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('Manager authentication required')
        setIsDeleting(false)
        return
      }

      const response = await fetch(`/api/expenses/${deletingExpense.id}?manager_id=${user.id}&store_id=${storeId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setShowDeleteModal(false)
        setShowMarkedModal(false)
        setDeletingExpense(null)
        setViewingMarkedExpense(null)
        fetchExpenses()
        setError('')
      } else {
        setError(result.error || 'Failed to delete expense')
      }
    } catch (err) {
      setError('Failed to delete expense: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMarkForReview = async () => {
    if (!reviewingExpense) return
    
    try {
      const storeId = getStoreId()
      const cashierName = localStorage.getItem('cashier_name') || 'Unknown'

      const response = await fetch(`/api/expenses/${reviewingExpense.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-store-id': storeId?.toString() || '',
          'x-cashier-name': cashierName
        },
        body: JSON.stringify({
          marked_for_review: true,
          review_note: reviewNote
        })
      })

      const result = await response.json()

      if (result.success) {
        setShowReviewModal(false)
        setReviewingExpense(null)
        setReviewNote('')
        fetchExpenses()
        setError('')
      } else {
        setError(result.error || 'Failed to mark expense for review')
      }
    } catch (err) {
      setError('Failed to mark expense for review: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const handleUnmarkExpense = async () => {
    if (!viewingMarkedExpense) return

    try {
      setIsDeleting(true)
      const storeId = getStoreId()
      const cashierName = localStorage.getItem('cashier_name') || 'Unknown'

      const response = await fetch(`/api/expenses/${viewingMarkedExpense.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-store-id': storeId?.toString() || '',
          'x-cashier-name': cashierName
        },
        body: JSON.stringify({
          marked_for_review: false,
          review_note: null
        })
      })

      const result = await response.json()

      if (result.success) {
        setShowMarkedModal(false)
        setViewingMarkedExpense(null)
        fetchExpenses()
        setError('')
      } else {
        setError(result.error || 'Failed to unmark expense')
      }
    } catch (err) {
      setError('Failed to unmark expense: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setIsDeleting(false)
    }
  }

  const stats = calculateStats()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${isDarkMode ? 'border-cyan-500' : 'border-black'}`}></div>
          <p className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading expenses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-5">
        <h1 className={`text-xl md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Expenses</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors flex items-center gap-2"
        >
          <PlusIcon size={16} />
          Add Expense
        </button>
      </div>

      {error && !showAddModal && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm">
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className={`p-4 rounded border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Today's Expenses</span>
            <CurrencyDollarIcon className="text-red-600" size={16} />
          </div>
          <div className="text-lg font-semibold text-red-600">
            {formatCurrency(stats.today, 2)}
          </div>
        </div>

        <div className={`p-4 rounded border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>This Month</span>
            <CalendarIcon className="text-red-600" size={16} />
          </div>
          <div className="text-lg font-semibold text-red-600">
            {formatCurrency(stats.month, 2)}
          </div>
        </div>

        <div className={`p-4 rounded border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>This Year</span>
            <TrendUpIcon className="text-red-600" size={16} />
          </div>
          <div className="text-lg font-semibold text-red-600">
            {formatCurrency(stats.year, 2)}
          </div>
        </div>

        <div className={`p-4 rounded border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Expenses</span>
            <CurrencyDollarIcon className="text-red-600" size={16} />
          </div>
          <div className="text-lg font-semibold text-red-600">
            {formatCurrency(stats.total, 2)}
          </div>
        </div>
      </div>

      {/* Expenses List */}
      <div className={`rounded border overflow-hidden ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
        <div className={`p-4 border-b ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
          <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Operating Expenses</h2>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Rent, utilities, salaries, and other operational costs (inventory purchases tracked separately)
          </p>
        </div>
        
        {expenses.filter(e => e.category !== 'new_product' && e.category !== 'inventory_restock').length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            No operating expenses recorded yet. Click "Add Expense" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`border-b ${isDarkMode ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                <tr>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Date</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Description</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Category</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Recorded By</th>
                  <th className="px-3 py-2.5 text-right text-sm font-semibold">Amount</th>
                  <th className="px-3 py-2.5 text-center text-sm font-semibold">Payment</th>
                  <th className="px-3 py-2.5 text-center text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.filter(e => e.category !== 'new_product' && e.category !== 'inventory_restock').map((expense, index) => (
                  <tr
                    key={expense.id}
                    className="border-b border-gray-100 bg-white hover:bg-gray-50"
                  >
                    <td className="px-3 py-2.5 text-sm text-gray-900">
                      {new Date(expense.expense_date).toLocaleDateString('en-PK', {
                        timeZone: 'Asia/Karachi',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      <div className="text-gray-900">{expense.description}</div>
                      {expense.product_display && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Product: {expense.product_display}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      <span className={`inline-block px-2 py-1 border rounded text-xs ${getCategoryStyle(expense.category, isDarkMode)}`}>
                        {formatCategory(expense.category)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-900">
                      {expense.recorded_by_name || expense.managers?.full_name || 'Cashier'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-semibold text-red-600">
                      {formatCurrency(expense.amount, 2)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        expense.payment_method === 'Cash' ? 'bg-green-100 text-green-700 border border-green-300' : 
                        expense.payment_method === 'Digital' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 
                        'bg-gray-100 text-gray-600 border border-gray-300'
                      }`}>
                        {expense.payment_method || 'N/A'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors"
                          title="Edit Expense"
                        >
                          <PencilSimpleIcon size={14} />
                          Edit
                        </button>
                        {/* Manager only: Delete button */}
                        {userIsManager && (
                          <button
                            onClick={() => {
                              setDeletingExpense(expense)
                              setShowDeleteModal(true)
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                            title="Delete Expense"
                          >
                            <TrashIcon size={14} />
                            Delete
                          </button>
                        )}
                        {/* Cashier only: Mark for Review button */}
                        {userIsCashier && !expense.marked_for_review && (
                          <button
                            onClick={() => {
                              setReviewingExpense(expense)
                              setShowReviewModal(true)
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                            title="Mark for Review"
                          >
                            <WarningCircleIcon size={14} />
                            Review
                          </button>
                        )}
                        {/* Show indicator if already marked for review */}
                        {expense.marked_for_review && (
                          <button
                            onClick={() => {
                              setViewingMarkedExpense(expense)
                              setShowMarkedModal(true)
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 border border-yellow-300 rounded hover:bg-yellow-200 transition-colors"
                            title="View marked expense details"
                          >
                            <WarningCircleIcon size={14} />
                            Marked
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 max-w-md w-full p-5">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Add New Expense</h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setSelectedPredefined(null)
                  setError('')
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XIcon size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600 font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Predefined Expenses Selection */}
              {predefinedExpenses.length > 0 && (
                <div>
                  <label className="block mb-1 font-medium text-xs text-gray-700">
                    Quick Select (Optional)
                  </label>
                  <select
                    value={selectedPredefined || ''}
                    onChange={(e) => {
                      const id = e.target.value ? parseInt(e.target.value) : null
                      setSelectedPredefined(id)
                      
                      if (id) {
                        const selected = predefinedExpenses.find(pe => pe.id === id)
                        if (selected) {
                          setDescription(selected.name)
                          setCategory(selected.category)
                          setAmount(selected.default_amount.toString())
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600 bg-gray-50"
                  >
                    <option value="">-- Select a predefined expense --</option>
                    {predefinedExpenses.map((pe) => (
                      <option key={pe.id} value={pe.id}>
                        {pe.name} ({pe.category}) - PKR {pe.default_amount.toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select a predefined expense to auto-fill the fields below
                  </p>
                </div>
              )}

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  Description <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="Enter expense description"
                  maxLength={255}
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  Category <span className="text-red-600">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  Amount <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  Payment Method <span className="text-red-600">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'Cash' | 'Digital')}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                >
                  <option value="Cash">Cash</option>
                  <option value="Digital">Digital</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  Expense Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setError('')
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !description.trim() || !amount}
                  className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Adding...' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {showEditModal && editingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 max-w-md w-full p-5">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Edit Expense</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingExpense(null)
                  setError('')
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XIcon size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600 font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  Description <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="Enter expense description"
                  maxLength={255}
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  Category <span className="text-red-600">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  Amount <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  Expense Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingExpense(null)
                    setError('')
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !description.trim() || !amount}
                  className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Updating...' : 'Update Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Expense Modal */}
      {showDeleteModal && deletingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrashIcon size={20} className="text-red-600" />
              Delete Expense
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-900 mb-3">
                Are you sure you want to delete this expense? This action cannot be undone.
              </p>
            </div>

            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Description:</span>{' '}
                <span className="text-gray-900">{deletingExpense.description}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Amount:</span>{' '}
                <span className="text-red-600 font-semibold">${deletingExpense.amount.toFixed(2)}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Category:</span>{' '}
                <span className="text-gray-900">{formatCategory(deletingExpense.category)}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Date:</span>{' '}
                <span className="text-gray-900">
                  {new Date(deletingExpense.expense_date).toLocaleDateString('en-PK', {
                    timeZone: 'Asia/Karachi',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletingExpense(null)
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteExpense}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
              >
                Delete Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark for Review Modal */}
      {showReviewModal && reviewingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <WarningCircleIcon size={20} className="text-yellow-600" />
              Mark Expense for Review
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
              <p className="text-yellow-900">
                This will flag the expense for manager review. Add a note explaining why this expense needs attention.
              </p>
            </div>

            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Description:</span>{' '}
                <span className="text-gray-900">{reviewingExpense.description}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Amount:</span>{' '}
                <span className="text-red-600 font-semibold">${reviewingExpense.amount.toFixed(2)}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Category:</span>{' '}
                <span className="text-gray-900">{formatCategory(reviewingExpense.category)}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Date:</span>{' '}
                <span className="text-gray-900">
                  {new Date(reviewingExpense.expense_date).toLocaleDateString('en-PK', {
                    timeZone: 'Asia/Karachi',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>

            <div className="mb-5">
              <label className="block mb-1 font-medium text-xs text-gray-700">Review Note*</label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                rows={4}
                placeholder="Explain why this expense needs review..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReviewModal(false)
                  setReviewingExpense(null)
                  setReviewNote('')
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkForReview}
                className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition-colors"
                disabled={!reviewNote.trim()}
              >
                Mark for Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Marked Expense Modal */}
      {showMarkedModal && viewingMarkedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <WarningCircleIcon size={20} className="text-yellow-600" />
              Marked for Review
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Description:</span>{' '}
                <span className="text-gray-900">{viewingMarkedExpense.description}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Amount:</span>{' '}
                <span className="text-red-600 font-semibold">${viewingMarkedExpense.amount.toFixed(2)}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Category:</span>{' '}
                <span className="text-gray-900">{formatCategory(viewingMarkedExpense.category)}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Date:</span>{' '}
                <span className="text-gray-900">
                  {new Date(viewingMarkedExpense.expense_date).toLocaleDateString('en-PK', {
                    timeZone: 'Asia/Karachi',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Recorded by:</span>{' '}
                <span className="text-gray-900">{viewingMarkedExpense.recorded_by_name || 'Unknown'}</span>
              </div>
            </div>

            {viewingMarkedExpense.review_note && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs font-semibold text-yellow-800 mb-1">Cashier Note:</p>
                <p className="text-sm text-yellow-900">{viewingMarkedExpense.review_note}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowMarkedModal(false)
                  setViewingMarkedExpense(null)
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleUnmarkExpense}
                disabled={isDeleting}
                className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <XIcon size={14} />
                    Unmark
                  </>
                )}
              </button>
              {userIsManager && (
                <button
                  onClick={() => {
                    setDeletingExpense(viewingMarkedExpense)
                    handleDeleteExpense()
                  }}
                  disabled={isDeleting}
                  className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <TrashIcon size={14} />
                      Delete
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
