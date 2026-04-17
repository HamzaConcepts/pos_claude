'use client'

import { useEffect, useState } from 'react'
import { CheckIcon, XIcon, ClockIcon, StorefrontIcon, UserIcon, PhoneIcon, EnvelopeIcon } from '@phosphor-icons/react'

interface ApprovalRequest {
  id: number
  store_id: number
  user_id: string
  user_name: string
  user_phone: string
  user_email: string
  status: string
  requested_at: string
  store_name: string
  store_code: string
  cashier_count: number
  staff_count: number
}

type FilterStatus = 'pending' | 'approved' | 'rejected' | 'all'

async function getApiErrorMessage(res: Response, fallback: string) {
  try {
    const payload = await res.json()
    return payload?.error || fallback
  } catch {
    return fallback
  }
}

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('pending')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    requestId: number
    action: 'approve' | 'deny'
    userName: string
    storeName: string
  } | null>(null)
  const [notes, setNotes] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchRequests = async (status: FilterStatus) => {
    setLoading(true)
    try {
      setError('')
      const res = await fetch(`/api/super-admin/approvals?status=${status}`, {
        credentials: 'include',
        cache: 'no-store',
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to fetch approval requests'))
      }

      const data = await res.json()
      setRequests(data.requests || [])
    } catch (err: any) {
      console.error('Failed to fetch approval requests:', err)
      setError(err?.message || 'Failed to fetch approval requests')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests(filter)
  }, [filter])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleAction = async () => {
    if (!confirmModal) return
    setActionLoading(confirmModal.requestId)
    setConfirmModal(null)

    try {
      const res = await fetch(`/api/super-admin/approvals/${confirmModal.requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: confirmModal.action, notes: notes.trim() || null }),
      })
      const data = await res.json()

      if (!res.ok) {
        showToast(data.error || 'Action failed', 'error')
      } else {
        showToast(
          confirmModal.action === 'approve'
            ? `"${confirmModal.storeName}" approved — account is now active`
            : `"${confirmModal.storeName}" denied`,
          'success'
        )
        fetchRequests(filter)
      }
    } catch {
      showToast('Network error. Please try again.', 'error')
    } finally {
      setActionLoading(null)
      setNotes('')
    }
  }

  const openConfirm = (req: ApprovalRequest, action: 'approve' | 'deny') => {
    setNotes('')
    setConfirmModal({ requestId: req.id, action, userName: req.user_name, storeName: req.store_name })
  }

  const statusBadge = (status: string) => {
    if (status === 'pending') return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Pending</span>
    if (status === 'approved') return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Approved</span>
    if (status === 'rejected') return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Denied</span>
    return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{status}</span>
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
            : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Signup Approvals</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Review and approve or deny store registration requests
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {(['pending', 'approved', 'rejected', 'all'] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              filter === s
                ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && requests.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <ClockIcon size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-base font-medium">No {filter !== 'all' ? filter : ''} requests</p>
          <p className="text-sm mt-1">New store signup requests will appear here</p>
        </div>
      )}

      {/* Request Cards */}
      {!loading && requests.length > 0 && (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <StorefrontIcon size={18} className="text-gray-400 flex-shrink-0" />
                      <span className="font-semibold text-gray-900 dark:text-white text-base">
                        {req.store_name}
                      </span>
                      <span className="text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        {req.store_code}
                      </span>
                    </div>
                    {statusBadge(req.status)}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <UserIcon size={14} className="flex-shrink-0" />
                      <span>{req.user_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <EnvelopeIcon size={14} className="flex-shrink-0" />
                      <span className="truncate">{req.user_email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PhoneIcon size={14} className="flex-shrink-0" />
                      <span>{req.user_phone}</span>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-3 text-xs text-gray-500 dark:text-gray-500">
                    <span>{req.cashier_count} cashier account{req.cashier_count !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{req.staff_count} staff member{req.staff_count !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>Applied {new Date(req.requested_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions — only show for pending */}
                {req.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => openConfirm(req, 'deny')}
                      disabled={actionLoading === req.id}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                    >
                      <XIcon size={16} />
                      Deny
                    </button>
                    <button
                      onClick={() => openConfirm(req, 'approve')}
                      disabled={actionLoading === req.id}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === req.id ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent dark:border-gray-900 dark:border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckIcon size={16} />
                      )}
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {confirmModal.action === 'approve' ? 'Approve Signup' : 'Deny Signup'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {confirmModal.action === 'approve' ? (
                  <>
                    This will activate the store <span className="font-semibold text-gray-900 dark:text-white">{confirmModal.storeName}</span> and allow <span className="font-semibold text-gray-900 dark:text-white">{confirmModal.userName}</span> to log in.
                  </>
                ) : (
                  <>
                    This will deny the signup for <span className="font-semibold text-gray-900 dark:text-white">{confirmModal.storeName}</span>. The account will be banned. Are you sure?
                  </>
                )}
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={confirmModal.action === 'deny' ? 'Reason for denial...' : 'Any notes...'}
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    confirmModal.action === 'approve'
                      ? 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {confirmModal.action === 'approve' ? 'Approve' : 'Deny'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
