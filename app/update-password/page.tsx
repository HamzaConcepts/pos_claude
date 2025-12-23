'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isValidSession, setIsValidSession] = useState(false)

  useEffect(() => {
    // Check if user arrived via password reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setIsValidSession(true)
      } else {
        setError('Invalid or expired reset link. Please request a new password reset.')
      }
    }
    checkSession()
  }, [])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        throw error
      }

      // Sign out after password update
      await supabase.auth.signOut()
      
      // Redirect to login with success message
      router.push('/login?message=password-updated')
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isValidSession && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary p-4">
        <div className="text-xl">Verifying...</div>
      </div>
    )
  }

  if (error && !isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary p-4">
        <div className="max-w-md w-full">
          <div className="bg-white p-8 rounded border-2 border-black">
            <div className="mb-6 p-4 bg-red-50 border-2 border-status-error rounded">
              <p className="text-status-error">{error}</p>
            </div>
            <button
              onClick={() => router.push('/reset-password')}
              className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 transition-colors"
            >
              Request New Reset Link
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary p-4">
      <div className="max-w-md w-full">
        <div className="bg-white p-8 rounded border-2 border-black">
          <h1 className="text-2xl font-bold mb-2 text-center">Set New Password</h1>
          <p className="text-text-secondary text-center mb-6">
            Enter your new password below
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-status-error rounded">
              <p className="text-status-error text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block mb-2 font-medium">
                New Password <span className="text-status-error">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border-2 border-black rounded focus:outline-none font-sans"
                  placeholder="Enter new password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-black"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="text-xs text-text-secondary mt-1">Minimum 6 characters</p>
            </div>

            <div>
              <label className="block mb-2 font-medium">
                Confirm Password <span className="text-status-error">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border-2 border-black rounded focus:outline-none font-sans"
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-black"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
