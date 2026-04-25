'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon, EyeIcon, PowerIcon, TrashIcon } from '@phosphor-icons/react'

interface Store {
  id: number
  store_code: string
  store_name: string
  currency: string
  is_active: boolean
  created_at: string
  owner: { id: string; full_name: string; email: string } | null
  cashier_count: number
  sales_count: number
}

async function getApiErrorMessage(res: Response, fallback: string) {
  try {
    const payload = await res.json()
    return payload?.error || fallback
  } catch {
    return fallback
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export default function StoresPage() {
  const router = useRouter()
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const fetchStores = async () => {
    try {
      setError('')
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/super-admin/stores?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to fetch stores'))
      }

      const json = await res.json()
      setStores(json.data || [])
    } catch (err: unknown) {
      console.error('Failed to fetch stores:', err)
      setError(getErrorMessage(err, 'Failed to fetch stores'))
      setStores([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStores() }, [search, statusFilter])

  const toggleActive = async (store: Store) => {
    setActionLoading(store.id)
    try {
      setError('')
      const res = await fetch(`/api/super-admin/stores/${store.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !store.is_active }),
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to update store status'))
      }

      await fetchStores()
    } catch (err: unknown) {
      console.error('Failed to toggle store:', err)
      setError(getErrorMessage(err, 'Failed to update store status'))
    } finally {
      setActionLoading(null)
    }
  }

  const deleteStore = async (id: number) => {
    setActionLoading(id)
    try {
      setError('')
      const res = await fetch(`/api/super-admin/stores/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to deactivate store'))
      }

      setConfirmDelete(null)
      await fetchStores()
    } catch (err: unknown) {
      console.error('Failed to delete store:', err)
      setError(getErrorMessage(err, 'Failed to deactivate store'))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stores</h1>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code..."
            className="w-full pl-9 pr-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          title="Filter stores by status"
          className="px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Store</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Owner</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Cashiers</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Sales</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Currency</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Created</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No stores found</td>
                </tr>
              ) : (
                stores.map((store) => (
                  <tr key={store.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{store.store_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono">{store.store_code}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-gray-900 dark:text-white">{store.owner?.full_name || '—'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{store.owner?.email || ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{store.cashier_count}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                        {store.sales_count.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{store.currency}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        store.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {store.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {new Date(store.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => router.push(`/super-admin/stores/${store.id}`)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                          title="View Details"
                        >
                          <EyeIcon size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(store)}
                          disabled={actionLoading === store.id}
                          className={`p-1.5 rounded ${
                            store.is_active
                              ? 'hover:bg-orange-50 text-orange-600 dark:hover:bg-orange-900/20 dark:text-orange-400'
                              : 'hover:bg-green-50 text-green-600 dark:hover:bg-green-900/20 dark:text-green-400'
                          }`}
                          title={store.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <PowerIcon size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(store.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-red-600 dark:hover:bg-red-900/20 dark:text-red-400"
                          title="Delete (Deactivate)"
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Deactivate Store?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will deactivate the store and all associated managers and cashiers. They will no longer be able to log in.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteStore(confirmDelete)}
                disabled={actionLoading === confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === confirmDelete ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
