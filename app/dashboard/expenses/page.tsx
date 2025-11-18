'use client'

import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Calendar, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Expense {
  id: number
  description: string
  amount: number
  category: string
  expense_date: string
  recorded_by: string
  managers?: {
    full_name: string
  }
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

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [userId, setUserId] = useState<string>('')
  
  // Form states
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCurrentUser()
    fetchExpenses()
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
      const response = await fetch('/api/expenses')
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
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          amount: parseFloat(amount),
          category,
          expense_date: expenseDate,
          recorded_by: userId
        })
      })

      const result = await response.json()

      if (result.success) {
        setShowAddModal(false)
        setDescription('')
        setAmount('')
        setCategory(EXPENSE_CATEGORIES[0])
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

  const stats = calculateStats()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Loading expenses...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Expenses</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Add Expense
        </button>
      </div>

      {error && !showAddModal && (
        <div className="mb-4 p-4 bg-status-error text-white rounded">
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded border-2 border-black">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">Today's Expenses</span>
            <DollarSign className="text-status-error" size={20} />
          </div>
          <div className="text-2xl font-bold text-status-error">
            ${stats.today.toFixed(2)}
          </div>
        </div>

        <div className="bg-white p-6 rounded border-2 border-black">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">This Month</span>
            <Calendar className="text-status-error" size={20} />
          </div>
          <div className="text-2xl font-bold text-status-error">
            ${stats.month.toFixed(2)}
          </div>
        </div>

        <div className="bg-white p-6 rounded border-2 border-black">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">This Year</span>
            <TrendingUp className="text-status-error" size={20} />
          </div>
          <div className="text-2xl font-bold text-status-error">
            ${stats.year.toFixed(2)}
          </div>
        </div>

        <div className="bg-white p-6 rounded border-2 border-black">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-secondary">Total Expenses</span>
            <DollarSign className="text-status-error" size={20} />
          </div>
          <div className="text-2xl font-bold text-status-error">
            ${stats.total.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded border-2 border-black overflow-hidden">
        <div className="p-4 bg-black text-white">
          <h2 className="text-lg font-bold">Recent Expenses</h2>
        </div>
        
        {expenses.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">
            No expenses recorded yet. Click "Add Expense" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Recorded By</th>
                  <th className="px-4 py-3 text-right text-sm font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense, index) => (
                  <tr
                    key={expense.id}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-bg-secondary'}
                  >
                    <td className="px-4 py-3 text-sm">
                      {new Date(expense.expense_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm">{expense.description}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-block px-2 py-1 bg-bg-secondary border border-black rounded text-xs">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {expense.managers?.full_name || 'Cashier'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-status-error">
                      ${expense.amount.toFixed(2)}
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
          <div className="bg-white rounded border-2 border-black max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Add New Expense</h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setError('')
                }}
                className="text-text-secondary hover:text-black"
              >
                <X size={24} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-status-error rounded text-sm">
                <p className="text-status-error font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-2 font-medium text-sm">
                  Description <span className="text-status-error">*</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none font-sans"
                  placeholder="Enter expense description"
                  maxLength={255}
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm">
                  Category <span className="text-status-error">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none font-sans"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm">
                  Amount <span className="text-status-error">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none font-sans"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm">
                  Expense Date <span className="text-status-error">*</span>
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none font-sans"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setError('')
                  }}
                  className="flex-1 px-4 py-3 border-2 border-black rounded hover:bg-bg-secondary transition-colors font-medium"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !description.trim() || !amount}
                  className="flex-1 px-4 py-3 bg-black text-white rounded hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                  {submitting ? 'Adding...' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
