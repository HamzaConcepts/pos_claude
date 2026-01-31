'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ProgressIndicator from '@/components/signup/ProgressIndicator'
import { Storefront } from '@phosphor-icons/react'

export default function SignupStep1() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    storeName: '',
    ownerName: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    checkExistingSession()
    
    // Load any saved data from previous visit
    const savedData = sessionStorage.getItem('signup_step1')
    if (savedData) {
      try {
        setFormData(JSON.parse(savedData))
      } catch (e) {
        // Ignore parse errors
      }
    }
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
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.storeName.trim()) {
      newErrors.storeName = 'Store name is required'
    } else if (formData.storeName.length > 100) {
      newErrors.storeName = 'Store name must be 100 characters or less'
    }

    if (!formData.ownerName.trim()) {
      newErrors.ownerName = 'Owner/Manager name is required'
    } else if (formData.ownerName.length > 100) {
      newErrors.ownerName = 'Name must be 100 characters or less'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    // Save to sessionStorage and navigate
    sessionStorage.setItem('signup_step1', JSON.stringify({
      storeName: formData.storeName.trim(),
      ownerName: formData.ownerName.trim(),
    }))
    
    router.push('/signup/manager-account')
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Checking session...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 max-w-md w-full">
        <ProgressIndicator currentStep={1} />
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-100 rounded-full mb-4">
            <Storefront size={32} className="text-cyan-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Your Store</h1>
          <p className="text-gray-600 mt-1">Step 1 of 3 - Store Information</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Store Name */}
          <div className="mb-4">
            <label htmlFor="storeName" className="block text-sm font-semibold text-gray-700 mb-2">
              Store Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              id="storeName"
              name="storeName"
              value={formData.storeName}
              onChange={handleChange}
              className={`w-full border rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors ${
                errors.storeName ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="e.g., Ahmad Electronics"
              maxLength={100}
              autoFocus
            />
            {errors.storeName && (
              <p className="text-red-600 text-sm mt-1">{errors.storeName}</p>
            )}
          </div>

          {/* Owner Name */}
          <div className="mb-6">
            <label htmlFor="ownerName" className="block text-sm font-semibold text-gray-700 mb-2">
              Owner/Manager Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              id="ownerName"
              name="ownerName"
              value={formData.ownerName}
              onChange={handleChange}
              className={`w-full border rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors ${
                errors.ownerName ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="e.g., Ahmad Khan"
              maxLength={100}
            />
            {errors.ownerName && (
              <p className="text-red-600 text-sm mt-1">{errors.ownerName}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
          >
            Continue →
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-cyan-600 hover:text-cyan-700 font-semibold">
              Sign in
            </Link>
          </p>
        </div>

        {/* Join Store Link */}
        <div className="mt-4 pt-4 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Want to join an existing store?{' '}
            <Link href="/signup/join" className="text-cyan-600 hover:text-cyan-700 font-medium">
              Join with store code
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}



