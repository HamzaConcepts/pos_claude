'use client'

import { useEffect, useState } from 'react'
import { MagnifyingGlassIcon, PowerIcon, PencilSimpleIcon, XIcon } from '@phosphor-icons/react'

interface Manager {
  id: string
  full_name: string
  email: string
  phone_number: string
  store_id: number | null
  store_name: string | null
  is_active: boolean
  created_at: string
}

async function getApiErrorMessage(res: Response, fallback: string) {
  try {
    const payload = await res.json()
    return payload?.error || fallback
  } catch {
    return fallback
  }
}

export default function ManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editManager, setEditManager] = useState<Manager | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone_number: '' })
  const [editSaving, setEditSaving] = useState(false)

  const fetchManagers = async () => {
    try {
      setError('')
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/super-admin/managers?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to fetch managers'))
      }

      const json = await res.json()
      setManagers(json.data || [])
    } catch (err: any) {
      console.error('Failed to fetch managers:', err)
      setError(err?.message || 'Failed to fetch managers')
      setManagers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchManagers() }, [search, statusFilter])

  const toggleActive = async (manager: Manager) => {
    setActionLoading(manager.id)
    try {
      setError('')
      const res = await fetch(`/api/super-admin/managers/${manager.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !manager.is_active }),
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to update manager status'))
      }

      await fetchManagers()
    } catch (err: any) {
      console.error('Failed to toggle manager:', err)
      setError(err?.message || 'Failed to update manager status')
    } finally {
      setActionLoading(null)
    }
  }

  const openEdit = (manager: Manager) => {
    setEditManager(manager)
    setEditForm({ full_name: manager.full_name, email: manager.email, phone_number: manager.phone_number })
  }

  const saveEdit = async () => {
    if (!editManager) return
    setEditSaving(true)
    try {
      setError('')
      const res = await fetch(`/api/super-admin/managers/${editManager.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to save manager'))
      }

      setEditManager(null)
      await fetchManagers()
    } catch (err: any) {
      console.error('Failed to save manager:', err)
      setError(err?.message || 'Failed to save manager')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Managers</h1>

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
            placeholder="Search by name, email, or phone..."
            className="w-full pl-9 pr-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          title="Filter managers by status"
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
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Store</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Joined</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : managers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No managers found</td></tr>
              ) : (
                managers.map((m) => (
                  <tr key={m.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{m.full_name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{m.email}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{m.phone_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{m.store_name || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>{m.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                          title="Edit"
                        >
                          <PencilSimpleIcon size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(m)}
                          disabled={actionLoading === m.id}
                          className={`p-1.5 rounded ${
                            m.is_active
                              ? 'hover:bg-orange-50 text-orange-600 dark:hover:bg-orange-900/20 dark:text-orange-400'
                              : 'hover:bg-green-50 text-green-600 dark:hover:bg-green-900/20 dark:text-green-400'
                          }`}
                          title={m.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <PowerIcon size={16} />
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

      {/* Edit Modal */}
      {editManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Manager</h3>
              <button type="button" title="Close" onClick={() => setEditManager(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <XIcon size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input type="text" title="Manager name" placeholder="Full name" value={editForm.full_name} onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input type="email" title="Manager email" placeholder="name@example.com" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input type="text" title="Manager phone" placeholder="03XXXXXXXXX" value={editForm.phone_number} onChange={(e) => setEditForm(f => ({ ...f, phone_number: e.target.value }))}
                  className="w-full px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setEditManager(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button type="button" onClick={saveEdit} disabled={editSaving}
                className="flex-1 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded text-sm hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50">
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
