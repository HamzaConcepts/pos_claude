'use client'

import { useState } from 'react'
import { Printer, File, DownloadSimple, CircleNotch, X, CheckCircle, CaretDown } from '@phosphor-icons/react'
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

interface PrintReceiptButtonProps {
  // Either provide sale object directly (for immediate printing after sale)
  sale?: any
  // Or provide saleId to fetch from API (for reprinting from sales history)
  saleId?: number
  // Optional: pre-loaded settings (to avoid extra API call)
  settings?: ReceiptSettings
  // Button style variant
  variant?: 'default' | 'icon' | 'small'
  // Whether to show dropdown for format selection
  showFormatOptions?: boolean
  // Default format to use
  defaultFormat?: ReceiptFormat
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
  showFormatOptions = false,
  defaultFormat = 'pdf',
  onPrintComplete,
  className = '',
}: PrintReceiptButtonProps) {
  const isDarkMode = useDarkMode()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<ReceiptFormat>(defaultFormat)

  // Fetch receipt data from API if saleId is provided
  const fetchReceiptData = async (): Promise<{ data: ReceiptData; settings: ReceiptSettings } | null> => {
    try {
      if (sale && propSettings) {
        // Use provided data directly
        return {
          data: saleToReceiptData(sale, propSettings),
          settings: propSettings,
        }
      }

      if (sale) {
        // Have sale but need settings
        const storeId = getStoreId()
        const settingsResponse = await fetch(`/api/receipt-settings?store_id=${storeId}`)
        const settingsResult = await settingsResponse.json()

        const settings: ReceiptSettings = settingsResult.success
          ? settingsResult.data
          : {
              ...DEFAULT_RECEIPT_SETTINGS,
              id: 0,
              store_id: parseInt(String(storeId || '0')),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }

        return {
          data: saleToReceiptData(sale, settings),
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

  const handlePrint = async (format?: ReceiptFormat) => {
    const printFormat = format || selectedFormat
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const result = await fetchReceiptData()
      if (!result) {
        setLoading(false)
        return
      }

      const { data } = result

      if (printFormat === 'pdf') {
        printPDFReceipt(data)
      } else {
        printThermalReceipt(data, {
          paperWidth: data.settings.thermal_paper_width,
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
      setShowDropdown(false)
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

      downloadPDFReceipt(result.data)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err: any) {
      console.error('Download error:', err)
      setError(err.message || 'Download failed')
    } finally {
      setLoading(false)
      setShowDropdown(false)
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

  // Default button with optional dropdown
  return (
    <div className="relative inline-block">
      {showFormatOptions ? (
        <>
          <div className="flex">
            <button
              onClick={() => handlePrint()}
              disabled={loading}
              className={`px-4 py-2 rounded-l-md flex items-center gap-2 transition-colors ${
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
              Print {selectedFormat === 'pdf' ? 'PDF' : 'Thermal'}
            </button>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              disabled={loading}
              className={`px-2 py-2 rounded-r-md border-l transition-colors ${
                isDarkMode
                  ? 'bg-white text-black hover:bg-zinc-200 border-zinc-300'
                  : 'bg-black text-white hover:bg-gray-800 border-gray-700'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Print options"
              aria-label="Print options dropdown"
            >
              <CaretDown className="w-4 h-4" />
            </button>
          </div>

          {showDropdown && (
            <div
              className={`absolute top-full right-0 mt-1 w-48 rounded-md shadow-lg z-50 ${
                isDarkMode ? 'bg-zinc-800 border border-zinc-700' : 'bg-white border border-gray-200'
              }`}
            >
              <div className="py-1">
                <button
                  onClick={() => {
                    setSelectedFormat('pdf')
                    handlePrint('pdf')
                  }}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                    isDarkMode ? 'hover:bg-zinc-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <File className="w-4 h-4" />
                  Print as PDF (A4)
                </button>
                <button
                  onClick={() => {
                    setSelectedFormat('thermal')
                    handlePrint('thermal')
                  }}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                    isDarkMode ? 'hover:bg-zinc-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  Print Thermal (80mm)
                </button>
                <div className={`border-t my-1 ${isDarkMode ? 'border-zinc-700' : 'border-gray-200'}`} />
                <button
                  onClick={handleDownload}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                    isDarkMode ? 'hover:bg-zinc-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <DownloadSimple className="w-4 h-4" />
                  Download PDF
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
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
      )}

      {error && (
        <div className="absolute top-full left-0 mt-1 p-2 text-xs text-red-500 bg-red-50 rounded-md whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  )
}
