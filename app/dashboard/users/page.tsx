'use client'

import { useEffect, useState } from 'react'
import { Users, Shield, User } from 'lucide-react'

interface UserData {
  id: string
  email: string
  full_name: string
  role: 'Manager' | 'Cashier'
  created_at: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/users', {
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
