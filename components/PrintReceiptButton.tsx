'use client'

import { useState } from 'react'
import { Printer, DownloadSimple, CircleNotch, CheckCircle } from '@phosphor-icons/react'
import type { ReceiptData, ReceiptFormat, ReceiptSettings } from '@/lib/types'
import {
  printPDFReceipt,
  downloadPDFReceipt,
  printThermalReceipt,
  saleToReceiptData,
  DEFAULT_RECEIPT_SETTINGS,
} from '@/lib/receipt-generator'
import { getStoreId } from '@/lib/supabase'
import { useDarkMode } from '@/hooks/useDarkMode'
import { getPKTNow } from '@/lib/date-utils'

interface PrintReceiptButtonProps {
  // Either provide sale object directly (for immediate printing after sale)
  sale?: any
  // Or provide saleId to fetch from API (for reprinting from sales history)
  saleId?: number
  // Optional: pre-loaded settings (to avoid extra API call)
  settings?: ReceiptSettings
  // Button style variant
  variant?: 'default' | 'icon' | 'small'
  // Callback after successful print
  onPrintComplete?: () => void
  // Custom class name
  className?: string
}

export default function PrintReceiptButton({
  sale,
  saleId,
  settings: propSettings,
  variant = 'default',
  onPrintComplete,
  className = '',
}: PrintReceiptButtonProps) {
  const isDarkMode = useDarkMode()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Fetch receipt data from API if saleId is provided
  const fetchReceiptData = async (): Promise<{ data: ReceiptData; settings: ReceiptSettings } | null> => {
    try {
      // Fetch currency from store info
      const storeId = getStoreId()
      let currency = 'PKR' // default
      
      try {
        const storeInfoResponse = await fetch(`/api/store-info?store_id=${storeId}`)
        const storeInfoResult = await storeInfoResponse.json()
        if (storeInfoResult.success && storeInfoResult.data.currency) {
          currency = storeInfoResult.data.currency
        }
      } catch (e) {
        console.warn('Failed to fetch currency, using PKR', e)
      }

      if (sale && propSettings) {
        // Use provided data directly
        return {
          data: saleToReceiptData(sale, propSettings, currency),
          settings: propSettings,
        }
      }

      if (sale) {
        // Have sale but need settings — fetch receipt settings and store logo
        const [settingsResponse, storeInfoResponse] = await Promise.all([
          fetch(`/api/receipt-settings?store_id=${storeId}`),
          fetch(`/api/store-info?store_id=${storeId}`),
        ])
        const settingsResult = await settingsResponse.json()
        const storeInfoResult = await storeInfoResponse.json()
        const storeLogo = storeInfoResult?.success ? storeInfoResult.data?.logo_url : null

        let settings: ReceiptSettings
        if (settingsResult.success) {
          // Merge with defaults to ensure no null/empty critical fields
          settings = {
            ...DEFAULT_RECEIPT_SETTINGS,
            ...settingsResult.data,
            business_name: settingsResult.data.business_name || DEFAULT_RECEIPT_SETTINGS.business_name,
            thank_you_message: settingsResult.data.thank_you_message || DEFAULT_RECEIPT_SETTINGS.thank_you_message,
            logo_url: settingsResult.data.logo_url || storeLogo,
          }
        } else {
          settings = {
            ...DEFAULT_RECEIPT_SETTINGS,
            id: 0,
            store_id: parseInt(String(storeId || '0')),
            logo_url: storeLogo,
            created_at: getPKTNow(),
            updated_at: getPKTNow(),
          }
        }

        return {
          data: saleToReceiptData(sale, settings, currency),
          settings,
        }
      }

      if (saleId) {
        // Fetch from API
        const response = await fetch(`/api/receipts/${saleId}`)
        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch receipt data')
        }

        return {
          data: result.data,
          settings: result.settings,
        }
      }

      throw new Error('No sale data provided')
    } catch (err: any) {
      console.error('Error fetching receipt data:', err)
      setError(err.message || 'Failed to load receipt')
      return null
    }
  }

  const handlePrint = async () => {
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const result = await fetchReceiptData()
      if (!result) {
        setLoading(false)
        return
      }

      const { data, settings } = result
      const printFormat: ReceiptFormat = settings.default_format || 'pdf'

      if (printFormat === 'pdf') {
        await printPDFReceipt(data)
      } else {
        printThermalReceipt(data, {
          paperWidth: settings.thermal_paper_width,
        })
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
      onPrintComplete?.()
    } catch (err: any) {
      console.error('Print error:', err)
      setError(err.message || 'Print failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    setLoading(true)
    setError('')

    try {
      const result = await fetchReceiptData()
      if (!result) {
        setLoading(false)
        return
      }

      await downloadPDFReceipt(result.data)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err: any) {
      console.error('Download error:', err)
      setError(err.message || 'Download failed')
    } finally {
      setLoading(false)
    }
  }

  // Icon-only button
  if (variant === 'icon') {
    return (
      <button
        onClick={() => handlePrint()}
        disabled={loading}
        className={`p-2 rounded-md transition-colors ${
          isDarkMode
            ? 'hover:bg-zinc-700 text-zinc-300'
            : 'hover:bg-gray-100 text-gray-700'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        title="Print Receipt"
      >
        {loading ? (
          <CircleNotch className="w-5 h-5 animate-spin" />
        ) : success ? (
          <CheckCircle className="w-5 h-5 text-green-500" weight="fill" />
        ) : (
          <Printer className="w-5 h-5" />
        )}
      </button>
    )
  }

  // Small button (for table rows)
  if (variant === 'small') {
    return (
      <button
        onClick={() => handlePrint()}
        disabled={loading}
        className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
          isDarkMode
            ? 'bg-zinc-700 hover:bg-zinc-600 text-white'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        {loading ? (
          <CircleNotch className="w-3 h-3 animate-spin" />
        ) : (
          <Printer className="w-3 h-3" />
        )}
        Print
      </button>
    )
  }

  // Default button with download option
  return (
    <div className="relative inline-flex gap-2">
      <button
        onClick={() => handlePrint()}
        disabled={loading}
        className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
          isDarkMode
            ? 'bg-white text-black hover:bg-zinc-200'
            : 'bg-black text-white hover:bg-gray-800'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        {loading ? (
          <CircleNotch className="w-4 h-4 animate-spin" />
        ) : success ? (
          <CheckCircle className="w-4 h-4" weight="fill" />
        ) : (
          <Printer className="w-4 h-4" />
        )}
        Print Receipt
      </button>
      <button
        onClick={handleDownload}
        disabled={loading}
        className={`px-3 py-2 rounded-md flex items-center gap-1.5 transition-colors text-sm ${
          isDarkMode
            ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        title="Download PDF"
      >
        <DownloadSimple className="w-4 h-4" />
      </button>

      {error && (
        <div className="absolute top-full left-0 mt-1 p-2 text-xs text-red-500 bg-red-50 rounded-md whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  )
}
