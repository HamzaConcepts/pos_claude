'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProgressIndicator from '@/components/signup/ProgressIndicator'
import { Eye, EyeSlash, Users, Plus, Trash } from '@phosphor-icons/react'
import Logo from '@/components/Logo'

interface StaffCashier {
  tempId: string
  name: string
  phone: string
  commissionRate: number
}

interface Step1Data {
  storeName: string
  ownerName: string
}

interface Step2Data {
  email: string
  phoneNumber: string
  password: string
}

export default function SignupStep3() {
  const router = useRouter()
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null)
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [cashierAccount, setCashierAccount] = useState({
    accountName: '',
    accountPassword: '',
  })
  const [showAccountPassword, setShowAccountPassword] = useState(false)

  const [staffCashiers, setStaffCashiers] = useState<StaffCashier[]>([])

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState('')

  useEffect(() => {
    // Load Step 1 and Step 2 data
    const data1 = sessionStorage.getItem('signup_step1')
    const data2 = sessionStorage.getItem('signup_step2')

    if (!data1 || !data2) {
      // Missing required data, redirect back
      router.replace('/signup')
      return
    }

    try {
      const parsed1: Step1Data = JSON.parse(data1)
      const parsed2: Step2Data = JSON.parse(data2)

      setStep1Data(parsed1)
      setStep2Data(parsed2)

      // Prefill cashier account name
      setCashierAccount((prev) => ({
        ...prev,
        accountName: `${parsed1.storeName} Cashier`,
      }))
    } catch (e) {
      router.replace('/signup')
      return
    }

    setLoading(false)
  }, [router])

  const addCashier = () => {
    setStaffCashiers([
      ...staffCashiers,
      { tempId: crypto.randomUUID(), name: '', phone: '', commissionRate: 0 },
    ])
  }

  const removeCashier = (tempId: string) => {
    setStaffCashiers(staffCashiers.filter((c) => c.tempId !== tempId))
    if (errors.staffCashiers) {
      setErrors((prev) => ({ ...prev, staffCashiers: '' }))
    }
  }

  const updateCashier = (tempId: string, field: keyof StaffCashier, value: string | number) => {
    setStaffCashiers(
      staffCashiers.map((c) => {
        if (c.tempId === tempId) {
          if (field === 'phone') {
            // Only allow digits for phone
            return { ...c, [field]: String(value).replace(/\D/g, '').slice(0, 11) }
          }
          if (field === 'commissionRate') {
            // Ensure commission is between 0 and 100
            const numValue = Math.min(100, Math.max(0, Number(value) || 0))
            return { ...c, [field]: numValue }
          }
          return { ...c, [field]: value }
        }
        return c
      })
    )
    // Clear related error
    const errorKey = `cashier_${staffCashiers.findIndex((c) => c.tempId === tempId)}_${field}`
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: '' }))
    }
  }

  const handleAccountChange = (field: string, value: string) => {
    setCashierAccount((prev) => ({ ...prev, [field]: value }))
    // Clear related error
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Cashier account validation
    if (!cashierAccount.accountName.trim()) {
      newErrors.accountName = 'Account name is required'
    }

    if (!cashierAccount.accountPassword) {
      newErrors.accountPassword = 'Account password is required'
    } else if (cashierAccount.accountPassword.length < 6) {
      newErrors.accountPassword = 'Password must be at least 6 characters'
    }

    // Staff cashiers validation (optional — only validate populated entries)
    staffCashiers.forEach((cashier, idx) => {
      if (!cashier.name.trim()) {
        newErrors[`cashier_${idx}_name`] = 'Name required'
      }
      if (!cashier.phone) {
        newErrors[`cashier_${idx}_phone`] = 'Phone required'
      } else if (!/^[0-9]{11}$/.test(cashier.phone)) {
        newErrors[`cashier_${idx}_phone`] = '11 digits required'
      }
      if (cashier.commissionRate < 0 || cashier.commissionRate > 100) {
        newErrors[`cashier_${idx}_commissionRate`] = 'Must be 0-100'
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError('')

    if (!validateForm()) {
      return
    }

    if (!step1Data || !step2Data) {
      setGeneralError('Session data missing. Please start over.')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        // From Step 1
        storeName: step1Data.storeName,
        ownerName: step1Data.ownerName,
        // From Step 2
        email: step2Data.email,
        phoneNumber: step2Data.phoneNumber,
        password: step2Data.password,
        // From Step 3
        cashierAccount: {
          accountName: cashierAccount.accountName.trim(),
          accountPassword: cashierAccount.accountPassword,
        },
        staffCashiers: staffCashiers.map(({ tempId, ...rest }) => ({
          name: rest.name.trim(),
          phone: rest.phone,
          commissionRate: rest.commissionRate,
        })),
      }

      const response = await fetch('/api/auth/signup-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.errors) {
          // Field-specific errors
          setErrors(result.errors)
        } else {
          setGeneralError(result.error || 'Failed to create store. Please try again.')
        }
        setSubmitting(false)
        return
      }

      // Success! Clear session storage and redirect
      sessionStorage.removeItem('signup_step1')
      sessionStorage.removeItem('signup_step2')

      // Redirect based on approval status returned by API
      const query = new URLSearchParams()

      if (result.pending === true) {
        query.set('pending', 'true')
      }

      if (result?.data?.storeName) {
        query.set('name', result.data.storeName)
      }

      if (result?.data?.storeCode) {
        query.set('code', result.data.storeCode)
      }

      router.push(`/signup/success?${query.toString()}`)
    } catch (error) {
      console.error('Signup error:', error)
      setGeneralError('Network error. Please check your connection and try again.')
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    router.push('/signup/manager-account')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow-lg p-6 sm:p-8 max-w-2xl w-full">
        <ProgressIndicator currentStep={3} />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
            <Logo size={52} className="text-gray-900 dark:text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cashier Setup</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Step 3 of 3 - Setup cashier access &amp; staff</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Shared Cashier Account Section */}
          <div className="bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
            <h2 className="font-bold text-gray-900 dark:text-white mb-1">Shared Cashier Account</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              This is the login account your cashiers will use to access the POS
            </p>

            <div className="space-y-4">
              {/* Account Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Account Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={cashierAccount.accountName}
                  onChange={(e) => handleAccountChange('accountName', e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                    errors.accountName ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="e.g., Store Cashier"
                  maxLength={100}
                />
                {errors.accountName && (
                  <p className="text-red-600 text-xs mt-1">{errors.accountName}</p>
                )}
              </div>

              {/* Account Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Account Password <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showAccountPassword ? 'text' : 'password'}
                    value={cashierAccount.accountPassword}
                    onChange={(e) => handleAccountChange('accountPassword', e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 pr-10 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                      errors.accountPassword ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="Min 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccountPassword(!showAccountPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    {showAccountPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.accountPassword && (
                  <p className="text-red-600 text-xs mt-1">{errors.accountPassword}</p>
                )}
              </div>
            </div>
          </div>

          {/* Staff Cashiers Section */}
          <div className="bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
            <h2 className="font-bold text-gray-900 dark:text-white mb-1">Staff Members</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Add your cashier staff for performance tracking and commission calculation (optional, you can add them later)
            </p>

            <div className="space-y-3">
              {staffCashiers.map((cashier, idx) => (
                <div
                  key={cashier.tempId}
                  className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Cashier #{idx + 1}
                    </span>
            {staffCashiers.length > 0 && (
              <button
                type="button"
                onClick={() => removeCashier(cashier.tempId)}
                className="text-red-600 hover:text-red-800 p-1"
                title="Remove cashier"
              >
                <Trash size={18} />
              </button>
            )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={cashier.name}
                        onChange={(e) => updateCashier(cashier.tempId, 'name', e.target.value)}
                        className={`w-full border rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                          errors[`cashier_${idx}_name`] ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder="Full name"
                      />
                      {errors[`cashier_${idx}_name`] && (
                        <p className="text-red-600 text-xs mt-0.5">{errors[`cashier_${idx}_name`]}</p>
                      )}
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Phone <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={cashier.phone}
                        onChange={(e) => updateCashier(cashier.tempId, 'phone', e.target.value)}
                        className={`w-full border rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                          errors[`cashier_${idx}_phone`] ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder="03xxxxxxxxx"
                        maxLength={11}
                      />
                      {errors[`cashier_${idx}_phone`] && (
                        <p className="text-red-600 text-xs mt-0.5">{errors[`cashier_${idx}_phone`]}</p>
                      )}
                    </div>

                    {/* Commission Rate */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Commission %
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={cashier.commissionRate}
                          onChange={(e) =>
                            updateCashier(cashier.tempId, 'commissionRate', parseFloat(e.target.value) || 0)
                          }
                          className={`w-full border rounded px-2 py-1.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                            errors[`cashier_${idx}_commissionRate`] ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600'
                          }`}
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </div>
                      {errors[`cashier_${idx}_commissionRate`] && (
                        <p className="text-red-600 text-xs mt-0.5">
                          {errors[`cashier_${idx}_commissionRate`]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Cashier Button */}
            <button
              type="button"
              onClick={addCashier}
              className="w-full mt-3 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg py-2 text-cyan-600 font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={20} /> Add Another Cashier
            </button>

            {errors.staffCashiers && (
              <p className="text-red-600 text-sm mt-2">{errors.staffCashiers}</p>
            )}
          </div>

          {/* General Error */}
          {generalError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-400 rounded-lg p-4 mb-4">
              {generalError}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
              disabled={submitting}
            >
              ← Back
            </button>
            <button
              type="submit"
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Creating Store...
                </span>
              ) : (
                'Create Store ✓'
              )}
            </button>
          </div>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">
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
