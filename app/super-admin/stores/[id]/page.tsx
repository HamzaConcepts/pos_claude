'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeftIcon, FloppyDiskIcon, PowerIcon } from '@phosphor-icons/react'

interface StoreDetail {
  store: {
    id: number; store_code: string; store_name: string; currency: string
    is_active: boolean; created_at: string; logo_url: string | null
  }
  managers: { id: string; full_name: string; email: string; phone_number: string; is_active: boolean; created_at: string }[]
  cashierAccounts: { id: number; full_name: string; phone_number: string | null; role: string; is_active: boolean; created_at: string }[]
  cashiers: { id: number; full_name: string; phone_number: string; commission_rate: number; salary: number; is_active: boolean; created_at: string }[]
  joinRequests: { id: number; user_name: string; user_type: string; status: string; requested_at: string }[]
}

async function getApiErrorMessage(res: Response, fallback: string) {
  try {
    const payload = await res.json()
    return payload?.error || fallback
  } catch {
    return fallback
  }
}

export default function StoreDetailPage() {
  const router = useRouter()
  const params = useParams()
  const storeId = params.id as string

  const [data, setData] = useState<StoreDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editName, setEditName] = useState('')
  const [editCurrency, setEditCurrency] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchStore = async () => {
    try {
      setError('')
      const res = await fetch(`/api/super-admin/stores/${storeId}`, {
        credentials: 'include',
        cache: 'no-store',
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to fetch store details'))
      }

      const json = await res.json()
      setData(json)
      setEditName(json.store.store_name)
      setEditCurrency(json.store.currency)
    } catch (err: any) {
      console.error('Failed to fetch store:', err)
      setError(err?.message || 'Failed to fetch store details')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStore() }, [storeId])

  const saveStore = async () => {
    setSaving(true)
    try {
      setError('')
      const res = await fetch(`/api/super-admin/stores/${storeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ store_name: editName, currency: editCurrency }),
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to save store details'))
      }

      await fetchStore()
    } catch (err: any) {
      console.error('Failed to save:', err)
      setError(err?.message || 'Failed to save store details')
    } finally {
      setSaving(false)
    }
  }

  const toggleStoreActive = async () => {
    if (!data) return
    setActionLoading('store')
    try {
      setError('')
      const res = await fetch(`/api/super-admin/stores/${storeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !data.store.is_active }),
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to update store status'))
      }

      await fetchStore()
    } catch (err: any) {
      console.error('Failed to toggle store:', err)
      setError(err?.message || 'Failed to update store status')
    } finally {
      setActionLoading(null)
    }
  }

  const toggleManagerActive = async (managerId: string, currentActive: boolean) => {
    setActionLoading(`manager-${managerId}`)
    try {
      setError('')
      const res = await fetch(`/api/super-admin/managers/${managerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentActive }),
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to update manager status'))
      }

      await fetchStore()
    } catch (err: any) {
      console.error('Failed to toggle manager:', err)
      setError(err?.message || 'Failed to update manager status')
    } finally {
      setActionLoading(null)
    }
  }

  const toggleCashierActive = async (cashierId: number, currentActive: boolean) => {
    setActionLoading(`cashier-${cashierId}`)
    try {
      setError('')
      const res = await fetch(`/api/super-admin/cashiers/${cashierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !currentActive }),
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to update cashier status'))
      }

      await fetchStore()
    } catch (err: any) {
      console.error('Failed to toggle cashier:', err)
      setError(err?.message || 'Failed to update cashier status')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="text-center text-gray-500 py-12">Store not found</div>
  }

  const { store, managers, cashierAccounts, cashiers, joinRequests } = data

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" title="Back to stores" onClick={() => router.push('/super-admin/stores')} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeftIcon size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{store.store_name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Code: {store.store_code}</p>
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          store.is_active
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {store.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Store Info */}
      <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Store Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Store Name</label>
            <input
              type="text"
              title="Store name"
              placeholder="Store name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
            <input
              type="text"
              title="Store currency"
              placeholder="Currency code"
              value={editCurrency}
              onChange={(e) => setEditCurrency(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={saveStore}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded text-sm hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50"
          >
            <FloppyDiskIcon size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={toggleStoreActive}
            disabled={actionLoading === 'store'}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm border ${
              store.is_active
                ? 'border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-400 dark:hover:bg-orange-900/20'
                : 'border-green-300 text-green-600 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900/20'
            }`}
          >
            <PowerIcon size={16} />
            {store.is_active ? 'Deactivate Store' : 'Activate Store'}
          </button>
        </div>
      </div>

      {/* Managers */}
      <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Managers ({managers.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Email</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Phone</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {managers.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500 dark:text-gray-400">No managers</td></tr>
            ) : managers.map((m) => (
              <tr key={m.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-4 py-2.5 text-gray-900 dark:text-white">{m.full_name}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{m.email}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{m.phone_number}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    m.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>{m.is_active ? 'Active' : 'Inactive'}</span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => toggleManagerActive(m.id, m.is_active)}
                    disabled={actionLoading === `manager-${m.id}`}
                    className={`text-xs px-3 py-1 rounded ${
                      m.is_active
                        ? 'text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20'
                        : 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                    }`}
                  >
                    {m.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cashier Accounts */}
      <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cashier Accounts ({cashierAccounts.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Phone</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Role</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Status</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {cashierAccounts.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-500 dark:text-gray-400">No cashier accounts</td></tr>
            ) : cashierAccounts.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-4 py-2.5 text-gray-900 dark:text-white">{c.full_name}</td>
                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{c.phone_number || 'N/A'}</td>
                <td className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400">{c.role}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>{c.is_active ? 'Active' : 'Inactive'}</span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => toggleCashierActive(c.id, c.is_active)}
                    disabled={actionLoading === `cashier-${c.id}`}
                    className={`text-xs px-3 py-1 rounded ${
                      c.is_active
                        ? 'text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20'
                        : 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                    }`}
                  >
                    {c.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Individual Cashiers (Staff) */}
      {cashiers.length > 0 && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Staff Members ({cashiers.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Phone</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Commission</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Salary</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {cashiers.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2.5 text-gray-900 dark:text-white">{c.full_name}</td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{c.phone_number}</td>
                  <td className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400">{c.commission_rate}%</td>
                  <td className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400">{c.salary?.toLocaleString() || '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>{c.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Join Requests */}
      {joinRequests.length > 0 && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Join Requests</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Name</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Type</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Requested</th>
              </tr>
            </thead>
            <tbody>
              {joinRequests.map((jr) => (
                <tr key={jr.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2.5 text-gray-900 dark:text-white">{jr.user_name}</td>
                  <td className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-400">{jr.user_type}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      jr.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : jr.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>{jr.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{new Date(jr.requested_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
