'use client'

import { useState, useRef, useEffect } from 'react'
import {
  PrinterIcon,
  FileIcon,
  DownloadSimpleIcon,
  CircleNotchIcon,
  CaretDownIcon,
  EyeIcon,
} from '@phosphor-icons/react'
import { getStoreId } from '@/lib/supabase'
import {
  generateQuotationPDF,
  printQuotationPDF,
  downloadQuotationPDF,
} from '@/lib/quotation-pdf-generator'
import type { QuotationPDFData, Quotation, QuotationItem } from '@/lib/types'

interface PrintQuotationButtonProps {
  quotation: Quotation
  items?: QuotationItem[]
  quotationId?: number
  variant?: 'default' | 'icon' | 'small'
  className?: string
}

export default function PrintQuotationButton({
  quotation,
  items,
  quotationId,
  variant = 'default',
  className = '',
}: PrintQuotationButtonProps) {
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  const fetchQuotationPDFData = async (): Promise<QuotationPDFData | null> => {
    try {
      const storeId = getStoreId()
      let storeName = 'Company'
      let storeAddress: string | null = null
      let storePhone: string | null = null
      let storeEmail: string | null = null
      let currency = 'PKR'
      let logoUrl: string | null = null

      // Fetch store info (includes address/phone/email from receipt_settings)
      try {
        const storeInfoResponse = await fetch(`/api/store-info?store_id=${storeId}`)
        const storeInfoResult = await storeInfoResponse.json()
        if (storeInfoResult.success && storeInfoResult.data) {
          storeName = storeInfoResult.data.store_name || 'Company'
          storeAddress = storeInfoResult.data.address || null
          storePhone = storeInfoResult.data.phone || null
          storeEmail = storeInfoResult.data.email || null
          currency = storeInfoResult.data.currency || 'PKR'
          logoUrl = storeInfoResult.data.logo_url || null
        }
      } catch (e) {
        console.warn('Failed to fetch store info, using defaults', e)
      }

      // If we have items already, use them; otherwise fetch the full quotation
      let resolvedQuotation = quotation
      let resolvedItems = items

      if (!resolvedItems || resolvedItems.length === 0) {
        const id = quotationId || quotation.id
        if (id) {
          const response = await fetch(`/api/quotations/${id}?store_id=${storeId}`)
          const result = await response.json()
          if (result.success && result.data) {
            resolvedQuotation = result.data
            resolvedItems = result.data.quotation_items || []
          }
        }
      }

      return {
        quotation: resolvedQuotation,
        items: resolvedItems || [],
        store_name: storeName,
        store_address: storeAddress,
        store_phone: storePhone,
        store_email: storeEmail,
        currency,
        logo_url: logoUrl,
      }
    } catch (err) {
      console.error('Error building PDF data:', err)
      return null
    }
  }

  const handleAction = async (action: 'view' | 'download' | 'print') => {
    try {
      setLoading(true)
      setShowDropdown(false)

      const pdfData = await fetchQuotationPDFData()
      if (!pdfData) {
        alert('Failed to prepare PDF data')
        return
      }

      switch (action) {
        case 'view':
          await printQuotationPDF(pdfData) // opens in new tab
          break
        case 'download':
          await downloadQuotationPDF(pdfData)
          break
        case 'print':
          await printQuotationPDF(pdfData)
          break
      }
    } catch (err) {
      console.error('PDF action error:', err)
      alert('Failed to generate PDF')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm ${className}`}>
        <CircleNotchIcon size={16} className="animate-spin" />
        {variant !== 'icon' && <span>Generating...</span>}
      </div>
    )
  }

  // Icon-only variant
  if (variant === 'icon') {
    return (
      <div ref={dropdownRef} className="relative inline-block">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          title="Print/Download PDF"
          className={`p-1.5 rounded hover:bg-opacity-10 transition-colors text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white ${className}`}
        >
          <PrinterIcon size={18} />
        </button>
        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border shadow-xl z-50 bg-white border-gray-200 dark:bg-[#2a2a2a] dark:border-gray-600">
            <button
              onClick={() => handleAction('view')}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 text-gray-700 dark:hover:bg-[#333] dark:text-gray-300"
            >
              <EyeIcon size={16} /> View PDF
            </button>
            <button
              onClick={() => handleAction('download')}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 text-gray-700 dark:hover:bg-[#333] dark:text-gray-300"
            >
              <DownloadSimpleIcon size={16} /> Download PDF
            </button>
            <button
              onClick={() => handleAction('print')}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 text-gray-700 dark:hover:bg-[#333] dark:text-gray-300"
            >
              <PrinterIcon size={16} /> Print
            </button>
          </div>
        )}
      </div>
    )
  }

  // Default / small variant with dropdown
  return (
    <div ref={dropdownRef} className="relative inline-block">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium transition-colors ${
          variant === 'small' ? 'px-2.5 py-1.5' : 'px-4 py-2'
        } border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-[#2a2a2a] ${className}`}
      >
        <PrinterIcon size={variant === 'small' ? 14 : 16} />
        {variant !== 'small' && 'PDF'}
        <CaretDownIcon size={12} />
      </button>
      {showDropdown && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border shadow-xl z-50 bg-white border-gray-200 dark:bg-[#2a2a2a] dark:border-gray-600">
          <button
            onClick={() => handleAction('view')}
            className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 rounded-t-lg hover:bg-gray-50 text-gray-700 dark:hover:bg-[#333] dark:text-gray-300"
          >
            <EyeIcon size={16} /> View PDF
          </button>
          <button
            onClick={() => handleAction('download')}
            className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50 text-gray-700 dark:hover:bg-[#333] dark:text-gray-300"
          >
            <DownloadSimpleIcon size={16} /> Download PDF
          </button>
          <button
            onClick={() => handleAction('print')}
            className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 rounded-b-lg hover:bg-gray-50 text-gray-700 dark:hover:bg-[#333] dark:text-gray-300"
          >
            <PrinterIcon size={16} /> Print
          </button>
        </div>
      )}
    </div>
  )
}
