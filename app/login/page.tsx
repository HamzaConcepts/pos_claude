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
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
        <div className="text-xl">Checking session...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
      <div className="bg-white p-8 rounded border-2 border-gray w-full max-w-md">
        <h1 className="text-3xl font-bold mb-3 text-center">POS System</h1>
        <p className="mb-5 text-center text-text-secondary">Sign in to your account</p>
        {/* <h2 className="text-xl font-semibold mb-6">Login</h2> */}

        {error && (
          <div className="mb-4 p-3 bg-status-error text-white rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label htmlFor="name" className="block mb-2 font-medium">
              Name or Phone Number
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray rounded focus:outline-none focus:border-black"
              placeholder="Enter your name or phone number"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block mb-2 font-medium">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="mt-4 text-center text-text-secondary">
          Don't have an account?{' '}
          <Link href="/signup" className="text-black underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
