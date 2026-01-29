'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    checkExistingSession()
  }, [])

  const checkExistingSession = async () => {
    try {
      // First check for manager session (Supabase Auth)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        // Verify manager has store_id
        const { data: managerData } = await supabase
          .from('managers')
          .select('store_id')
          .eq('id', session.user.id)
          .maybeSingle()

        if (managerData?.store_id) {
          // Valid manager session - restore sessionStorage
          sessionStorage.setItem('store_id', managerData.store_id.toString())
          sessionStorage.setItem('user_type', 'Manager')
          sessionStorage.setItem('user_id', session.user.id)
          router.replace('/dashboard')
          return
        } else {
          // Manager exists but no store - sign them out and clear
          await supabase.auth.signOut()
          sessionStorage.clear()
        }
      }

      // Then check for cashier session
      const cashierSession = localStorage.getItem('user_session')
      if (cashierSession) {
        try {
          const session = JSON.parse(cashierSession)
          if (session.store_id && session.id) {
            // Verify cashier still exists and is active
            const { data: cashierCheck } = await supabase
              .from('cashiers')
              .select('id, store_id')
              .eq('id', session.id)
              .maybeSingle()
            
            if (cashierCheck && cashierCheck.store_id) {
              // Valid cashier session - restore sessionStorage
              sessionStorage.setItem('store_id', cashierCheck.store_id.toString())
              sessionStorage.setItem('user_type', 'Cashier')
              router.replace('/dashboard/pos')
              return
            } else {
              // Invalid cashier session - clear it
              localStorage.removeItem('user_session')
              sessionStorage.clear()
            }
          } else {
            // Invalid session format - clear it
            localStorage.removeItem('user_session')
            sessionStorage.clear()
          }
        } catch (err) {
          // Corrupted session data - clear it
          localStorage.removeItem('user_session')
          sessionStorage.clear()
        }
      }
    } catch (err) {
      console.error('Session check error:', err)
      // On error, clear everything
      localStorage.removeItem('user_session')
      sessionStorage.clear()
    } finally {
      setCheckingSession(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // First, check if it's a cashier account (direct database auth)
      // We need to use crypt() function to compare hashed passwords
      const { data: cashierData, error: cashierError } = await supabase
        .rpc('verify_cashier_login', {
          identifier: name,
          password_input: password
        })

      if (cashierData && cashierData.length > 0) {
        const cashier = cashierData[0]
        
        // Check if cashier has store_id (approved)
        if (!cashier.store_id) {
          setError('Your account is pending approval from the store manager.')
          setLoading(false)
          return
        }
        
        // Create a session manually for cashier
        localStorage.setItem('user_session', JSON.stringify({
          id: cashier.id,
          role: 'Cashier',
          full_name: cashier.full_name,
          phone_number: cashier.phone_number,
          store_id: cashier.store_id,
        }))
        
        // Also set sessionStorage for consistency (used by layout and getStoreId)
        sessionStorage.setItem('store_id', cashier.store_id.toString())
        sessionStorage.setItem('user_type', 'Cashier')
        
        router.push('/dashboard/pos')
        return
      }

      // If not cashier, try manager login with Supabase Auth
      // First check if input looks like an email
      const isEmail = name.includes('@')
      let loginEmail = name
      
      if (!isEmail) {
        // Use API to look up manager by name or phone (bypasses RLS)
        const response = await fetch('/api/auth/lookup-manager', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: name }),
        })

        const result = await response.json()

        if (!response.ok || !result.email) {
          setError('Manager not found. Please use your registered email, name, or phone number.')
          setLoading(false)
          return
        }
        
        loginEmail = result.email
      }

      // Manager login with Supabase Auth using email
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      })

      if (error) {
        console.error('Supabase Auth Error:', error)
        throw error
      }

      if (data.user) {
        // Wait for auth session to establish
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Now with auth.uid() set, query manager data (RLS will allow access)
        const { data: managerData, error: managerCheckError } = await supabase
          .from('managers')
          .select('store_id')
          .eq('id', data.user.id)
          .maybeSingle()

        if (managerCheckError) {
          console.error('Manager check error:', managerCheckError)
          await supabase.auth.signOut()
          setError('Error fetching manager data. Please try again.')
          setLoading(false)
          return
        }

        if (!managerData) {
          await supabase.auth.signOut()
          setError('Manager account not found. Please contact support.')
          setLoading(false)
          return
        }

        if (!managerData.store_id) {
          // Check for pending join request
          const { data: request } = await supabase
            .from('join_requests')
            .select('status')
            .eq('user_id', data.user.id)
            .eq('status', 'pending')
            .maybeSingle()

          if (request) {
            await supabase.auth.signOut()
            setError('Your account is pending approval from the store manager.')
            setLoading(false)
            return
          } else {
            await supabase.auth.signOut()
            setError('Your account is not associated with any store.')
            setLoading(false)
            return
          }
        }

        // Store store_id and user_type in sessionStorage
        sessionStorage.setItem('store_id', managerData.store_id.toString())
        sessionStorage.setItem('user_type', 'Manager')
        sessionStorage.setItem('user_id', data.user.id)
        
        // Wait a moment to ensure sessionStorage is persisted
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Redirect to dashboard
        router.push('/dashboard')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <div className="text-lg text-gray-600">Checking session...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <div className="bg-white p-8 rounded border border-gray-200 w-full max-w-md shadow-sm">
        <h1 className="text-2xl font-bold mb-2 text-center text-gray-900">POS System</h1>
        <p className="mb-6 text-center text-sm text-gray-600">Sign in to your account</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label htmlFor="name" className="block mb-1 font-medium text-sm text-gray-700">
              Name or Phone Number
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
              placeholder="Enter your name or phone number"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block mb-1 font-medium text-sm text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600 pr-10"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-600 text-white py-2 rounded hover:bg-cyan-700 disabled:bg-gray-400 transition-colors text-sm font-medium"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link href="/signup" className="text-cyan-600 hover:text-cyan-700 underline font-medium">
            Sign up
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-gray-600">
          Forgot password?{' '}
          <Link href="/reset-password" className="text-cyan-600 hover:text-cyan-700 underline font-medium">
            Reset Password
          </Link>
        </p>
      </div>
    </div>
  )
}

