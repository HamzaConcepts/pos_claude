'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { UserRole } from '@/lib/supabase'
import { Eye, EyeOff, Store, UserPlus } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [accountType, setAccountType] = useState<'Manager' | 'Cashier'>('Manager')
  const [storeOption, setStoreOption] = useState<'create' | 'join'>('create') // For managers
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    storeName: '',
    fullName: '',
    phoneNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    storeCode: '', // For joining existing store
  })
  const [generatedStoreCode, setGeneratedStoreCode] = useState('') // Show code after store creation
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    checkExistingSession()
  }, [])

  const checkExistingSession = async () => {
    try {
      // Check for cashier session
      const cashierSession = localStorage.getItem('user_session')
      if (cashierSession) {
        const session = JSON.parse(cashierSession)
        if (session.store_id) {
          router.replace('/dashboard/pos')
          return
        }
      }

      // Check for manager session
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        // Verify manager has store_id
        const { data: managerData } = await supabase
          .from('managers')
          .select('store_id')
          .eq('id', session.user.id)
          .maybeSingle()

        if (managerData?.store_id) {
          router.replace('/dashboard')
          return
        } else {
          // Manager exists but no store - sign them out
          await supabase.auth.signOut()
        }
      }
    } catch (err) {
      console.error('Session check error:', err)
    } finally {
      setCheckingSession(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSignup = async (e: React.FormEvent) => {
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

    // Phone number validation
    if (!/^\d{11}$/.test(formData.phoneNumber)) {
      setError('Phone number must be exactly 11 digits')
      return
    }

    // Manager-specific validations
    if (accountType === 'Manager') {
      if (!formData.email.trim()) {
        setError('Email is required for Manager accounts')
        return
      }
      if (storeOption === 'create' && !formData.storeName.trim()) {
        setError('Store name is required')
        return
      }
      if (storeOption === 'join' && formData.storeCode.length !== 3) {
        setError('Store code must be exactly 3 characters')
        return
      }
    }

    // Cashier-specific validations
    if (accountType === 'Cashier') {
      if (formData.storeCode.length !== 3) {
        setError('Store code must be exactly 3 characters')
        return
      }
    }

    setLoading(true)

    try {
      // Check if phone number already exists in either table
      const { data: existingManager } = await supabase
        .from('managers')
        .select('phone_number')
        .eq('phone_number', formData.phoneNumber)
        .maybeSingle()

      const { data: existingCashier } = await supabase
        .from('cashier_accounts')
        .select('phone_number')
        .eq('phone_number', formData.phoneNumber)
        .maybeSingle()

      if (existingManager || existingCashier) {
        setError('Phone number already exists')
        setLoading(false)
        return
      }

      if (accountType === 'Manager') {
        if (storeOption === 'create') {
          // For creating a new store, use the signup API which handles everything
          const response = await fetch('/api/auth/signup-manager', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              fullName: formData.fullName,
              phoneNumber: formData.phoneNumber,
              storeName: formData.storeName,
              action: 'create',
            }),
          })

          const result = await response.json()

          if (!response.ok) {
            throw new Error(result.error || 'Failed to create account')
          }

          setGeneratedStoreCode(result.storeCode)
          alert(`Store created! Your store code is: ${result.storeCode}\n\nShare this code with your employees to join your store.\n\nPlease check your email to verify your account.`)
          router.push('/login')
        } else {
          // For joining an existing store, use the signup API
          const response = await fetch('/api/auth/signup-manager', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
              fullName: formData.fullName,
              phoneNumber: formData.phoneNumber,
              storeName: formData.storeName,
              storeCode: formData.storeCode.toUpperCase(),
              action: 'join',
            }),
          })

          const result = await response.json()

          if (!response.ok) {
            throw new Error(result.error || 'Failed to create account')
          }

          alert('Join request submitted! Please wait for the store manager to approve your request.\n\nAlso check your email to verify your account.')
          router.push('/login')
        }
      } else {
        // Cashier signup - use API to bypass RLS
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
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
        <div className="text-xl">Checking session...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary py-8">
      <div className="bg-white p-8 rounded border-2 border-gray w-full max-w-md">
        <h1 className="text-3xl font-bold mb-3 text-center">POS System</h1>
        <p className="text-center text-text-secondary mb-6">Create a new account</p>

        {/* Account Type Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setAccountType('Manager')}
            className={`flex-1 py-2 rounded font-medium transition-colors ${
              accountType === 'Manager'
                ? 'bg-black text-white'
                : 'bg-gray-200 text-black hover:bg-gray-300'
            }`}
          >
            Manager
          </button>
          <button
            type="button"
            onClick={() => setAccountType('Cashier')}
            className={`flex-1 py-2 rounded font-medium transition-colors ${
              accountType === 'Cashier'
                ? 'bg-black text-white'
                : 'bg-gray-200 text-black hover:bg-gray-300'
            }`}
          >
            Cashier
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-status-error text-white rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup}>
          {accountType === 'Manager' && (
            <>
              {/* Store Option Selection */}
              <div className="mb-6 border-2 border-gray rounded p-4">
                <label className="block mb-3 font-medium">Store Option</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStoreOption('create')}
                    className={`flex-1 p-3 rounded border-2 transition-all ${
                      storeOption === 'create'
                        ? 'border-black bg-black text-white'
                        : 'border-gray bg-white hover:border-gray-400'
                    }`}
                  >
                    <Store className="mx-auto mb-1" size={20} />
                    <div className="text-sm font-medium">Create New Store</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStoreOption('join')}
                    className={`flex-1 p-3 rounded border-2 transition-all ${
                      storeOption === 'join'
                        ? 'border-black bg-black text-white'
                        : 'border-gray bg-white hover:border-gray-400'
                    }`}
                  >
                    <UserPlus className="mx-auto mb-1" size={20} />
                    <div className="text-sm font-medium">Join Existing Store</div>
                  </button>
                </div>
              </div>

              {storeOption === 'create' && (
                <div className="mb-4">
                  <label htmlFor="storeName" className="block mb-2 font-medium">
                    Store Name
                  </label>
                  <input
                    id="storeName"
                    name="storeName"
                    type="text"
                    value={formData.storeName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border-2 border-gray rounded focus:outline-none focus:border-black"
                    required
                    disabled={loading}
                  />
                </div>
              )}

              {storeOption === 'join' && (
                <div className="mb-4">
                  <label htmlFor="storeCode" className="block mb-2 font-medium">
                    Store Code <span className="text-sm text-text-secondary">(3 characters)</span>
                  </label>
                  <input
                    id="storeCode"
                    name="storeCode"
                    type="text"
                    value={formData.storeCode}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border-2 border-gray rounded focus:outline-none focus:border-black uppercase"
                    placeholder="A1B"
                    maxLength={3}
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    Ask your store manager for the store code
                  </p>
                </div>
              )}
            </>
          )}

          {accountType === 'Cashier' && (
            <div className="mb-4">
              <label htmlFor="storeCode" className="block mb-2 font-medium">
                Store Code <span className="text-sm text-text-secondary">(3 characters)</span>
              </label>
              <input
                id="storeCode"
                name="storeCode"
                type="text"
                value={formData.storeCode}
                onChange={handleChange}
                className="w-full px-3 py-2 border-2 border-gray rounded focus:outline-none focus:border-black uppercase"
                placeholder="A1B"
                maxLength={3}
                required
                disabled={loading}
              />
              <p className="text-xs text-text-secondary mt-1">
                Ask your manager for the store code
              </p>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="fullName" className="block mb-2 font-medium">
              {accountType === 'Manager' ? 'Manager Name' : 'Name'}
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-3 py-2 border-2 border-gray rounded focus:outline-none focus:border-black"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="phoneNumber" className="block mb-2 font-medium">
              Phone Number <span className="text-sm text-text-secondary">(11 digits)</span>
            </label>
            <input
              id="phoneNumber"
              name="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={handleChange}
              className="w-full px-3 py-2 border-2 border-gray rounded focus:outline-none focus:border-black"
              placeholder="03001234567"
              maxLength={11}
              required
              disabled={loading}
            />
          </div>

          {accountType === 'Manager' && (
            <div className="mb-4">
              <label htmlFor="email" className="block mb-2 font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border-2 border-gray rounded focus:outline-none focus:border-black"
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="password" className="block mb-2 font-medium">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 py-2 border-2 border-gray rounded focus:outline-none focus:border-black pr-10"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block mb-2 font-medium">
              Repeat Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-3 py-2 border-2 border-gray rounded focus:outline-none focus:border-black pr-10"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black"
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
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-4 text-center text-text-secondary">
          Already have an account?{' '}
          <Link href="/login" className="text-black underline font-medium">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
