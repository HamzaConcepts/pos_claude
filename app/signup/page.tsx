'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import type { UserRole } from '@/lib/supabase'
import { Eye, EyeOff } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [accountType, setAccountType] = useState<'Manager' | 'Cashier'>('Manager')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    storeName: '',
    fullName: '',
    phoneNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      if (!formData.storeName.trim()) {
        setError('Store name is required')
        return
      }
      if (!formData.email.trim()) {
        setError('Email is required for Manager accounts')
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
        // Manager signup with email verification (uses Supabase Auth)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              phone_number: formData.phoneNumber,
              store_name: formData.storeName,
              role: 'Manager',
            },
          },
        })

        if (authError) throw authError

        if (authData.user) {
          // Insert manager data into managers table
          const { error: dbError } = await supabase
            .from('managers')
            .insert([
              {
                id: authData.user.id,
                email: formData.email,
                full_name: formData.fullName,
                phone_number: formData.phoneNumber,
                store_name: formData.storeName,
              },
            ])

          if (dbError) throw dbError

          alert('Please check your email to verify your account')
          router.push('/login')
        }
      } else {
        // Cashier signup - direct database insert (no Supabase Auth)
        // Hash password using a simple approach for cashier-only accounts
        const { data: insertData, error: insertError } = await supabase
          .from('cashier_accounts')
          .insert([
            {
              full_name: formData.fullName,
              phone_number: formData.phoneNumber,
              password_hash: formData.password, // Will be hashed by database trigger/function
              role: 'Cashier',
            },
          ])
          .select()
          .single()

        if (insertError) throw insertError

        // Direct login for cashier (session management handled separately)
        alert('Account created successfully! Please login.')
        router.push('/login')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during signup')
    } finally {
      setLoading(false)
    }
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
