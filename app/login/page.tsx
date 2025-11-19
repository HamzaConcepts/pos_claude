'use client'

import { useState } from 'react'
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
        // Create a session manually for cashier
        localStorage.setItem('user_session', JSON.stringify({
          id: cashier.id,
          role: 'Cashier',
          full_name: cashier.full_name,
          phone_number: cashier.phone_number,
        }))
        router.push('/dashboard/pos')
        return
      }

      // If not cashier, try manager login with Supabase Auth
      const { data: managerData, error: managerError } = await supabase
        .from('managers')
        .select('email, phone_number, full_name')
        .or(`full_name.ilike.%${name}%,phone_number.eq.${name}`)
        .maybeSingle()

      if (managerError || !managerData) {
        setError('User not found')
        setLoading(false)
        return
      }

      // Manager login with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: managerData.email,
        password,
      })

      if (error) throw error

      if (data.user) {
        router.push('/dashboard')
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
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
