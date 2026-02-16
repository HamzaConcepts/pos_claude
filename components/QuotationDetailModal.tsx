'use client'

import { useState, useEffect } from 'react'
import {
  XIcon,
  PencilSimpleIcon,
  CheckCircleIcon,
  ArrowCounterClockwiseIcon,
  CopyIcon,
  ClockIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeSimpleIcon,
  MapPinIcon,
  CalendarIcon,
  HashIcon,
} from '@phosphor-icons/react'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useCurrency } from '@/lib/currency-context'
import { getStoreId, getManagerId, getCashierId } from '@/lib/supabase'
import PrintQuotationButton from './PrintQuotationButton'
import type { Quotation, QuotationItem, QuotationAuditLog } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface QuotationDetailModalProps {
  quotation: Quotation
  onClose: () => void
  onRefresh?: () => void
  isManager?: boolean
}

export default function QuotationDetailModal({ quotation: initialQuotation, onClose, onRefresh, isManager: propIsManager }: QuotationDetailModalProps) {
  const isDarkMode = useDarkMode()
  const { formatCurrency } = useCurrency()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [items, setItems] = useState<QuotationItem[]>([])
  const [auditLog, setAuditLog] = useState<QuotationAuditLog[]>([])
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  const quotationId = initialQuotation.id

  useEffect(() => {
    fetchQuotation()
  }, [quotationId])

  const fetchQuotation = async () => {
    try {
      setLoading(true)
      const storeId = getStoreId()
      const response = await fetch(`/api/quotations/${quotationId}?store_id=${storeId}`)
      const result = await response.json()

      if (result.success && result.data) {
        setQuotation(result.data)
        setItems(result.data.quotation_items || [])
      } else {
        setError('Failed to load quotation')
      }
    } catch (err) {
      setError('Failed to load quotation')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAuditLog = async () => {
    if (auditLog.length > 0) {
      setShowAuditLog(!showAuditLog)
      return
    }
    try {
      const storeId = getStoreId()
      const response = await fetch(`/api/quotations/${quotationId}/audit-log?store_id=${storeId}`)
      const result = await response.json()
      if (result.success) {
        setAuditLog(result.data || [])
        setShowAuditLog(true)
      }
    } catch (err) {
      console.error('Failed to fetch audit log:', err)
    }
  }

  const handleFinalize = async () => {
    try {
      setActionLoading(true)
      const storeId = getStoreId()
      const managerId = await getManagerId()
      const cashierId = getCashierId()

      const response = await fetch(`/api/quotations/${quotationId}/finalize`, {
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
        fetchQuotation()
      } else {
        setError(result.error || 'Failed to finalize')
      }
    } catch (err) {
      setError('Failed to finalize')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReopen = async () => {
    try {
      setActionLoading(true)
      const storeId = getStoreId()
      const managerId = await getManagerId()
      const cashierId = getCashierId()

      const response = await fetch(`/api/quotations/${quotationId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          reopened_by: managerId,
          reopened_by_cashier_id: cashierId,
        }),
      })
      const result = await response.json()
      if (result.success) {
        fetchQuotation()
      } else {
        setError(result.error || 'Failed to reopen')
      }
    } catch (err) {
      setError('Failed to reopen')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDuplicate = async () => {
    try {
      setActionLoading(true)
      const storeId = getStoreId()
      const managerId = await getManagerId()
      const cashierId = getCashierId()

      const response = await fetch(`/api/quotations/${quotationId}/duplicate`, {
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
        onClose() // close modal
        onRefresh?.() // refresh list
      } else {
        setError(result.error || 'Failed to duplicate')
      }
    } catch (err) {
      setError('Failed to duplicate')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-PK', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-PK', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = isDarkMode
      ? {
          draft: 'bg-gray-700 text-gray-300',
          finalized: 'bg-green-900 text-green-300',
          expired: 'bg-red-900 text-red-300',
          cancelled: 'bg-orange-900 text-orange-300',
        }
      : {
          draft: 'bg-gray-100 text-gray-700',
          finalized: 'bg-green-100 text-green-700',
          expired: 'bg-red-100 text-red-700',
          cancelled: 'bg-orange-100 text-orange-700',
        }
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${colors[status] || colors.draft}`}>
        {status}
      </span>
    )
  }

  const sectionClasses = `rounded-lg border p-4 ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-200'}`
  const labelClasses = `text-xs font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`
  const valueClasses = `text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className={`w-full max-w-3xl my-8 rounded-lg border shadow-2xl ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 className="text-xl font-bold">Quotation Details</h2>
            {quotation && (
              <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {quotation.quotation_number}
              </p>
            )}
          </div>
          <button
            onClick={() => onClose()}
            className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          ) : quotation ? (
            <>
              {/* Status & Dates */}
              <div className={sectionClasses}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <HashIcon size={18} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
                    <span className="text-lg font-bold">{quotation.quotation_number}</span>
                    {statusBadge(quotation.status)}
                  </div>
                  {quotation && (
                    <PrintQuotationButton quotation={quotation} items={items} variant="small" />
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div>
                    <div className={labelClasses}>Created</div>
                    <div className={valueClasses}>{formatDate(quotation.created_at)}</div>
                  </div>
                  <div>
                    <div className={labelClasses}>Valid Until</div>
                    <div className={valueClasses}>{formatDate(quotation.valid_until)}</div>
                  </div>
                  <div>
                    <div className={labelClasses}>Finalized</div>
                    <div className={valueClasses}>{formatDate(quotation.finalized_at)}</div>
                  </div>
                  <div>
                    <div className={labelClasses}>Last Updated</div>
                    <div className={valueClasses}>{formatDate(quotation.updated_at)}</div>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              {(quotation.customer_name || quotation.customer_phone || quotation.customer_email || quotation.customer_address) && (
                <div className={sectionClasses}>
                  <h3 className="text-sm font-semibold mb-3">Customer Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {quotation.customer_name && (
                      <div className="flex items-center gap-2">
                        <UserIcon size={16} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
                        <span className={valueClasses}>{quotation.customer_name}</span>
                      </div>
                    )}
                    {quotation.customer_phone && (
                      <div className="flex items-center gap-2">
                        <PhoneIcon size={16} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
                        <span className={valueClasses}>{quotation.customer_phone}</span>
                      </div>
                    )}
                    {quotation.customer_email && (
                      <div className="flex items-center gap-2">
                        <EnvelopeSimpleIcon size={16} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
                        <span className={valueClasses}>{quotation.customer_email}</span>
                      </div>
                    )}
                    {quotation.customer_address && (
                      <div className="flex items-center gap-2">
                        <MapPinIcon size={16} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
                        <span className={valueClasses}>{quotation.customer_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className={sectionClasses}>
                <h3 className="text-sm font-semibold mb-3">Items ({items.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={isDarkMode ? 'bg-[#2a2a2a]' : 'bg-gray-100'}>
                      <tr>
                        <th className={`text-left px-3 py-2 text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>#</th>
                        <th className={`text-left px-3 py-2 text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Item</th>
                        <th className={`text-center px-3 py-2 text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Qty</th>
                        <th className={`text-right px-3 py-2 text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Price</th>
                        <th className={`text-right px-3 py-2 text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
                      {items.map((item, idx) => (
                        <tr key={item.id}>
                          <td className={`px-3 py-2.5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium">{item.product_name}</div>
                            {item.product_sku && (
                              <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                SKU: {item.product_sku}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">{item.quantity}</td>
                          <td className="px-3 py-2.5 text-right">{formatCurrency(item.unit_price)}</td>
                          <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(item.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div className={`mt-4 pt-3 border-t space-y-2 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex justify-between text-sm">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Subtotal</span>
                    <span className="font-medium">{formatCurrency(quotation.subtotal)}</span>
                  </div>
                  {quotation.discount_type !== 'none' && quotation.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-red-500">
                      <span>
                        Discount
                        {quotation.discount_type === 'percentage' && ` (${quotation.discount_value}%)`}
                      </span>
                      <span>-{formatCurrency(quotation.discount_amount)}</span>
                    </div>
                  )}
                  <div className={`flex justify-between text-base font-bold pt-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <span>Grand Total</span>
                    <span>{formatCurrency(quotation.total)}</span>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              {(quotation.notes || quotation.terms_and_conditions) && (
                <div className={sectionClasses}>
                  {quotation.notes && (
                    <div className="mb-3">
                      <h4 className={`text-xs font-medium uppercase mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Internal Notes
                      </h4>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {quotation.notes}
                      </p>
                    </div>
                  )}
                  {quotation.terms_and_conditions && (
                    <div>
                      <h4 className={`text-xs font-medium uppercase mb-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        Terms & Conditions
                      </h4>
                      <p className={`text-sm whitespace-pre-line ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {quotation.terms_and_conditions}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Audit Log */}
              <div className={sectionClasses}>
                <button
                  onClick={fetchAuditLog}
                  className="flex items-center gap-2 text-sm font-medium hover:underline"
                >
                  <ClockIcon size={16} />
                  {showAuditLog ? 'Hide' : 'Show'} Activity Log
                </button>
                {showAuditLog && auditLog.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {auditLog.map((entry) => (
                      <div
                        key={entry.id}
                        className={`flex items-start gap-3 text-sm py-2 border-b last:border-b-0 ${
                          isDarkMode ? 'border-gray-700' : 'border-gray-100'
                        }`}
                      >
                        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                          entry.action === 'created' ? 'bg-blue-500' :
                          entry.action === 'finalized' ? 'bg-green-500' :
                          entry.action === 'deleted' ? 'bg-red-500' :
                          'bg-gray-400'
                        }`} />
                        <div className="flex-1">
                          <span className="capitalize font-medium">{entry.action}</span>
                          {entry.changes && (
                            <span className={`ml-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              — {typeof entry.changes === 'string' ? entry.changes : JSON.stringify(entry.changes)}
                            </span>
                          )}
                          <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                            {formatDateTime(entry.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {showAuditLog && auditLog.length === 0 && (
                  <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    No activity recorded yet.
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Action Bar */}
        {quotation && !loading && (
          <div className={`flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            {quotation.status === 'draft' && (
              <>
                <button
                  onClick={() => router.push(`/dashboard/quotations/create?edit=${quotation.id}`)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${
                    isDarkMode
                      ? 'border-gray-600 text-gray-300 hover:bg-[#2a2a2a]'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <PencilSimpleIcon size={16} /> Edit
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircleIcon size={16} /> Finalize
                </button>
              </>
            )}
            {quotation.status === 'finalized' && (
              <button
                onClick={handleReopen}
                disabled={actionLoading}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${
                  isDarkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-[#2a2a2a]'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                } disabled:opacity-50`}
              >
                <ArrowCounterClockwiseIcon size={16} /> Reopen
              </button>
            )}
            <button
              onClick={handleDuplicate}
              disabled={actionLoading}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border ${
                isDarkMode
                  ? 'border-gray-600 text-gray-300 hover:bg-[#2a2a2a]'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              } disabled:opacity-50`}
            >
              <CopyIcon size={16} /> Duplicate
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
