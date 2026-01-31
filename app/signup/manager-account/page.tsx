'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProgressIndicator from '@/components/signup/ProgressIndicator'
import { Eye, EyeSlash, User } from '@phosphor-icons/react'

export default function SignupStep2() {
  const router = useRouter()
  const [step1Data, setStep1Data] = useState<{ storeName: string; ownerName: string } | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [emailStatus, setEmailStatus] = useState<'checking' | 'available' | 'taken' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load Step 1 data
    const data1 = sessionStorage.getItem('signup_step1')
    if (!data1) {
      // No step 1 data, redirect back
      router.replace('/signup')
      return
    }

    try {
      setStep1Data(JSON.parse(data1))
    } catch (e) {
      router.replace('/signup')
      return
    }

    // Load any saved Step 2 data
    const data2 = sessionStorage.getItem('signup_step2')
    if (data2) {
      try {
        const parsed = JSON.parse(data2)
        setFormData(prev => ({
          ...prev,
          email: parsed.email || '',
          phoneNumber: parsed.phoneNumber || '',
          // Don't restore passwords for security
        }))
      } catch (e) {
        // Ignore parse errors
      }
    }

    setLoading(false)
  }, [router])

  // Debounced email check
  const checkEmailAvailability = useCallback(async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus(null)
      return
    }

    setEmailStatus('checking')
    
    try {
      const response = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`)
      const data = await response.json()
      setEmailStatus(data.available ? 'available' : 'taken')
    } catch (error) {
      console.error('Error checking email:', error)
      setEmailStatus(null)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.email) {
        checkEmailAvailability(formData.email)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [formData.email, checkEmailAvailability])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    
    // Special handling for phone number - only allow digits
    if (name === 'phoneNumber') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 11)
      setFormData(prev => ({ ...prev, [name]: digitsOnly }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }

    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const getPasswordStrength = (pass: string): { label: string; color: string; width: string } => {
    if (pass.length === 0) return { label: '', color: '', width: '0%' }
    if (pass.length < 6) return { label: 'Too short', color: 'bg-red-500', width: '20%' }
    if (pass.length < 8) return { label: 'Weak', color: 'bg-orange-500', width: '40%' }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pass)) return { label: 'Medium', color: 'bg-yellow-500', width: '60%' }
    if (pass.length >= 10 && /(?=.*[!@#$%^&*])/.test(pass)) return { label: 'Strong', color: 'bg-green-500', width: '100%' }
    return { label: 'Good', color: 'bg-green-400', width: '80%' }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    } else if (emailStatus === 'taken') {
      newErrors.email = 'This email is already registered'
    }

    // Phone validation
    if (!formData.phoneNumber) {
      newErrors.phoneNumber = 'Phone number is required'
    } else if (!/^[0-9]{11}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Phone number must be exactly 11 digits'
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number'
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    // Save to sessionStorage (don't save passwords)
    sessionStorage.setItem('signup_step2', JSON.stringify({
      email: formData.email.toLowerCase().trim(),
      phoneNumber: formData.phoneNumber,
      password: formData.password, // We need password for final submission
    }))
    
    router.push('/signup/cashier-setup')
  }

  const handleBack = () => {
    // Preserve current data before going back
    sessionStorage.setItem('signup_step2', JSON.stringify({
      email: formData.email,
      phoneNumber: formData.phoneNumber,
    }))
    router.push('/signup')
  }

  const passwordStrength = getPasswordStrength(formData.password)
  const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 max-w-md w-full">
        <ProgressIndicator currentStep={2} />
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-100 rounded-full mb-4">
            <User size={32} className="text-cyan-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Manager Account</h1>
          <p className="text-gray-600 mt-1">Step 2 of 3 - Account Credentials</p>
          {step1Data && (
            <p className="text-sm text-gray-500 mt-2">
              Creating account for: <span className="font-medium text-gray-700">{step1Data.ownerName}</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
              Email Address <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full border rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors ${
                errors.email ? 'border-red-500 bg-red-50' : emailStatus === 'taken' ? 'border-red-500' : emailStatus === 'available' ? 'border-green-500' : 'border-gray-300'
              }`}
              placeholder="manager@example.com"
              autoFocus
            />
            {emailStatus === 'checking' && (
              <p className="text-gray-500 text-sm mt-1">Checking availability...</p>
            )}
            {emailStatus === 'available' && (
              <p className="text-green-600 text-sm mt-1">✓ Email is available</p>
            )}
            {emailStatus === 'taken' && (
              <p className="text-red-600 text-sm mt-1">✗ Email is already registered</p>
            )}
            {errors.email && emailStatus !== 'taken' && (
              <p className="text-red-600 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Phone Number */}
          <div className="mb-4">
            <label htmlFor="phoneNumber" className="block text-sm font-semibold text-gray-700 mb-2">
              Phone Number <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              className={`w-full border rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors ${
                errors.phoneNumber ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="03001234567"
              maxLength={11}
            />
            <p className="text-gray-500 text-xs mt-1">{formData.phoneNumber.length}/11 digits</p>
            {errors.phoneNumber && (
              <p className="text-red-600 text-sm mt-1">{errors.phoneNumber}</p>
            )}
          </div>

          {/* Password */}
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
              Password <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full border rounded-lg px-4 py-3 pr-12 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors ${
                  errors.password ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Min 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {/* Password Strength Meter */}
            {formData.password && (
              <div className="mt-2">
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: passwordStrength.width }}
                  />
                </div>
                <p className={`text-xs mt-1 ${
                  passwordStrength.color.includes('red') ? 'text-red-600' : 
                  passwordStrength.color.includes('orange') ? 'text-orange-600' :
                  passwordStrength.color.includes('yellow') ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {passwordStrength.label}
                </p>
              </div>
            )}
            {errors.password && (
              <p className="text-red-600 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
              Confirm Password <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`w-full border rounded-lg px-4 py-3 pr-12 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors ${
                  errors.confirmPassword ? 'border-red-500 bg-red-50' : passwordsMatch ? 'border-green-500' : 'border-gray-300'
                }`}
                placeholder="Confirm your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {passwordsMatch && (
              <p className="text-green-600 text-sm mt-1">✓ Passwords match</p>
            )}
            {errors.confirmPassword && (
              <p className="text-red-600 text-sm mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              ← Back
            </button>
            <button
              type="submit"
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
            >
              Continue →
            </button>
          </div>
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
      </div>
    </div>
  )
}
