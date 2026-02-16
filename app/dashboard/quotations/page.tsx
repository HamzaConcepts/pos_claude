'use client'

import React, { useEffect, useState } from 'react'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilSimpleIcon,
  TrashIcon,
  CopyIcon,
  CaretDownIcon,
  CaretUpIcon,
  PrinterIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowCounterClockwiseIcon,
  EyeIcon,
} from '@phosphor-icons/react'
import { getStoreId, isManager, isCashier, getManagerId, getCashierId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useCurrency } from '@/lib/currency-context'
import type { Quotation } from '@/lib/types'
import QuotationDetailModal from '@/components/QuotationDetailModal'
import PrintQuotationButton from '@/components/PrintQuotationButton'

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; darkBg: string; darkText: string; darkBorder: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', darkBg: 'bg-gray-800', darkText: 'text-gray-300', darkBorder: 'border-gray-600' },
  finalized: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', darkBg: 'bg-green-900/30', darkText: 'text-green-400', darkBorder: 'border-green-700' },
  expired: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', darkBg: 'bg-red-900/30', darkText: 'text-red-400', darkBorder: 'border-red-700' },
  cancelled: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', darkBg: 'bg-orange-900/30', darkText: 'text-orange-400', darkBorder: 'border-orange-700' },
}

export default function QuotationsPage() {
  const router = useRouter()
  const isDarkMode = useDarkMode()
  const { formatCurrency } = useCurrency()

  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Role state
  const [userIsManager, setUserIsManager] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Action loading
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  useEffect(() => {
    const checkRole = async () => {
      setUserIsManager(await isManager())
    }
    checkRole()
    fetchQuotations()
  }, [])

  const fetchQuotations = async () => {
    try {
      setLoading(true)
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        router.push('/login')
        return
      }

      const params = new URLSearchParams({ store_id: storeId.toString() })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (searchTerm) params.set('search', searchTerm)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const response = await fetch(`/api/quotations?${params}`)
      const result = await response.json()

      if (result.success) {
        setQuotations(result.data || [])
      } else {
        setError(result.error || 'Failed to fetch quotations')
      }
    } catch (err) {
      setError('Failed to fetch quotations')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Re-fetch when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQuotations()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, statusFilter, dateFrom, dateTo])

  const handleDelete = async (quotation: Quotation) => {
    try {
      setDeleting(true)
      const storeId = getStoreId()
      const managerId = await getManagerId()

      const params = new URLSearchParams({
        store_id: storeId?.toString() || '',
        deleted_by: managerId || '',
      })

      const response = await fetch(`/api/quotations/${quotation.id}?${params}`, {
        method: 'DELETE',
      })
      const result = await response.json()

      if (result.success) {
        setQuotations(prev => prev.filter(q => q.id !== quotation.id))
        setDeleteTarget(null)
      } else {
        setError(result.error || 'Failed to delete quotation')
      }
    } catch (err) {
      setError('Failed to delete quotation')
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  const handleDuplicate = async (quotation: Quotation) => {
    try {
      setActionLoading(quotation.id)
      const storeId = getStoreId()
      const managerId = await getManagerId()
      const cashierId = getCashierId()

      const response = await fetch(`/api/quotations/${quotation.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          created_by: managerId,
          created_by_cashier_id: cashierId,
        }),
      })
      const result = await response.json()

      if (result.success) {
        // Navigate to edit the new duplicate
        router.push(`/dashboard/quotations/create?edit=${result.data.id}`)
      } else {
        setError(result.error || 'Failed to duplicate quotation')
      }
    } catch (err) {
      setError('Failed to duplicate quotation')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleFinalize = async (quotation: Quotation) => {
    try {
      setActionLoading(quotation.id)
      const storeId = getStoreId()
      const managerId = await getManagerId()
      const cashierId = getCashierId()

      const response = await fetch(`/api/quotations/${quotation.id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          finalized_by: managerId,
          finalized_by_cashier_id: cashierId,
        }),
      })
      const result = await response.json()

      if (result.success) {
        setQuotations(prev => prev.map(q => q.id === quotation.id ? result.data : q))
      } else {
        setError(result.error || 'Failed to finalize quotation')
      }
    } catch (err) {
      setError('Failed to finalize quotation')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReopen = async (quotation: Quotation) => {
    try {
      setActionLoading(quotation.id)
      const storeId = getStoreId()
      const managerId = await getManagerId()

      const response = await fetch(`/api/quotations/${quotation.id}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          reopened_by: managerId,
        }),
      })
      const result = await response.json()

      if (result.success) {
        setQuotations(prev => prev.map(q => q.id === quotation.id ? result.data : q))
      } else {
        setError(result.error || 'Failed to reopen quotation')
      }
    } catch (err) {
      setError('Failed to reopen quotation')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-PK', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const style = STATUS_STYLES[status] || STATUS_STYLES.draft
    return (
      <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${
        isDarkMode
          ? `${style.darkBg} ${style.darkText} ${style.darkBorder}`
          : `${style.bg} ${style.text} ${style.border}`
      }`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <div className={`p-4 md:p-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Quotations</h1>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Create and manage price estimates for customers
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/quotations/create')}
          className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
        >
          <PlusIcon size={18} weight="bold" />
          New Quotation
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
            <XCircleIcon size={18} />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className={`rounded-lg border p-4 mb-4 ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon
              size={18}
              className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
            />
            <input
              type="text"
              placeholder="Search by quotation #, customer name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm ${
                isDarkMode
                  ? 'bg-[#2a2a2a] border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-2.5 rounded-lg border text-sm ${
              isDarkMode
                ? 'bg-[#2a2a2a] border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="finalized">Finalized</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Toggle date filters */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm ${
              isDarkMode
                ? 'bg-[#2a2a2a] border-gray-600 text-gray-300 hover:bg-[#333]'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon size={16} />
            Filters
          </button>
        </div>

        {/* Date Filters (collapsible) */}
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <label className={`text-sm whitespace-nowrap ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>From:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  isDarkMode
                    ? 'bg-[#2a2a2a] border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className={`text-sm whitespace-nowrap ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>To:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  isDarkMode
                    ? 'bg-[#2a2a2a] border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Clear dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quotations Table */}
      <div className={`rounded-lg border overflow-hidden ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-200'}`}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
          </div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-20">
            <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No quotations found
            </p>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Create your first quotation to get started
            </p>
            <button
              onClick={() => router.push('/dashboard/quotations/create')}
              className="mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm"
            >
              Create Quotation
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isDarkMode ? 'bg-[#2a2a2a]' : 'bg-gray-50'}>
                <tr>
                  <th className={`text-left text-xs font-medium uppercase tracking-wider px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Quotation #
                  </th>
                  <th className={`text-left text-xs font-medium uppercase tracking-wider px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Customer
                  </th>
                  <th className={`text-left text-xs font-medium uppercase tracking-wider px-4 py-3 hidden md:table-cell ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Date
                  </th>
                  <th className={`text-left text-xs font-medium uppercase tracking-wider px-4 py-3 hidden lg:table-cell ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Valid Until
                  </th>
                  <th className={`text-center text-xs font-medium uppercase tracking-wider px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Status
                  </th>
                  <th className={`text-right text-xs font-medium uppercase tracking-wider px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Total
                  </th>
                  <th className={`text-right text-xs font-medium uppercase tracking-wider px-4 py-3 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
                {quotations.map((q) => (
                  <React.Fragment key={q.id}>
                    <tr className={`${expandedId === q.id ? (isDarkMode ? 'bg-[#1a1a1a]' : 'bg-gray-50') : ''} cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-[#1a1a1a]' : 'hover:bg-gray-50'}`}
                        onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}>
                    {/* Main Row */}
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === q.id ? null : q.id) }}
                        className="flex items-center gap-1 font-medium text-sm hover:underline"
                      >
                        {expandedId === q.id ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}
                        {q.quotation_number}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{q.customer_name || '—'}</div>
                      {q.customer_phone && (
                        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {q.customer_phone}
                        </div>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-sm hidden md:table-cell ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {formatDate(q.created_at)}
                    </td>
                    <td className={`px-4 py-3 text-sm hidden lg:table-cell ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {q.valid_until ? formatDate(q.valid_until) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(q.status)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-sm">
                      {formatCurrency(q.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* View */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedQuotation(q); setShowDetailModal(true) }}
                          className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                          title="View details"
                        >
                          <EyeIcon size={16} />
                        </button>

                        {/* Edit (draft only) */}
                        {q.status === 'draft' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/quotations/create?edit=${q.id}`) }}
                            className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-cyan-400' : 'hover:bg-gray-100 text-cyan-600'}`}
                            title="Edit"
                          >
                            <PencilSimpleIcon size={16} />
                          </button>
                        )}

                        {/* Finalize (draft only) */}
                        {q.status === 'draft' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFinalize(q) }}
                            disabled={actionLoading === q.id}
                            className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-green-400' : 'hover:bg-gray-100 text-green-600'}`}
                            title="Finalize"
                          >
                            <CheckCircleIcon size={16} />
                          </button>
                        )}

                        {/* Reopen (finalized, manager only) */}
                        {q.status === 'finalized' && userIsManager && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleReopen(q) }}
                            disabled={actionLoading === q.id}
                            className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-yellow-400' : 'hover:bg-gray-100 text-yellow-600'}`}
                            title="Reopen as draft"
                          >
                            <ArrowCounterClockwiseIcon size={16} />
                          </button>
                        )}

                        {/* Print */}
                        <PrintQuotationButton quotation={q} variant="icon" />

                        {/* Duplicate */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDuplicate(q) }}
                          disabled={actionLoading === q.id}
                          className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                          title="Duplicate"
                        >
                          <CopyIcon size={16} />
                        </button>

                        {/* Delete (manager only) */}
                        {userIsManager && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(q) }}
                            className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-100 text-red-500'}`}
                            title="Delete"
                          >
                            <TrashIcon size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                    {/* Expanded Row */}
                    {expandedId === q.id && q.quotation_items && (
                      <tr>
                      <td colSpan={7} className="px-0">
                        <div className={`px-6 py-4 border-b ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                          <h4 className="text-sm font-medium mb-2">Items ({q.quotation_items.length})</h4>
                          <div className="space-y-1">
                            {q.quotation_items.map((item, idx) => (
                              <div
                                key={item.id || idx}
                                className={`flex justify-between items-center text-sm py-1.5 px-3 rounded ${
                                  isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'
                                }`}
                              >
                                <div className="flex-1">
                                  <span className="font-medium">{item.product_name}</span>
                                  {item.product_sku && (
                                    <span className={`ml-2 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                      ({item.product_sku})
                                    </span>
                                  )}
                                  {item.is_manual_item && (
                                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Manual</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                                    {item.quantity} × {formatCurrency(item.unit_price)}
                                  </span>
                                  <span className="font-medium w-24 text-right">
                                    {formatCurrency(item.line_total)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          {/* Summary row */}
                          <div className={`mt-3 pt-3 border-t flex justify-end ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <div className="space-y-1 text-sm text-right">
                              <div className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                                Subtotal: {formatCurrency(q.subtotal)}
                              </div>
                              {q.discount_type !== 'none' && q.discount_amount > 0 && (
                                <div className="text-red-500">
                                  Discount: -{formatCurrency(q.discount_amount)}
                                  {q.discount_type === 'percentage' && ` (${q.discount_value}%)`}
                                </div>
                              )}
                              <div className="font-bold text-base">
                                Total: {formatCurrency(q.total)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer stats */}
      {!loading && quotations.length > 0 && (
        <div className={`mt-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Showing {quotations.length} quotation{quotations.length !== 1 ? 's' : ''}
          {statusFilter !== 'all' && ` (${statusFilter})`}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg border w-full max-w-md shadow-2xl ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-2">Delete Quotation</h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Are you sure you want to delete quotation <strong>{deleteTarget.quotation_number}</strong>?
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    isDarkMode
                      ? 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget)}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedQuotation && (
        <QuotationDetailModal
          quotation={selectedQuotation}
          onClose={() => { setShowDetailModal(false); setSelectedQuotation(null) }}
          onRefresh={fetchQuotations}
          isManager={userIsManager}
        />
      )}
    </div>
  )
}
