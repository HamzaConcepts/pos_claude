'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Copy, Check } from '@phosphor-icons/react'

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeCode = searchParams.get('code')
  const storeName = searchParams.get('name')
  const [countdown, setCountdown] = useState(10)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!storeCode) {
      router.replace('/signup')
      return
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(timer)
          router.push('/login')
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [router, storeCode])

  const handleCopyCode = async () => {
    if (storeCode) {
      try {
        await navigator.clipboard.writeText(storeCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }

  if (!storeCode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Redirecting...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
          <CheckCircle size={48} weight="fill" className="text-green-600" />
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-bold text-green-600 mb-2">Success!</h1>
        <p className="text-gray-700 mb-6">
          Your store <span className="font-semibold">{storeName ? decodeURIComponent(storeName) : ''}</span> has been created successfully.
        </p>

        {/* Store Code Display */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 mb-6">
          <p className="text-sm text-gray-600 mb-2">Your Store Code</p>
          <div className="flex items-center justify-center gap-3">
            <p className="text-4xl font-bold text-cyan-600 tracking-widest">{storeCode}</p>
            <button
              onClick={handleCopyCode}
              className="p-2 text-gray-500 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
              title="Copy store code"
            >
              {copied ? (
                <Check size={24} className="text-green-600" />
              ) : (
                <Copy size={24} />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Share this code with your team members to let them join your store
          </p>
        </div>

        {/* Info Cards */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✓ Your manager account is ready</li>
            <li>✓ Shared cashier account has been created</li>
            <li>✓ Staff members have been added</li>
          </ul>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-amber-900 mb-2">Login Credentials</h3>
          <div className="text-sm text-amber-800 space-y-1">
            <p><strong>Manager:</strong> Use your email to login</p>
            <p><strong>Cashiers:</strong> Use the shared cashier phone & password</p>
          </div>
        </div>

        {/* Countdown */}
        <p className="text-gray-600 mb-4">
          Redirecting to login in <span className="font-bold text-cyan-600">{countdown}</span> seconds...
        </p>

        {/* Login Button */}
        <Link
          href="/login"
          className="inline-block w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Go to Login Now
        </Link>
      </div>
    </div>
  )
}

export default function SignupSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
