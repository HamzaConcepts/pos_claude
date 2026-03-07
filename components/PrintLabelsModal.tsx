'use client'

import { useState, useEffect } from 'react'
import { XIcon, PrinterIcon } from '@phosphor-icons/react'
import type { ProductWithBackwardCompatibility, ProductIMEI } from '@/lib/types'
import { getStoreId } from '@/lib/supabase'

interface PrintLabelsModalProps {
  product: ProductWithBackwardCompatibility
  onClose: () => void
}

export default function PrintLabelsModal({ product, onClose }: PrintLabelsModalProps) {
  const [labelTitle, setLabelTitle] = useState(product.name)
  const [showPrice, setShowPrice] = useState(true)
  const [quantity, setQuantity] = useState<number | ''>(product.stock_quantity || 1)
  const [printMode, setPrintMode] = useState<'individual' | 'grid'>('individual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [availableIMEIs, setAvailableIMEIs] = useState<ProductIMEI[]>([])
  const [loadingIMEIs, setLoadingIMEIs] = useState(false)

  // Fetch IMEIs if product is a phone
  useEffect(() => {
    if (product.is_phone) {
      fetchIMEIs()
    }
  }, [product.id, product.is_phone])

  const fetchIMEIs = async () => {
    setLoadingIMEIs(true)
    try {
      const storeId = getStoreId()
      if (!storeId) {
        setError('Store ID not found')
        return
      }

      const response = await fetch(`/api/imeis?product_id=${product.id}&store_id=${storeId}&status=in_stock`)
      const result = await response.json()

      if (result.success) {
        setAvailableIMEIs(result.data || [])
      } else {
        setError('Failed to fetch IMEIs')
      }
    } catch (err) {
      console.error('Error fetching IMEIs:', err)
      setError('Failed to fetch IMEIs')
    } finally {
      setLoadingIMEIs(false)
    }
  }

  const handlePrint = async () => {
    // Validation
    if (product.is_phone && availableIMEIs.length === 0) {
      setError('No IMEIs available for this product')
      return
    }

    if (!product.is_phone && (!quantity || quantity < 1)) {
      setError('Please enter a valid quantity (minimum 1)')
      return
    }

    if (product.stock_quantity === 0) {
      const confirmPrint = window.confirm('This product has zero stock. Do you still want to print labels?')
      if (!confirmPrint) return
    }

    setLoading(true)
    setError('')

    try {
      const storeId = getStoreId()
      if (!storeId) {
        setError('Store ID not found')
        return
      }

      const requestBody = {
        product_id: product.id,
        store_id: storeId,
        label_title: labelTitle.trim() || product.name,
        show_price: showPrice,
        quantity: product.is_phone ? availableIMEIs.length : Number(quantity),
        is_phone: product.is_phone,
      }

      // Fetch label data from API
      const response = await fetch('/api/print-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (result.success && result.labels) {
        // Generate PDF client-side
        await generateAndOpenPDF(result.labels, printMode)
        onClose()
      } else {
        setError(result.error || 'Failed to generate labels')
      }
    } catch (err) {
      console.error('Error printing labels:', err)
      setError('Failed to print labels. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const generateAndOpenPDF = async (labels: any[], mode: 'individual' | 'grid' = 'individual') => {
    // Dynamic import to avoid SSR issues
    const jsPDF = (await import('jspdf')).default
    const JsBarcode = (await import('jsbarcode')).default

    if (mode === 'grid') {
      // A4 Grid Mode
      await generateA4GridPDF(labels, jsPDF, JsBarcode)
    } else {
      // Individual Label Mode (Original)
      await generateIndividualLabelsPDF(labels, jsPDF, JsBarcode)
    }
  }

  const generateA4GridPDF = async (labels: any[], jsPDF: any, JsBarcode: any) => {
    // A4 dimensions in points (72 DPI): 595.28 x 841.89
    const pageWidth = 595.28
    const pageHeight = 841.89

    // Label dimensions (50mm x 25mm converted to points)
    const labelWidth = 50 * 2.83465 // ~141.73 points
    const labelHeight = 25 * 2.83465 // ~70.87 points

    // Grid configuration (4 columns x 11 rows)
    const cols = 4
    const rows = 11
    const marginX = (pageWidth - (cols * labelWidth)) / (cols + 1)
    const marginY = (pageHeight - (rows * labelHeight)) / (rows + 1)

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
    })

    let labelIndex = 0
    let pageIndex = 0

    while (labelIndex < labels.length) {
      if (pageIndex > 0) {
        doc.addPage()
      }

      // Draw grid of labels on current page
      for (let row = 0; row < rows && labelIndex < labels.length; row++) {
        for (let col = 0; col < cols && labelIndex < labels.length; col++) {
          const label = labels[labelIndex]
          const x = marginX + col * (labelWidth + marginX)
          const y = marginY + row * (labelHeight + marginY)

          await drawLabelAt(doc, label, x, y, labelWidth, labelHeight, JsBarcode)
          labelIndex++
        }
      }

      pageIndex++
    }

    // Open PDF in new tab
    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    window.open(pdfUrl, '_blank')
    
    // Clean up after 1 minute
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
  }

  const drawLabelAt = async (
    doc: any,
    label: any,
    x: number,
    y: number,
    width: number,
    height: number,
    JsBarcode: any
  ) => {
    try {
      // Generate barcode as data URL
      const canvas = document.createElement('canvas')
      
      JsBarcode(canvas, label.barcode, {
        format: 'CODE128',
        width: 1.5,
        height: 30,
        displayValue: false,
        margin: 0,
      })

      // Add label title
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      const titleWidth = doc.getTextWidth(label.title)
      const titleX = x + (width - titleWidth) / 2
      doc.text(label.title, titleX, y + 10)

      // Add price if enabled
      let currentY = y + 10
      if (label.price !== null && label.price !== undefined) {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        const priceText = `PKR ${Number(label.price).toFixed(2)}`
        const priceWidth = doc.getTextWidth(priceText)
        const priceX = x + (width - priceWidth) / 2
        currentY += 10
        doc.text(priceText, priceX, currentY)
      }

      // Add barcode image
      const barcodeDataURL = canvas.toDataURL('image/png')
      const barcodeY = currentY + 4
      const barcodeWidth = width - 10
      const barcodeHeight = 20
      doc.addImage(barcodeDataURL, 'PNG', x + 5, barcodeY, barcodeWidth, barcodeHeight)

      // Add human-readable barcode text
      doc.setFontSize(6)
      doc.setFont('courier', 'normal')
      const barcodeTextWidth = doc.getTextWidth(label.barcodeText)
      const barcodeTextX = x + (width - barcodeTextWidth) / 2
      const textY = barcodeY + barcodeHeight + 8
      doc.text(label.barcodeText, barcodeTextX, textY)

    } catch (error) {
      console.error('Error generating barcode for:', label.barcode, error)
      doc.setFontSize(6)
      doc.text('Barcode error', x + 5, y + height / 2)
    }
  }

  const generateIndividualLabelsPDF = async (labels: any[], jsPDF: any, JsBarcode: any) => {

    // Label dimensions (50mm x 25mm converted to points at 72 DPI)
    // 1mm = 2.83465 points
    const labelWidth = 50 * 2.83465 // ~141.73 points
    const labelHeight = 25 * 2.83465 // ~70.87 points

    // Create PDF with custom page size matching label size
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: [labelWidth, labelHeight],
    })

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i]
      
      if (i > 0) {
        doc.addPage()
      }

      // Generate barcode as data URL
      const canvas = document.createElement('canvas')
      
      try {
        JsBarcode(canvas, label.barcode, {
          format: 'CODE128',
          width: 2,
          height: 40,
          displayValue: false,
          margin: 0,
        })

        // Add label title
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        const titleWidth = doc.getTextWidth(label.title)
        const titleX = (labelWidth - titleWidth) / 2
        doc.text(label.title, titleX, 15)

        // Add price if enabled
        if (label.price !== null && label.price !== undefined) {
          doc.setFontSize(8)
          doc.setFont('helvetica', 'normal')
          const priceText = `PKR ${Number(label.price).toFixed(2)}`
          const priceWidth = doc.getTextWidth(priceText)
          const priceX = (labelWidth - priceWidth) / 2
          doc.text(priceText, priceX, 28)
        }

        // Add barcode image
        const barcodeDataURL = canvas.toDataURL('image/png')
        const barcodeY = (label.price !== null && label.price !== undefined) ? 32 : 22
        doc.addImage(barcodeDataURL, 'PNG', 10, barcodeY, labelWidth - 20, 25)

        // Add human-readable barcode text
        doc.setFontSize(7)
        doc.setFont('courier', 'normal')
        const barcodeTextWidth = doc.getTextWidth(label.barcodeText)
        const barcodeTextX = (labelWidth - barcodeTextWidth) / 2
        const textY = barcodeY + 30
        doc.text(label.barcodeText, barcodeTextX, textY)

      } catch (error) {
        console.error('Error generating barcode for:', label.barcode, error)
        // Add error message to label
        doc.setFontSize(8)
        doc.text('Barcode generation failed', 10, labelHeight / 2)
      }
    }

    // Open PDF in new tab
    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    window.open(pdfUrl, '_blank')
    
    // Clean up after 1 minute
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
  }

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 dark:bg-black/85"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div 
        className="w-full max-w-md p-6 rounded-lg shadow-lg bg-white text-black dark:bg-[#1a1a1a] dark:text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <PrinterIcon className="w-6 h-6" />
            <h2 className="text-xl font-bold">Print Product Labels</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-[#333] dark:hover:bg-gray-700"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Product Info */}
        <div 
          className="mb-4 p-3 rounded bg-gray-50 dark:bg-[#2a2a2a]"
        >
          <p className="text-sm opacity-70">Product</p>
          <p className="font-semibold">{product.name}</p>
          <p className="text-sm opacity-70">SKU: {product.sku}</p>
          {product.is_phone && (
            <p className="text-sm opacity-70 mt-1">
              📱 Phone Product (IMEI-based)
              {loadingIMEIs ? ' - Loading...' : ` - ${availableIMEIs.length} units available`}
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded">
            {error}
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4 mb-6">
          {/* Label Title */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Label Title
            </label>
            <input
              type="text"
              value={labelTitle}
              onChange={(e) => setLabelTitle(e.target.value)}
              placeholder="Enter label title"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 bg-white border-gray-300 dark:bg-[#2a2a2a] dark:border-[#444]"
            />
            <p className="text-xs opacity-60 mt-1">
              Defaults to product name if left empty
            </p>
          </div>

          {/* Show Price Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Show Price on Label</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
                className="sr-only peer"
              />
              <div 
                className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-black rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"
              ></div>
            </label>
          </div>

          {/* Print Mode Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Print Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="printMode"
                  value="individual"
                  checked={printMode === 'individual'}
                  onChange={(e) => setPrintMode('individual')}
                  className="w-4 h-4"
                />
                <div>
                  <div className="text-sm font-medium">Individual Labels</div>
                  <div className="text-xs opacity-60">One label per page (50mm x 25mm)</div>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="printMode"
                  value="grid"
                  checked={printMode === 'grid'}
                  onChange={(e) => setPrintMode('grid')}
                  className="w-4 h-4"
                />
                <div>
                  <div className="text-sm font-medium">A4 Grid Layout</div>
                  <div className="text-xs opacity-60">Multiple labels on A4 paper (4x11 grid)</div>
                </div>
              </label>
            </div>
          </div>

          {/* Quantity (only for non-phone products) */}
          {!product.is_phone && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Quantity <span className="opacity-60">(Number of labels to print)</span>
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value ? parseInt(e.target.value) : '')}
                placeholder="Enter quantity"
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 bg-white border-gray-300 dark:bg-[#2a2a2a] dark:border-[#444]"
              />
              <p className="text-xs opacity-60 mt-1">
                Current stock: {product.stock_quantity} units
              </p>
            </div>
          )}

          {/* IMEI Info for phone products */}
          {product.is_phone && (
            <div 
              className="p-3 rounded bg-blue-50 dark:bg-[#2a2a2a]"
            >
              <p className="text-sm font-medium mb-1">IMEI-Based Printing</p>
              <p className="text-xs opacity-70">
                {availableIMEIs.length > 0
                  ? `${availableIMEIs.length} label(s) will be printed (one per IMEI)`
                  : 'No IMEIs available. Please add IMEIs first.'}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-300 dark:border-[#444]"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            disabled={loading || (product.is_phone && availableIMEIs.length === 0)}
            className={`flex-1 px-4 py-2 rounded text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed ${loading ? 'bg-gray-500' : 'bg-black'}`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                Generating...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <PrinterIcon className="w-4 h-4" />
                Print Labels
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
