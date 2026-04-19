'use client'

import { useEffect, useMemo, useState } from 'react'
import { CurrencyDollarIcon, TrendUpIcon, CalendarIcon, PlusIcon, XIcon, PencilSimpleIcon, TrashIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { supabase, getStoreId, isManager, isCashier } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getPKTDate } from '@/lib/date-utils'
import { useCurrency } from '@/lib/currency-context'
import ExpensesSkeleton from '@/components/skeletons/ExpensesSkeleton'

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
  is_recurring?: boolean
}

interface RecurringExpense {
  id: number
  name: string
  category: string
  default_amount: number
  description: string | null
  is_active: boolean
  recurrence_frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  next_due_date: string | null
  reminder_days_before: number
  auto_create: boolean
  default_payment_method: 'Cash' | 'Digital'
  days_until_due?: number | null
  due_status?: 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'unscheduled'
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
const getCategoryStyle = (category: string): string => {
  if (category === 'new_product') {
    return 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
  }
  if (category === 'inventory_restock') {
    return 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400'
  }
  return 'bg-gray-100 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
}

export default function ExpensesPage() {
  const router = useRouter()
  const { currency, formatCurrency } = useCurrency()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [predefinedExpenses, setPredefinedExpenses] = useState<PredefinedExpense[]>([])
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [dueRecurringExpenses, setDueRecurringExpenses] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
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
  const [recurringSubmitting, setRecurringSubmitting] = useState(false)
  const [selectedCashier, setSelectedCashier] = useState<any>(null)

  const [recurringForm, setRecurringForm] = useState({
    name: '',
    category: EXPENSE_CATEGORIES[0],
    default_amount: '',
    description: '',
    recurrence_frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    next_due_date: getPKTDate(),
    reminder_days_before: '3',
    auto_create: true,
    default_payment_method: 'Cash' as 'Cash' | 'Digital',
    is_active: true,
  })

  // Filter states
  const [searchFilter, setSearchFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')

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
    fetchRecurringExpenses()
    fetchDueRecurringExpenses()
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
        setPredefinedExpenses(result.data.filter((e: PredefinedExpense) => e.is_active && !e.is_recurring))
      }
    } catch (err) {
      console.error('Failed to fetch predefined expenses:', err)
    }
  }

  const fetchRecurringExpenses = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/recurring-expenses?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setRecurringExpenses(result.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch recurring expenses:', err)
    }
  }

  const fetchDueRecurringExpenses = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/recurring-expenses?store_id=${storeId}&view=due`)
      const result = await response.json()

      if (result.success) {
        setDueRecurringExpenses(result.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch due recurring expenses:', err)
    }
  }

  const resetRecurringForm = () => {
    setRecurringForm({
      name: '',
      category: EXPENSE_CATEGORIES[0],
      default_amount: '',
      description: '',
      recurrence_frequency: 'monthly',
      next_due_date: getPKTDate(),
      reminder_days_before: '3',
      auto_create: true,
      default_payment_method: 'Cash',
      is_active: true,
    })
  }

  const handleCreateRecurringExpense = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!recurringForm.name.trim() || !recurringForm.default_amount || parseFloat(recurringForm.default_amount) <= 0) {
      setError('Please provide recurring expense name and a valid amount')
      return
    }

    setRecurringSubmitting(true)
    setError('')

    try {
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        return
      }

      const response = await fetch('/api/recurring-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          name: recurringForm.name.trim(),
          category: recurringForm.category,
          default_amount: parseFloat(recurringForm.default_amount),
          description: recurringForm.description.trim() || null,
          is_active: recurringForm.is_active,
          recurrence_frequency: recurringForm.recurrence_frequency,
          next_due_date: recurringForm.next_due_date,
          reminder_days_before: parseInt(recurringForm.reminder_days_before || '0', 10),
          auto_create: recurringForm.auto_create,
          default_payment_method: recurringForm.default_payment_method,
          created_by: userId && userId.includes('-') ? userId : null,
        }),
      })

      const result = await response.json()
      if (!result.success) {
        setError(result.error || 'Failed to create recurring expense')
        return
      }

      resetRecurringForm()
      setShowRecurringModal(false)
      await Promise.all([fetchRecurringExpenses(), fetchDueRecurringExpenses()])
    } catch (err) {
      setError('Failed to create recurring expense')
    } finally {
      setRecurringSubmitting(false)
    }
  }

  const handleDeleteRecurringExpense = async (expenseId: number) => {
    const confirmed = window.confirm('Delete this recurring expense template?')
    if (!confirmed) return

    try {
      const response = await fetch(`/api/recurring-expenses?id=${expenseId}`, {
        method: 'DELETE',
      })
      const result = await response.json()

      if (!result.success) {
        setError(result.error || 'Failed to delete recurring expense')
        return
      }

      await Promise.all([fetchRecurringExpenses(), fetchDueRecurringExpenses()])
    } catch (err) {
      setError('Failed to delete recurring expense')
    }
  }

  const operatingExpenses = useMemo(() => {
    return expenses.filter(e => e.category !== 'new_product' && e.category !== 'inventory_restock')
  }, [expenses])

  const availableCategories = useMemo(() => {
    return Array.from(new Set(operatingExpenses.map(e => e.category))).sort()
  }, [operatingExpenses])

  const filteredOperatingExpenses = useMemo(() => {
    return operatingExpenses.filter((expense) => {
      if (categoryFilter && expense.category !== categoryFilter) {
        return false
      }

      if (paymentMethodFilter && (expense.payment_method || '') !== paymentMethodFilter) {
        return false
      }

      const expenseDateValue = new Date(expense.expense_date)

      if (startDateFilter) {
        const startDate = new Date(startDateFilter)
        if (expenseDateValue < startDate) {
          return false
        }
      }

      if (endDateFilter) {
        const endDate = new Date(endDateFilter)
        endDate.setHours(23, 59, 59, 999)
        if (expenseDateValue > endDate) {
          return false
        }
      }

      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase()
        const searchableText = [
          expense.description,
          formatCategory(expense.category),
          expense.recorded_by_name || expense.managers?.full_name || '',
          expense.product_display || '',
          expense.payment_method || ''
        ]
          .join(' ')
          .toLowerCase()

        if (!searchableText.includes(query)) {
          return false
        }
      }

      return true
    })
  }, [operatingExpenses, categoryFilter, paymentMethodFilter, startDateFilter, endDateFilter, searchFilter])

  const clearFilters = () => {
    setSearchFilter('')
    setCategoryFilter('')
    setPaymentMethodFilter('')
    setStartDateFilter('')
    setEndDateFilter('')
  }

  const calculateStats = (expenseList: Expense[]) => {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOfYear = new Date(today.getFullYear(), 0, 1)

    const todayExpenses = expenseList.filter(e => 
      new Date(e.expense_date).toDateString() === today.toDateString()
    )
    const monthExpenses = expenseList.filter(e => 
      new Date(e.expense_date) >= startOfMonth
    )
    const yearExpenses = expenseList.filter(e => 
      new Date(e.expense_date) >= startOfYear
    )

    return {
      today: todayExpenses.reduce((sum, e) => sum + e.amount, 0),
      month: monthExpenses.reduce((sum, e) => sum + e.amount, 0),
      year: yearExpenses.reduce((sum, e) => sum + e.amount, 0),
      total: expenseList.reduce((sum, e) => sum + e.amount, 0)
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

  const stats = calculateStats(filteredOperatingExpenses)
  const hasActiveFilters = Boolean(
    searchFilter || categoryFilter || paymentMethodFilter || startDateFilter || endDateFilter
  )

  if (loading) {
    return <ExpensesSkeleton />
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRecurringModal(true)}
            className="px-3 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-900 transition-colors flex items-center gap-2"
          >
            <CalendarIcon size={16} />
            Recurring Setup
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors flex items-center gap-2"
          >
            <PlusIcon size={16} />
            Add Expense
          </button>
        </div>
      </div>

      {error && !showAddModal && !showRecurringModal && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm">
          {error}
        </div>
      )}

      {dueRecurringExpenses.length > 0 && (
        <div className="mb-4 p-3 rounded border border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
          <p className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-2">Recurring Expense Alerts</p>
          <div className="space-y-1">
            {dueRecurringExpenses.slice(0, 6).map((item) => (
              <p key={`due-${item.id}`} className="text-xs text-orange-700 dark:text-orange-200">
                {item.name}: due {item.next_due_date || 'unscheduled'}
                {typeof item.days_until_due === 'number' && ` (${item.days_until_due < 0 ? `${Math.abs(item.days_until_due)} day(s) overdue` : item.days_until_due === 0 ? 'today' : `${item.days_until_due} day(s) left`})`}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 p-3 rounded border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow dark:shadow-none">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Recurring Expense Templates</p>
          <button
            onClick={() => setShowRecurringModal(true)}
            className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
          >
            Manage
          </button>
        </div>

        {recurringExpenses.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">No recurring templates configured yet.</p>
        ) : (
          <div className="space-y-1">
            {recurringExpenses.slice(0, 5).map((item) => (
              <div key={`template-${item.id}`} className="flex items-center justify-between text-xs border-b border-gray-100 dark:border-gray-700 py-1.5">
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">{item.name}</p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {item.recurrence_frequency} | due {item.next_due_date || 'unscheduled'} | {item.auto_create ? 'auto-create on' : 'reminder only'}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteRecurringExpense(item.id)}
                  className="px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 p-3 rounded border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow dark:shadow-none">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search description, type, staff..."
            aria-label="Search expenses"
            title="Search expenses"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by expense type"
            title="Filter by expense type"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All Types</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {formatCategory(cat)}
              </option>
            ))}
          </select>

          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            aria-label="Filter by payment method"
            title="Filter by payment method"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All Payments</option>
            <option value="Cash">Cash</option>
            <option value="Digital">Digital</option>
          </select>

          <input
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            aria-label="Filter expenses from date"
            title="Filter expenses from date"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
          />

          <input
            type="date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            aria-label="Filter expenses to date"
            title="Filter expenses to date"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
          />

          <button
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="px-3 py-2 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Clear Filters
          </button>
        </div>

        <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
          Showing {filteredOperatingExpenses.length} of {operatingExpenses.length} operating expenses
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="p-4 rounded border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow dark:shadow-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Today's Expenses</span>
            <CurrencyDollarIcon className="text-red-600" size={16} />
          </div>
          <div className="text-lg font-semibold text-red-600">
            {formatCurrency(stats.today, 2)}
          </div>
        </div>

        <div className="p-4 rounded border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow dark:shadow-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">This Month</span>
            <CalendarIcon className="text-red-600" size={16} />
          </div>
          <div className="text-lg font-semibold text-red-600">
            {formatCurrency(stats.month, 2)}
          </div>
        </div>

        <div className="p-4 rounded border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow dark:shadow-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">This Year</span>
            <TrendUpIcon className="text-red-600" size={16} />
          </div>
          <div className="text-lg font-semibold text-red-600">
            {formatCurrency(stats.year, 2)}
          </div>
        </div>

        <div className="p-4 rounded border bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow dark:shadow-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Total Expenses</span>
            <CurrencyDollarIcon className="text-red-600" size={16} />
          </div>
          <div className="text-lg font-semibold text-red-600">
            {formatCurrency(stats.total, 2)}
          </div>
        </div>
      </div>

      {/* Expenses List */}
      <div className="rounded border overflow-hidden bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow dark:shadow-none">
        <div className="p-4 border-b bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Operating Expenses</h2>
          <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
            Rent, utilities, salaries, and other operational costs (inventory purchases tracked separately)
          </p>
        </div>
        
        {filteredOperatingExpenses.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
            {operatingExpenses.length === 0
              ? 'No operating expenses recorded yet. Click "Add Expense" to get started.'
              : 'No operating expenses match your current filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
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
                {filteredOperatingExpenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-white">
                      {new Date(expense.expense_date).toLocaleDateString('en-PK', {
                        timeZone: 'Asia/Karachi',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      <div className="text-gray-900 dark:text-white">{expense.description}</div>
                      {expense.product_display && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Product: {expense.product_display}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      <span className={`inline-block px-2 py-1 border rounded text-xs ${getCategoryStyle(expense.category)}`}>
                        {formatCategory(expense.category)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-white">
                      {expense.recorded_by_name || expense.managers?.full_name || 'Cashier'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-semibold text-red-600">
                      {formatCurrency(expense.amount, 2)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        expense.payment_method === 'Cash' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800' : 
                        expense.payment_method === 'Digital' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800' : 
                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600'
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
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Expense</h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setSelectedPredefined(null)
                  setError('')
                }}
                aria-label="Close add expense modal"
                title="Close"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
                  <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
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
                    title="Quick select predefined expense"
                    aria-label="Quick select predefined expense"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-gray-50 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">-- Select a predefined expense --</option>
                    {predefinedExpenses.map((pe) => (
                      <option key={pe.id} value={pe.id}>
                        {pe.name} ({pe.category}) - PKR {pe.default_amount.toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Select a predefined expense to auto-fill the fields below
                  </p>
                </div>
              )}

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Description <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  placeholder="Enter expense description"
                  maxLength={255}
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Category <span className="text-red-600">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  title="Expense category"
                  aria-label="Expense category"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Amount <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Payment Method <span className="text-red-600">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'Cash' | 'Digital')}
                  title="Payment method"
                  aria-label="Payment method"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="Digital">Digital</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Expense Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  title="Expense date"
                  aria-label="Expense date"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setError('')
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
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
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Expense</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingExpense(null)
                  setError('')
                }}
                aria-label="Close edit expense modal"
                title="Close"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Description <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  placeholder="Enter expense description"
                  maxLength={255}
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Category <span className="text-red-600">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  title="Expense category"
                  aria-label="Expense category"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Amount <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Expense Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  title="Expense date"
                  aria-label="Expense date"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
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
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
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
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrashIcon size={20} className="text-red-600" />
              Delete Expense
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="mb-5 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <p className="text-sm text-red-900 dark:text-red-300 mb-3">
                Are you sure you want to delete this expense? This action cannot be undone.
              </p>
            </div>

            <div className="mb-4 p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded text-sm">
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Description:</span>{' '}
                <span className="text-gray-900 dark:text-white">{deletingExpense.description}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Amount:</span>{' '}
                <span className="text-red-600 font-semibold">${deletingExpense.amount.toFixed(2)}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Category:</span>{' '}
                <span className="text-gray-900 dark:text-white">{formatCategory(deletingExpense.category)}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Date:</span>{' '}
                <span className="text-gray-900 dark:text-white">
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
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
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
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <WarningCircleIcon size={20} className="text-yellow-600" />
              Mark Expense for Review
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm">
              <p className="text-yellow-900 dark:text-yellow-300">
                This will flag the expense for manager review. Add a note explaining why this expense needs attention.
              </p>
            </div>

            <div className="mb-4 p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded text-sm">
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Description:</span>{' '}
                <span className="text-gray-900 dark:text-white">{reviewingExpense.description}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Amount:</span>{' '}
                <span className="text-red-600 font-semibold">${reviewingExpense.amount.toFixed(2)}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Category:</span>{' '}
                <span className="text-gray-900 dark:text-white">{formatCategory(reviewingExpense.category)}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Date:</span>{' '}
                <span className="text-gray-900 dark:text-white">
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
              <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Review Note*</label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
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
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
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
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <WarningCircleIcon size={20} className="text-yellow-600" />
              Marked for Review
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded text-sm">
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Description:</span>{' '}
                <span className="text-gray-900 dark:text-white">{viewingMarkedExpense.description}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Amount:</span>{' '}
                <span className="text-red-600 font-semibold">${viewingMarkedExpense.amount.toFixed(2)}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Category:</span>{' '}
                <span className="text-gray-900 dark:text-white">{formatCategory(viewingMarkedExpense.category)}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Date:</span>{' '}
                <span className="text-gray-900 dark:text-white">
                  {new Date(viewingMarkedExpense.expense_date).toLocaleDateString('en-PK', {
                    timeZone: 'Asia/Karachi',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Recorded by:</span>{' '}
                <span className="text-gray-900 dark:text-white">{viewingMarkedExpense.recorded_by_name || 'Unknown'}</span>
              </div>
            </div>

            {viewingMarkedExpense.review_note && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400 mb-1">Cashier Note:</p>
                <p className="text-sm text-yellow-900 dark:text-yellow-300">{viewingMarkedExpense.review_note}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowMarkedModal(false)
                  setViewingMarkedExpense(null)
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
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

      {showRecurringModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recurring Expense Setup</h2>
              <button
                onClick={() => {
                  setShowRecurringModal(false)
                  setError('')
                }}
                aria-label="Close recurring expense modal"
                title="Close"
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XIcon size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleCreateRecurringExpense} className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Template Name *</label>
                  <input
                    type="text"
                    value={recurringForm.name}
                    onChange={(e) => setRecurringForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                    placeholder="Monthly Shop Rent"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Category *</label>
                  <select
                    value={recurringForm.category}
                    onChange={(e) => setRecurringForm((prev) => ({ ...prev, category: e.target.value }))}
                    title="Recurring expense category"
                    aria-label="Recurring expense category"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={`recurring-category-${cat}`} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={recurringForm.default_amount}
                    onChange={(e) => setRecurringForm((prev) => ({ ...prev, default_amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Payment Method</label>
                  <select
                    value={recurringForm.default_payment_method}
                    onChange={(e) => setRecurringForm((prev) => ({ ...prev, default_payment_method: e.target.value as 'Cash' | 'Digital' }))}
                    title="Recurring payment method"
                    aria-label="Recurring payment method"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Digital">Digital</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Frequency *</label>
                  <select
                    value={recurringForm.recurrence_frequency}
                    onChange={(e) => setRecurringForm((prev) => ({ ...prev, recurrence_frequency: e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly' }))}
                    title="Recurring frequency"
                    aria-label="Recurring frequency"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Next Due Date *</label>
                  <input
                    type="date"
                    value={recurringForm.next_due_date}
                    onChange={(e) => setRecurringForm((prev) => ({ ...prev, next_due_date: e.target.value }))}
                    title="Next due date"
                    aria-label="Next due date"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Reminder Days Before</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={recurringForm.reminder_days_before}
                    onChange={(e) => setRecurringForm((prev) => ({ ...prev, reminder_days_before: e.target.value }))}
                    title="Reminder days before"
                    aria-label="Reminder days before"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Description (optional)</label>
                <textarea
                  value={recurringForm.description}
                  onChange={(e) => setRecurringForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  placeholder="Optional details for this recurring expense"
                />
              </div>

              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={recurringForm.auto_create}
                    onChange={(e) => setRecurringForm((prev) => ({ ...prev, auto_create: e.target.checked }))}
                    title="Auto-create expense on due date"
                    aria-label="Auto-create expense on due date"
                  />
                  Auto-create expense on due date
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={recurringForm.is_active}
                    onChange={(e) => setRecurringForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    title="Recurring template active"
                    aria-label="Recurring template active"
                  />
                  Active
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRecurringModal(false)
                    setError('')
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
                  disabled={recurringSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recurringSubmitting || !recurringForm.name.trim() || !recurringForm.default_amount}
                  className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {recurringSubmitting ? 'Saving...' : 'Save Recurring Template'}
                </button>
              </div>
            </form>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Existing Templates</h3>
              {recurringExpenses.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">No recurring templates yet.</p>
              ) : (
                <div className="space-y-2">
                  {recurringExpenses.map((item) => (
                    <div key={`recurring-row-${item.id}`} className="p-2 rounded border border-gray-200 dark:border-gray-700 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{item.name}</p>
                          <p className="text-gray-500 dark:text-gray-400">
                            {item.recurrence_frequency} | due {item.next_due_date || 'unscheduled'} | {item.auto_create ? 'auto-create' : 'reminder only'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteRecurringExpense(item.id)}
                          className="px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
