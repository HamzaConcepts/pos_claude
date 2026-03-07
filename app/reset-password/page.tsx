'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeftIcon } from '@phosphor-icons/react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!email.includes('@')) {
        setError('Please enter a valid email address')
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      })

      if (error) {
        throw error
      }

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary dark:bg-[#0f0f0f] p-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 rounded border-2 border-black dark:border-gray-700">
            <h1 className="text-2xl font-bold mb-6 text-center dark:text-white">Check Your Email</h1>
            
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-700 rounded">
              <p className="text-green-800 dark:text-green-400">
                Password reset instructions have been sent to <strong>{email}</strong>
              </p>
              <p className="text-green-800 dark:text-green-400 mt-2 text-sm">
                Please check your email and click the reset link to set a new password.
              </p>
            </div>

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full bg-black dark:bg-gray-700 text-white py-2 rounded hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
            >
              <ArrowLeftIcon size={20} />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary dark:bg-[#0f0f0f] p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-[#1a1a1a] p-8 rounded border-2 border-black dark:border-gray-700">
          <h1 className="text-2xl font-bold mb-2 text-center dark:text-white">Reset Password</h1>
          <p className="text-text-secondary dark:text-gray-400 text-center mb-6">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border-2 border-status-error dark:border-red-800 rounded">
              <p className="text-status-error dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block mb-2 font-medium dark:text-gray-300">
                Email Address <span className="text-status-error">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black dark:border-gray-600 rounded focus:outline-none font-sans bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="your.email@example.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black dark:bg-gray-700 text-white py-2 rounded hover:bg-gray-800 dark:hover:bg-gray-600 disabled:bg-gray-400 transition-colors"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <p className="mt-4 text-center text-text-secondary dark:text-gray-400">
            Remember your password?{' '}
            <Link href="/login" className="text-black dark:text-white underline font-medium">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
