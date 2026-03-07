'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Eye, EyeSlash, Storefront, UserPlus } from '@phosphor-icons/react'

export default function JoinStorePage() {
  const router = useRouter()
  const [accountType, setAccountType] = useState<'Manager' | 'Cashier'>('Cashier')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    storeCode: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    checkExistingSession()
  }, [])

  const checkExistingSession = async () => {
    try {
      const cashierSession = localStorage.getItem('user_session')
      if (cashierSession) {
        const session = JSON.parse(cashierSession)
        if (session.store_id) {
          router.replace('/dashboard/pos')
          return
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: managerData } = await supabase
          .from('managers')
          .select('store_id')
          .eq('id', session.user.id)
          .maybeSingle()

        if (managerData?.store_id) {
          router.replace('/dashboard')
          return
        }
      }
    } catch (err) {
      console.error('Session check error:', err)
    } finally {
      setCheckingSession(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target

    if (name === 'phoneNumber') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 11) }))
    } else if (name === 'storeCode') {
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase().slice(0, 3) }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      setError('Password must contain uppercase, lowercase, and number')
      return
    }

    if (!/^\d{11}$/.test(formData.phoneNumber)) {
      setError('Phone number must be exactly 11 digits')
      return
    }

    if (formData.storeCode.length !== 3) {
      setError('Store code must be exactly 3 characters')
      return
    }

    if (accountType === 'Manager' && !formData.email.trim()) {
      setError('Email is required for Manager accounts')
      return
    }

    setLoading(true)

    try {
      if (accountType === 'Manager') {
        // Manager joining existing store
        const response = await fetch('/api/auth/signup-manager', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            fullName: formData.fullName,
            phoneNumber: formData.phoneNumber,
            storeCode: formData.storeCode.toUpperCase(),
            action: 'join',
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create account')
        }

        alert('Join request submitted! Please wait for the store manager to approve your request.\n\nCheck your email to verify your account.')
        router.push('/login')
      } else {
        // Cashier joining existing store
        const response = await fetch('/api/auth/signup-cashier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: formData.fullName,
            phoneNumber: formData.phoneNumber,
            password: formData.password,
            storeCode: formData.storeCode.toUpperCase(),
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create account')
        }

        alert('Join request submitted! Please wait for the store manager to approve your request.')
        router.push('/login')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Checking session...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow-lg p-6 sm:p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-100 dark:bg-cyan-900/30 rounded-full mb-4">
            <UserPlus size={32} className="text-cyan-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Join Existing Store</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Use a store code to join an existing store</p>
        </div>

        {/* Account Type Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setAccountType('Cashier')}
            className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
              accountType === 'Cashier'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Join as Cashier
          </button>
          <button
            type="button"
            onClick={() => setAccountType('Manager')}
            className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
              accountType === 'Manager'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Join as Manager
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Store Code */}
          <div className="mb-4">
            <label htmlFor="storeCode" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Store Code <span className="text-red-600">*</span>
            </label>
            <input
              id="storeCode"
              name="storeCode"
              type="text"
              value={formData.storeCode}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white bg-white dark:bg-gray-800 uppercase text-center text-xl tracking-widest font-bold focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="ABC"
              maxLength={3}
              required
              disabled={loading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
              Ask your store manager for the 3-character store code
            </p>
          </div>

          {/* Full Name */}
          <div className="mb-4">
            <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Full Name <span className="text-red-600">*</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="Your full name"
              required
              disabled={loading}
            />
          </div>

          {/* Phone Number */}
          <div className="mb-4">
            <label htmlFor="phoneNumber" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Phone Number <span className="text-red-600">*</span>
            </label>
            <input
              id="phoneNumber"
              name="phoneNumber"
              type="text"
              value={formData.phoneNumber}
              onChange={handleChange}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="03001234567"
              maxLength={11}
              required
              disabled={loading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formData.phoneNumber.length}/11 digits</p>
          </div>

          {/* Email (Manager only) */}
          {accountType === 'Manager' && (
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="manager@example.com"
                required
                disabled={loading}
              />
            </div>
          )}

          {/* Password */}
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Password <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 pr-12 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="Min 8 characters"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Confirm Password <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 pr-12 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="Confirm your password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                {showConfirmPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Submitting Request...' : 'Request to Join'}
          </button>
        </form>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-400">
            <strong>Note:</strong> After submitting your request, the store manager will need to approve your access. 
            You'll be able to login once approved.
          </p>
        </div>

        {/* Links */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-cyan-600 hover:text-cyan-700 font-semibold">
              Sign in
            </Link>
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Want to create a new store?{' '}
            <Link href="/signup" className="text-cyan-600 hover:text-cyan-700 font-semibold">
              Create Store
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
