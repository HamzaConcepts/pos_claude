'use client'

import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Calendar, Plus, X, Edit } from 'lucide-react'
import { supabase, getStoreId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useDarkMode } from '@/hooks/useDarkMode'

interface Expense {
  id: number
  description: string
  amount: number
  category: string
  payment_method?: string
  expense_date: string
  recorded_by: string
  recorded_by_name?: string
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

export default function ExpensesPage() {
  const router = useRouter()
  const isDarkMode = useDarkMode()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [predefinedExpenses, setPredefinedExpenses] = useState<PredefinedExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [userId, setUserId] = useState<string>('')
  
  // Form states
  const [selectedPredefined, setSelectedPredefined] = useState<number | null>(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Digital'>('Cash')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCurrentUser()
    fetchExpenses()
    fetchPredefinedExpenses()
  }, [])

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

    const todayExpenses = expenses.filter(e => 
      new Date(e.expense_date).toDateString() === today.toDateString()
    )
    const monthExpenses = expenses.filter(e => 
      new Date(e.expense_date) >= startOfMonth
    )
    const yearExpenses = expenses.filter(e => 
      new Date(e.expense_date) >= startOfYear
    )

    return {
      today: todayExpenses.reduce((sum, e) => sum + e.amount, 0),
      month: monthExpenses.reduce((sum, e) => sum + e.amount, 0),
      year: yearExpenses.reduce((sum, e) => sum + e.amount, 0),
      total: expenses.reduce((sum, e) => sum + e.amount, 0)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!description.trim() || !amount || parseFloat(amount) <= 0) {
      setError('Please fill all required fields with valid values')
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
        setExpenseDate(new Date().toISOString().split('T')[0])
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
        setExpenseDate(new Date().toISOString().split('T')[0])
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

  const stats = calculateStats()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Loading expenses...</div>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Expenses</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
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
        <div className="bg-white p-4 rounded border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">Today's Expenses</span>
            <DollarSign className="text-red-600" size={16} />
          </div>
          <div className="text-lg font-semibold text-red-600">
            ${stats.today.toFixed(2)}
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">This Month</span>
            <Calendar className="text-red-600" size={16} />
          </div>
          <div className="text-lg font-semibold text-red-600">
            ${stats.month.toFixed(2)}
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">This Year</span>
            <TrendingUp className="text-red-600" size={16} />
          </div>
          <div className="text-lg font-semibold text-red-600">
            ${stats.year.toFixed(2)}
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600">Total Expenses</span>
            <DollarSign className="text-red-600" size={16} />
          </div>
          <div className="text-lg font-semibold text-red-600">
            ${stats.total.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Recent Expenses</h2>
        </div>
        
        {expenses.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            No expenses recorded yet. Click "Add Expense" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
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
                {expenses.map((expense, index) => (
                  <tr
                    key={expense.id}
                    className="border-b border-gray-100 bg-white hover:bg-gray-50"
                  >
                    <td className="px-3 py-2.5 text-sm text-gray-900">
                      {new Date(expense.expense_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-900">{expense.description}</td>
                    <td className="px-3 py-2.5 text-sm">
                      <span className="inline-block px-2 py-1 bg-gray-100 border border-gray-200 rounded text-xs text-gray-700">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-900">
                      {expense.recorded_by_name || expense.managers?.full_name || 'Cashier'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-semibold text-red-600">
                      ${expense.amount.toFixed(2)}
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
                      <button
                        onClick={() => handleEdit(expense)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors"
                        title="Edit Expense"
                      >
                        <Edit size={14} />
                        Edit
                      </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
                <X size={20} />
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
                        {pe.name} ({pe.category}) - Rs. {pe.default_amount.toLocaleString()}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
                <X size={20} />
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
    </>
  )
}
