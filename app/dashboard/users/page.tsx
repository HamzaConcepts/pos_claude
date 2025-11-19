'use client'

import { useEffect, useState } from 'react'
import { Users, Shield, User, Clock, CheckCircle, XCircle } from 'lucide-react'
import { getStoreId } from '@/lib/supabase'

interface UserData {
  id: string
  email: string
  full_name: string
  role: 'Manager' | 'Cashier'
  created_at: string
}

interface JoinRequest {
  id: number
  user_id: string
  user_type: string
  user_email: string | null
  user_name: string
  user_phone: string
  requested_at: string
  status: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState<number | null>(null)

  useEffect(() => {
    fetchUsers()
    fetchJoinRequests()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError('')
      
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/users?store_id=${storeId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const result = await response.json()

      if (result.success) {
        setUsers(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to fetch users')
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchJoinRequests = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) {
        console.error('No store ID found')
        return
      }

      const response = await fetch(`/api/join-requests?storeId=${storeId}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const result = await response.json()

      if (result.requests) {
        setJoinRequests(result.requests)
      }
    } catch (err) {
      console.error('Error fetching join requests:', err)
    }
  }

  const handleJoinRequest = async (requestId: number, action: 'approve' | 'reject') => {
    try {
      setProcessing(requestId)
      setError('')

      // Get current user ID from session (manager ID who is approving/rejecting)
      const reviewerId = sessionStorage.getItem('user_id') || ''
      
      if (!reviewerId) {
        setError('Unable to identify reviewer. Please login again.')
        setProcessing(null)
        return
      }

      const response = await fetch('/api/join-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          action,
          reviewerId,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Refresh both lists
        await fetchJoinRequests()
        await fetchUsers()
      } else {
        setError(result.error || 'Failed to process join request')
      }
    } catch (err) {
      setError('Failed to process join request')
      console.error('Error processing join request:', err)
    } finally {
      setProcessing(null)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Manager':
        return 'bg-black text-white'
      case 'Cashier':
        return 'bg-gray-400 text-white'
      default:
        return 'bg-gray-200 text-black'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Manager':
        return <Shield size={16} />
      case 'Cashier':
        return <User size={16} />
      default:
        return <User size={16} />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Loading users...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">User Management</h1>
          <p className="text-text-secondary">Manage user accounts and roles</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-status-error text-white rounded">
          {error}
        </div>
      )}

      {/* Pending Join Requests */}
      {joinRequests.length > 0 && (
        <div className="mb-6 bg-white rounded border-2 border-black overflow-hidden">
          <div className="p-4 bg-yellow-100 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <Clock size={20} />
              <h2 className="text-lg font-bold">Pending Join Requests ({joinRequests.length})</h2>
            </div>
          </div>

          <div className="p-4">
            {joinRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 mb-3 bg-bg-secondary rounded border-2 border-gray-300 last:mb-0"
              >
                  <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-400 text-white rounded-full flex items-center justify-center font-bold">
                      {request.user_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-bold">{request.user_name}</p>
                      <p className="text-sm text-text-secondary">
                        {request.user_email || request.user_phone}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          request.user_type === 'Manager' ? 'bg-black text-white' : 'bg-gray-400 text-white'
                        }`}>
                          {request.user_type === 'Manager' ? <Shield size={12} /> : <User size={12} />}
                          {request.user_type}
                        </span>
                        <span className="text-xs text-text-secondary">
                          Requested: {new Date(request.requested_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleJoinRequest(request.id, 'approve')}
                    disabled={processing === request.id}
                    className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckCircle size={16} />
                    {processing === request.id ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleJoinRequest(request.id, 'reject')}
                    disabled={processing === request.id}
                    className="flex items-center gap-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <XCircle size={16} />
                    {processing === request.id ? 'Processing...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded border-2 border-black">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={20} />
            <span className="text-sm text-text-secondary">Managers</span>
          </div>
          <p className="text-2xl font-bold">
            {users.filter(u => u.role === 'Manager').length}
          </p>
        </div>

        <div className="bg-white p-4 rounded border-2 border-black">
          <div className="flex items-center gap-2 mb-2">
            <User size={20} />
            <span className="text-sm text-text-secondary">Cashiers</span>
          </div>
          <p className="text-2xl font-bold">
            {users.filter(u => u.role === 'Cashier').length}
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded border-2 border-black overflow-hidden">
        <div className="p-4 bg-black text-white">
          <h2 className="text-lg font-bold">All Users ({users.length})</h2>
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">
            No users found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-bold">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Created Date</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr
                    key={user.id}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-bg-secondary'}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold text-sm">
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{user.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium ${getRoleColor(user.role)}`}>
                        {getRoleIcon(user.role)}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {new Date(user.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Permissions Info */}
      <div className="mt-6 bg-bg-secondary p-4 rounded border-2 border-black">
        <h3 className="font-bold mb-3">Role Permissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={16} />
              <span className="font-bold">Manager</span>
            </div>
            <ul className="text-text-secondary space-y-1 ml-6">
              <li>• Full system access</li>
              <li>• All pages and features</li>
              <li>• Create/manage users</li>
              <li>• Complete control</li>
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User size={16} />
              <span className="font-bold">Cashier</span>
            </div>
            <ul className="text-text-secondary space-y-1 ml-6">
              <li>• Access Inventory page</li>
              <li>• Access POS page</li>
              <li>• Access Expenses page</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
