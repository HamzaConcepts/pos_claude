'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, HourglassIcon, Copy, Check } from '@phosphor-icons/react'

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const storeCode = searchParams.get('code')
  const storeName = searchParams.get('name')
  const displayStoreName = storeName || ''
  const isPending = searchParams.get('pending') === 'true'
  const [countdown, setCountdown] = useState(10)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!storeCode && !isPending) {
      router.replace('/signup')
      return
    }

    // Only auto-redirect for the legacy flow (store code present)
    if (storeCode && !isPending) {
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
    }
  }, [router, storeCode, isPending])

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

  if (!storeCode && !isPending) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Redirecting...</div>
      </div>
    )
  }

  // ── Pending approval view ────────────────────────────────
  if (isPending) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow-lg p-6 sm:p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full mb-6">
            <HourglassIcon size={48} weight="fill" className="text-amber-500" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Application Submitted!</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your store <span className="font-semibold text-gray-900 dark:text-white">{displayStoreName}</span> is pending approval.
          </p>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-2">What happens next?</h3>
            <ul className="text-sm text-amber-800 dark:text-amber-400 space-y-2">
              <li>⏳ Your application has been sent to the platform admin</li>
              <li>✉️ You will be notified by email once it has been reviewed</li>
              <li>✅ After approval, you can log in with your credentials</li>
              <li>❌ If denied, your account will be removed</li>
            </ul>
          </div>

          <div className="bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Account created for:</span> login will be available using the email address you registered with.
            </p>
          </div>

          <Link
            href="/login"
            className="inline-block w-full bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    )
  }

  // ── Legacy: store code view (kept for backward compatibility) ──
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow-lg p-6 sm:p-8 max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full mb-6">
          <CheckCircle size={48} weight="fill" className="text-green-600" />
        </div>

        <h1 className="text-3xl font-bold text-green-600 mb-2">Success!</h1>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Your store <span className="font-semibold">{displayStoreName}</span> has been created successfully.
        </p>

        <div className="bg-gray-50 dark:bg-[#111] border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Your Store Code</p>
          <div className="flex items-center justify-center gap-3">
            <p className="text-4xl font-bold text-cyan-600 tracking-widest">{storeCode}</p>
            <button
              onClick={handleCopyCode}
              className="p-2 text-gray-500 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors"
              title="Copy store code"
            >
              {copied ? (
                <Check size={24} className="text-green-600" />
              ) : (
                <Copy size={24} />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Share this code with your team members to let them join your store
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">What's Next?</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <li>✓ Your manager account is ready</li>
            <li>✓ Shared cashier account has been created</li>
            <li>✓ Staff members have been added</li>
          </ul>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-2">Login Credentials</h3>
          <div className="text-sm text-amber-800 dark:text-amber-400 space-y-1">
            <p><strong>Manager:</strong> Use your email to login</p>
            <p><strong>Cashiers:</strong> Use the shared cashier phone &amp; password</p>
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Redirecting to login in <span className="font-bold text-cyan-600">{countdown}</span> seconds...
        </p>

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
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
