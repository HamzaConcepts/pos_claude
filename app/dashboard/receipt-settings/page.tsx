'use client'

import { useEffect, useState } from 'react'
import { Gear, FloppyDisk, CircleNotch, CheckCircle, Receipt, Printer, File } from '@phosphor-icons/react'
import { getStoreId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useDarkMode } from '@/hooks/useDarkMode'
import type { ReceiptSettings, ReceiptFormat, ThermalPaperWidth } from '@/lib/types'

export default function ReceiptSettingsPage() {
  const router = useRouter()
  const isDarkMode = useDarkMode()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isDefault, setIsDefault] = useState(true)

  const [settings, setSettings] = useState<Partial<ReceiptSettings>>({
    business_name: '',
    business_address: '',
    business_phone: '',
    business_email: '',
    tax_id: '',
    default_format: 'pdf',
    thermal_paper_width: '80mm',
    auto_print: false,
    show_logo: true,
    show_tax_id: true,
    thank_you_message: 'Thank you for your purchase!',
    return_policy: '',
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        router.push('/login')
        return
      }

      const response = await fetch(`/api/receipt-settings?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setSettings(result.data)
        setIsDefault(result.isDefault || false)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found')
        return
      }

      const response = await fetch('/api/receipt-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          store_id: storeId,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSaved(true)
        setIsDefault(false)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: keyof ReceiptSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${isDarkMode ? 'text-white' : ''}`}>
        <CircleNotch className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      <div className={`flex flex-col gap-4 ${isDarkMode ? 'text-white' : ''}`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Receipt className="w-6 h-6" weight="duotone" />
            <h1 className={`text-xl md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Receipt Settings
            </h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              isDarkMode
                ? 'bg-white text-black hover:bg-zinc-200'
                : 'bg-black text-white hover:bg-gray-800'
            } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {saving ? (
              <CircleNotch className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="w-4 h-4" weight="fill" />
            ) : (
              <FloppyDisk className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>

        {error && (
          <div className={`p-4 rounded-md mb-4 ${isDarkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'}`}>
            {error}
          </div>
        )}

        {isDefault && (
          <div className={`p-4 rounded-md mb-4 ${isDarkMode ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-50 text-yellow-700'}`}>
            Using default settings. Save to customize your receipts.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Business Information */}
          <div className={`p-5 rounded-lg ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
            <h2 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Business Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                  Business Name *
                </label>
                <input
                  type="text"
                  value={settings.business_name || ''}
                  onChange={(e) => handleChange('business_name', e.target.value)}
                  className={`w-full px-3 py-2 rounded-md border ${
                    isDarkMode
                      ? 'bg-zinc-900 border-zinc-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Your Store Name"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                  Business Address
                </label>
                <textarea
                  value={settings.business_address || ''}
                  onChange={(e) => handleChange('business_address', e.target.value)}
                  rows={2}
                  className={`w-full px-3 py-2 rounded-md border ${
                    isDarkMode
                      ? 'bg-zinc-900 border-zinc-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="123 Main Street, City, Country"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={settings.business_phone || ''}
                    onChange={(e) => handleChange('business_phone', e.target.value)}
                    className={`w-full px-3 py-2 rounded-md border ${
                      isDarkMode
                        ? 'bg-zinc-900 border-zinc-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="+92 300 1234567"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={settings.business_email || ''}
                    onChange={(e) => handleChange('business_email', e.target.value)}
                    className={`w-full px-3 py-2 rounded-md border ${
                      isDarkMode
                        ? 'bg-zinc-900 border-zinc-700 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    placeholder="store@example.com"
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                  Tax ID / NTN
                </label>
                <input
                  type="text"
                  value={settings.tax_id || ''}
                  onChange={(e) => handleChange('tax_id', e.target.value)}
                  className={`w-full px-3 py-2 rounded-md border ${
                    isDarkMode
                      ? 'bg-zinc-900 border-zinc-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="1234567-8"
                />
              </div>
            </div>
          </div>

          {/* Receipt Preferences */}
          <div className={`p-5 rounded-lg ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
            <h2 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Receipt Preferences
            </h2>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                  Default Receipt Format
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleChange('default_format', 'pdf')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md border transition-colors ${
                      settings.default_format === 'pdf'
                        ? isDarkMode
                          ? 'bg-white text-black border-white'
                          : 'bg-black text-white border-black'
                        : isDarkMode
                          ? 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <File className="w-5 h-5" />
                    PDF (A4)
                  </button>
                  <button
                    onClick={() => handleChange('default_format', 'thermal')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md border transition-colors ${
                      settings.default_format === 'thermal'
                        ? isDarkMode
                          ? 'bg-white text-black border-white'
                          : 'bg-black text-white border-black'
                        : isDarkMode
                          ? 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-zinc-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <Printer className="w-5 h-5" />
                    Thermal
                  </button>
                </div>
              </div>

              {settings.default_format === 'thermal' && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                    Thermal Paper Width
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleChange('thermal_paper_width', '80mm')}
                      className={`flex-1 px-4 py-2 rounded-md border transition-colors ${
                        settings.thermal_paper_width === '80mm'
                          ? isDarkMode
                            ? 'bg-cyan-600 text-white border-cyan-600'
                            : 'bg-cyan-600 text-white border-cyan-600'
                          : isDarkMode
                            ? 'bg-zinc-900 text-zinc-300 border-zinc-700'
                            : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      80mm (Standard)
                    </button>
                    <button
                      onClick={() => handleChange('thermal_paper_width', '58mm')}
                      className={`flex-1 px-4 py-2 rounded-md border transition-colors ${
                        settings.thermal_paper_width === '58mm'
                          ? isDarkMode
                            ? 'bg-cyan-600 text-white border-cyan-600'
                            : 'bg-cyan-600 text-white border-cyan-600'
                          : isDarkMode
                            ? 'bg-zinc-900 text-zinc-300 border-zinc-700'
                            : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      58mm (Compact)
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.show_tax_id || false}
                    onChange={(e) => handleChange('show_tax_id', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className={`text-sm ${isDarkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                    Show Tax ID on receipts
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.auto_print || false}
                    onChange={(e) => handleChange('auto_print', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className={`text-sm ${isDarkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                    Auto-print receipt after sale (requires printer setup)
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer Messages */}
          <div className={`p-5 rounded-lg lg:col-span-2 ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
            <h2 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Footer Messages
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                  Thank You Message
                </label>
                <input
                  type="text"
                  value={settings.thank_you_message || ''}
                  onChange={(e) => handleChange('thank_you_message', e.target.value)}
                  className={`w-full px-3 py-2 rounded-md border ${
                    isDarkMode
                      ? 'bg-zinc-900 border-zinc-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Thank you for your purchase!"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                  Return Policy (optional)
                </label>
                <input
                  type="text"
                  value={settings.return_policy || ''}
                  onChange={(e) => handleChange('return_policy', e.target.value)}
                  className={`w-full px-3 py-2 rounded-md border ${
                    isDarkMode
                      ? 'bg-zinc-900 border-zinc-700 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Returns accepted within 7 days with receipt"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
