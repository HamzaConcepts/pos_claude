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
import { useCurrency } from '@/lib/currency-context'
import type { Quotation } from '@/lib/types'
import QuotationDetailModal from '@/components/QuotationDetailModal'
import PrintQuotationButton from '@/components/PrintQuotationButton'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
  finalized: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
  expired: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
  cancelled: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700',
}

export default function QuotationsPage() {
  const router = useRouter()
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
      <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${style}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <div className={`p-4 md:p-6 text-gray-900 dark:text-white`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Quotations</h1>
          <p className={`text-sm mt-1 text-gray-500 dark:text-gray-400`}>
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
      <div className={`rounded-lg border p-4 mb-4 bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-700`}>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon
              size={18}
              className={`absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500`}
            />
            <input
              type="text"
              placeholder="Search by quotation #, customer name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
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
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333]"
          >
            <FunnelIcon size={16} />
            Filters
          </button>
        </div>

        {/* Date Filters (collapsible) */}
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <label className={`text-sm whitespace-nowrap text-gray-500 dark:text-gray-400`}>From:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className={`text-sm whitespace-nowrap text-gray-500 dark:text-gray-400`}>To:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 rounded-lg border text-sm bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
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
      <div className={`rounded-lg border overflow-hidden bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-700`}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mx-auto mb-3 animate-pulse">
              <svg width={36} height={Math.round(36 * (1196 / 1061))} viewBox="0 0 1061 1196" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-current text-cyan-500 mx-auto"><path d="M538.795 609.092L871.505 276.381C976.486 372.749 1042.32 511.172 1042.38 664.993C1041.64 664.973 1040.9 664.949 1040.16 664.926C1046.75 665.171 1053.37 665.296 1060.02 665.298C777.219 665.385 546.193 886.933 530.915 1165.94L530.096 1180.67C530.596 1189.81 530.158 1186.07 530.102 1193.71L530.096 1195.39C530.096 1190.47 529.746 1185.56 529.88 1180.67C522.081 894.715 287.839 665.299 0 665.299C6.05981 665.299 12.0958 665.194 18.1064 664.992C18.1652 506.975 88.0333 365.252 198.592 268.889L538.795 609.092ZM674.459 135.664L538.795 271.328L403.132 135.664L538.795 0L674.459 135.664Z" /></svg>
            </div>
            <div className="w-36 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mx-auto">
              <div className="h-full bg-cyan-500 rounded-full" style={{ animation: 'progressBar 1.5s ease-in-out infinite' }} />
            </div>
          </div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-20">
            <p className={`text-lg font-medium text-gray-500 dark:text-gray-400`}>
              No quotations found
            </p>
            <p className={`text-sm mt-1 text-gray-400 dark:text-gray-500`}>
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
              <thead className="bg-gray-50 dark:bg-[#2a2a2a]">
                <tr>
                  <th className={`text-left text-xs font-medium uppercase tracking-wider px-4 py-3 text-gray-500 dark:text-gray-400`}>
                    Quotation #
                  </th>
                  <th className={`text-left text-xs font-medium uppercase tracking-wider px-4 py-3 text-gray-500 dark:text-gray-400`}>
                    Customer
                  </th>
                  <th className={`text-left text-xs font-medium uppercase tracking-wider px-4 py-3 hidden md:table-cell text-gray-500 dark:text-gray-400`}>
                    Date
                  </th>
                  <th className={`text-left text-xs font-medium uppercase tracking-wider px-4 py-3 hidden lg:table-cell text-gray-500 dark:text-gray-400`}>
                    Valid Until
                  </th>
                  <th className={`text-center text-xs font-medium uppercase tracking-wider px-4 py-3 text-gray-500 dark:text-gray-400`}>
                    Status
                  </th>
                  <th className={`text-right text-xs font-medium uppercase tracking-wider px-4 py-3 text-gray-500 dark:text-gray-400`}>
                    Total
                  </th>
                  <th className={`text-right text-xs font-medium uppercase tracking-wider px-4 py-3 text-gray-500 dark:text-gray-400`}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-gray-100 dark:divide-gray-700`}>
                {quotations.map((q) => (
                  <React.Fragment key={q.id}>
                    <tr className={`${expandedId === q.id ? 'bg-gray-50 dark:bg-[#1a1a1a]' : ''} cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-[#1a1a1a]`}
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
                        <div className={`text-xs text-gray-500 dark:text-gray-400`}>
                          {q.customer_phone}
                        </div>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-sm hidden md:table-cell text-gray-600 dark:text-gray-300`}>
                      {formatDate(q.created_at)}
                    </td>
                    <td className={`px-4 py-3 text-sm hidden lg:table-cell text-gray-600 dark:text-gray-300`}>
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
                          className={`p-1.5 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400`}
                          title="View details"
                        >
                          <EyeIcon size={16} />
                        </button>

                        {/* Edit (draft only) */}
                        {q.status === 'draft' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/quotations/create?edit=${q.id}`) }}
                            className={`p-1.5 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-cyan-600 dark:text-cyan-400`}
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
                            className={`p-1.5 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-green-600 dark:text-green-400`}
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
                            className={`p-1.5 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-yellow-600 dark:text-yellow-400`}
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
                          className={`p-1.5 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400`}
                          title="Duplicate"
                        >
                          <CopyIcon size={16} />
                        </button>

                        {/* Delete (manager only) */}
                        {userIsManager && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(q) }}
                            className={`p-1.5 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500 dark:text-red-400`}
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
                        <div className={`px-6 py-4 border-b bg-gray-50 dark:bg-[#0f0f0f] border-gray-200 dark:border-gray-700`}>
                          <h4 className="text-sm font-medium mb-2">Items ({q.quotation_items.length})</h4>
                          <div className="space-y-1">
                            {q.quotation_items.map((item, idx) => (
                              <div
                                key={item.id || idx}
                                className="flex justify-between items-center text-sm py-1.5 px-3 rounded bg-white dark:bg-[#1a1a1a]"
                              >
                                <div className="flex-1">
                                  <span className="font-medium">{item.product_name}</span>
                                  {item.product_sku && (
                                    <span className={`ml-2 text-xs text-gray-400 dark:text-gray-500`}>
                                      ({item.product_sku})
                                    </span>
                                  )}
                                  {item.is_manual_item && (
                                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Manual</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="text-gray-500 dark:text-gray-400">
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
                          <div className={`mt-3 pt-3 border-t flex justify-end border-gray-200 dark:border-gray-700`}>
                            <div className="space-y-1 text-sm text-right">
                              <div className="text-gray-500 dark:text-gray-400">
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
        <div className={`mt-4 text-sm text-gray-500 dark:text-gray-400`}>
          Showing {quotations.length} quotation{quotations.length !== 1 ? 's' : ''}
          {statusFilter !== 'all' && ` (${statusFilter})`}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg border w-full max-w-md shadow-2xl bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-700`}>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-2">Delete Quotation</h3>
              <p className={`text-sm text-gray-500 dark:text-gray-400`}>
                Are you sure you want to delete quotation <strong>{deleteTarget.quotation_number}</strong>?
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setDeleteTarget(null)}
                    className="px-4 py-2 rounded-lg text-sm bg-gray-100 dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"
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
