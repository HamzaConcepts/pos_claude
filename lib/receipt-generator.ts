import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ReceiptData, ReceiptSettings } from './types'

// Default settings when none exist in database
export const DEFAULT_RECEIPT_SETTINGS: Omit<ReceiptSettings, 'id' | 'store_id' | 'created_at' | 'updated_at'> = {
  business_name: 'POS System',
  business_address: null,
  business_phone: null,
  business_email: null,
  tax_id: null,
  logo_url: null,
  default_format: 'pdf',
  thermal_paper_width: '80mm',
  auto_print: false,
  show_logo: true,
  show_tax_id: true,
  thank_you_message: 'Thank you for your purchase!',
  return_policy: null,
}

/**
 * Format currency with custom currency symbol
 */
function formatCurrency(amount: number, currency: string = 'PKR', decimals: number = 2): string {
  return `${currency} ${amount.toFixed(decimals)}`
}

/**
 * Format date for receipt display in PKT timezone
 */
function formatDate(dateString: string, format: 'full' | 'short' = 'full'): string {
  const date = new Date(dateString)
  if (format === 'short') {
    return date.toLocaleString('en-PK', {
      timeZone: 'Asia/Karachi',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }
  return date.toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

/**
 * Calculate subtotal before discount
 */
function calculateSubtotal(data: ReceiptData): number {
  if (data.discount_type === 'none' || data.discount_value === 0) {
    return data.total_amount
  }
  if (data.discount_type === 'percentage') {
    return data.total_amount / (1 - data.discount_value / 100)
  }
  // Amount discount
  return data.total_amount + data.discount_value
}

/**
 * Calculate discount amount
 */
function calculateDiscountAmount(data: ReceiptData): number {
  if (data.discount_type === 'none' || data.discount_value === 0) {
    return 0
  }
  const subtotal = calculateSubtotal(data)
  if (data.discount_type === 'percentage') {
    return subtotal * (data.discount_value / 100)
  }
  return data.discount_value
}

/**
 * Load image from URL and return as base64 data URL for jsPDF
 */
async function loadImageAsBase64(url: string): Promise<{ base64: string; width: number; height: number } | null> {
  try {
    return await new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0)
        const base64 = canvas.toDataURL('image/png')
        resolve({ base64, width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = () => {
        console.warn('Failed to load logo image:', url)
        resolve(null)
      }
      img.src = url
    })
  } catch {
    return null
  }
}

// ===== PDF RECEIPT GENERATION (A4 Format) =====

export async function generatePDFReceipt(data: ReceiptData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const settings = data.settings
  const currency = data.currency || 'PKR'
  const pageWidth = doc.internal.pageSize.getWidth() // 210mm
  const pageHeight = doc.internal.pageSize.getHeight() // 297mm
  const marginLeft = 15
  const marginRight = 15
  const contentWidth = pageWidth - marginLeft - marginRight
  let yPos = 15

  // ===== TWO-COLUMN HEADER =====
  // Left: Logo + Business Name | Right: Contact details
  const headerLeftWidth = contentWidth * 0.5
  const headerRightX = marginLeft + contentWidth * 0.55

  let logoLoaded = false
  if (settings.show_logo && settings.logo_url) {
    const logoData = await loadImageAsBase64(settings.logo_url)
    if (logoData) {
      const maxLogoHeight = 18
      const maxLogoWidth = 40
      const aspectRatio = logoData.width / logoData.height
      let logoWidth = maxLogoHeight * aspectRatio
      let logoHeight = maxLogoHeight
      if (logoWidth > maxLogoWidth) {
        logoWidth = maxLogoWidth
        logoHeight = maxLogoWidth / aspectRatio
      }
      doc.addImage(logoData.base64, 'PNG', marginLeft, yPos, logoWidth, logoHeight)
      // Business name next to logo
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text(settings.business_name, marginLeft + logoWidth + 4, yPos + logoHeight / 2 + 2)
      logoLoaded = true
    }
  }

  if (!logoLoaded) {
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(settings.business_name, marginLeft, yPos + 6)
  }

  // Right column: contact info, right-aligned
  let rightY = yPos + 2
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  if (settings.business_address) {
    const addrLines = doc.splitTextToSize(settings.business_address, contentWidth * 0.4)
    doc.text(addrLines, pageWidth - marginRight, rightY, { align: 'right' })
    rightY += addrLines.length * 3.5
  }
  if (settings.business_phone) {
    doc.text(`Tel: ${settings.business_phone}`, pageWidth - marginRight, rightY, { align: 'right' })
    rightY += 3.5
  }
  if (settings.business_email) {
    doc.text(settings.business_email, pageWidth - marginRight, rightY, { align: 'right' })
    rightY += 3.5
  }
  if (settings.show_tax_id && settings.tax_id) {
    doc.text(`Tax ID: ${settings.tax_id}`, pageWidth - marginRight, rightY, { align: 'right' })
    rightY += 3.5
  }

  yPos = Math.max(yPos + 22, rightY + 4)

  // ===== DARK TITLE BAR =====
  doc.setFillColor(30, 30, 30)
  doc.rect(marginLeft, yPos, contentWidth, 10, 'F')
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('SALES RECEIPT', pageWidth / 2, yPos + 7, { align: 'center' })
  doc.setTextColor(0, 0, 0)
  yPos += 14

  // ===== METADATA GRID (2×3) =====
  doc.setFontSize(9)
  const col1X = marginLeft
  const col2X = marginLeft + contentWidth / 3
  const col3X = marginLeft + (contentWidth * 2) / 3

  // Row 1
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text('Receipt #', col1X, yPos)
  doc.text('Date', col2X, yPos)
  doc.text('Cashier', col3X, yPos)
  yPos += 4
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(data.sale_number, col1X, yPos)
  doc.text(formatDate(data.sale_date, 'short'), col2X, yPos)
  doc.text(data.cashier_name || 'Unknown', col3X, yPos)
  yPos += 6

  // Row 2
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text('Payment Method', col1X, yPos)
  doc.text('Payment Status', col2X, yPos)
  yPos += 4
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(data.payment_method, col1X, yPos)
  if (data.payment_status === 'Partial') {
    doc.setTextColor(211, 47, 47)
    doc.text('PARTIAL PAYMENT', col2X, yPos)
    doc.setTextColor(0, 0, 0)
  } else {
    doc.text(data.payment_status, col2X, yPos)
  }
  yPos += 7

  // Separator
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos)
  yPos += 5

  // ===== CUSTOMER INFO (if present) =====
  if (data.customer_name || data.customer_phone) {
    doc.setFillColor(248, 248, 248)
    const custBoxHeight = 6 + (data.customer_name ? 5 : 0) + (data.customer_phone ? 5 : 0) + ((data as any).customer_cnic ? 5 : 0)
    doc.rect(marginLeft, yPos, contentWidth, custBoxHeight, 'F')
    yPos += 4
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('CUSTOMER', marginLeft + 3, yPos)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    if (data.customer_name) {
      doc.text(`Name: ${data.customer_name}`, marginLeft + 3, yPos)
      yPos += 4
    }
    if (data.customer_phone) {
      doc.text(`Phone: ${data.customer_phone}`, marginLeft + 3, yPos)
      yPos += 4
    }
    if ((data as any).customer_cnic) {
      doc.text(`CNIC: ${(data as any).customer_cnic}`, marginLeft + 3, yPos)
      yPos += 4
    }
    yPos += 4
  }

  // ===== PARTIAL PAYMENT CUSTOMER (if present) =====
  if (data.partial_customer) {
    doc.setFillColor(255, 235, 235)
    doc.setDrawColor(211, 47, 47)
    doc.setLineWidth(0.5)
    doc.rect(marginLeft, yPos, contentWidth, 22, 'FD')
    yPos += 5
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(211, 47, 47)
    doc.text('PARTIAL PAYMENT - CREDIT SALE', marginLeft + 3, yPos)
    doc.setTextColor(0, 0, 0)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Customer: ${data.partial_customer.name}`, marginLeft + 3, yPos)
    doc.text(`Phone: ${data.partial_customer.phone}`, marginLeft + contentWidth / 2, yPos)
    yPos += 5
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(211, 47, 47)
    doc.text(`Amount Due: ${formatCurrency(data.partial_customer.amount_remaining, currency)}`, marginLeft + 3, yPos)
    doc.setTextColor(0, 0, 0)
    yPos += 8
  }

  // ===== ITEMS TABLE (5 columns: #, Description, Qty, Unit Price, Amount) =====
  const tableData = data.items.map((item, idx) => [
    (idx + 1).toString(),
    item.name,
    item.quantity.toString(),
    formatCurrency(item.unit_price, currency),
    formatCurrency(item.subtotal, currency),
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Item Description', 'Qty', 'Unit Price', 'Amount']],
    body: tableData,
    margin: { left: marginLeft, right: marginRight },
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 32, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    styles: {
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
    },
  })

  yPos = (doc as any).lastAutoTable.finalY + 8

  // ===== TOTALS SUMMARY BOX (right-aligned) =====
  const totalsBoxWidth = 85
  const totalsX = pageWidth - marginRight - totalsBoxWidth

  const hasDiscount = data.discount_type !== 'none' && data.discount_value > 0

  // Background box
  let totalsBoxHeight = 30 // base: Total + Paid + Change/Due
  if (hasDiscount) totalsBoxHeight += 12
  if (data.payment_status === 'Partial') totalsBoxHeight += 2

  doc.setFillColor(248, 248, 248)
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.rect(totalsX, yPos, totalsBoxWidth, totalsBoxHeight, 'FD')

  let tY = yPos + 5
  doc.setFontSize(9)

  // Subtotal (if discount applied)
  if (hasDiscount) {
    const subtotal = calculateSubtotal(data)
    doc.setFont('helvetica', 'normal')
    doc.text('Subtotal:', totalsX + 3, tY)
    doc.text(formatCurrency(subtotal, currency), totalsX + totalsBoxWidth - 3, tY, { align: 'right' })
    tY += 5

    doc.setTextColor(211, 47, 47)
    const discountLabel = data.discount_type === 'percentage'
      ? `Discount (${data.discount_value}%):`
      : 'Discount:'
    doc.text(discountLabel, totalsX + 3, tY)
    doc.text(`-${formatCurrency(calculateDiscountAmount(data), currency)}`, totalsX + totalsBoxWidth - 3, tY, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    tY += 6

    // Inner separator
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.2)
    doc.line(totalsX + 3, tY, totalsX + totalsBoxWidth - 3, tY)
    tY += 4
  }

  // Total
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL:', totalsX + 3, tY)
  doc.text(formatCurrency(data.total_amount, currency), totalsX + totalsBoxWidth - 3, tY, { align: 'right' })
  tY += 6

  // Amount Paid
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Amount Paid:', totalsX + 3, tY)
  doc.text(formatCurrency(data.amount_paid, currency), totalsX + totalsBoxWidth - 3, tY, { align: 'right' })
  tY += 5

  // Change or Amount Due
  if (data.payment_status === 'Partial') {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(211, 47, 47)
    doc.text('Amount Due:', totalsX + 3, tY)
    doc.text(formatCurrency(data.amount_due, currency), totalsX + totalsBoxWidth - 3, tY, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  } else {
    doc.text('Change:', totalsX + 3, tY)
    doc.text(formatCurrency(data.change_given, currency), totalsX + totalsBoxWidth - 3, tY, { align: 'right' })
  }

  yPos += totalsBoxHeight + 10

  // ===== FOOTER SECTION =====
  doc.setDrawColor(30, 30, 30)
  doc.setLineWidth(0.3)
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos)
  yPos += 6

  // Thank you message
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(settings.thank_you_message, pageWidth / 2, yPos, { align: 'center' })
  yPos += 6

  // Return policy
  if (settings.return_policy) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(102, 102, 102)
    const policyLines = doc.splitTextToSize(settings.return_policy, contentWidth)
    doc.text(policyLines, pageWidth / 2, yPos, { align: 'center' })
    yPos += policyLines.length * 3.5 + 4
    doc.setTextColor(0, 0, 0)
  }

  // Generated timestamp (bottom-right)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(150, 150, 150)
  doc.text(
    `Generated: ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' })}`,
    pageWidth - marginRight, pageHeight - 10, { align: 'right' }
  )
  doc.setTextColor(0, 0, 0)

  return doc
}

// ===== THERMAL RECEIPT GENERATION =====

export interface ThermalReceiptOptions {
  paperWidth: '58mm' | '80mm'
}

/**
 * Generate thermal receipt HTML for printing via browser
 * The thermal receipt is designed for 58mm or 80mm thermal paper
 */
export function generateThermalReceiptHTML(data: ReceiptData, options?: ThermalReceiptOptions): string {
  const settings = data.settings
  const currency = data.currency || 'PKR'
  const paperWidth = options?.paperWidth || settings.thermal_paper_width || '80mm'
  const maxChars = paperWidth === '80mm' ? 48 : 32
  const receiptWidth = paperWidth === '80mm' ? '302px' : '219px' // Approximate pixel width

  const hasDiscount = data.discount_type !== 'none' && data.discount_value > 0
  const subtotal = hasDiscount ? calculateSubtotal(data) : data.total_amount
  const discountAmount = calculateDiscountAmount(data)

  // Build items HTML
  const itemsHTML = data.items.map(item => `
    <tr>
      <td style="padding: 2px 0; vertical-align: top;">
        <div style="font-size: 11px; max-width: ${paperWidth === '80mm' ? '180px' : '120px'}; word-wrap: break-word;">
          ${escapeHTML(item.name)}
        </div>
        <div style="font-size: 10px; color: #666;">
          ${item.quantity} × ${currency} ${item.unit_price.toFixed(0)}
        </div>
      </td>
      <td style="padding: 2px 0; text-align: right; vertical-align: top; font-weight: bold; font-size: 11px;">
        ${item.subtotal.toFixed(0)}
      </td>
    </tr>
  `).join('')

  // Customer info section
  let customerHTML = ''
  if (data.customer_name || data.customer_phone) {
    customerHTML = `
      <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="font-weight: bold; font-size: 10px;">Customer:</div>
        ${data.customer_name ? `<div style="font-size: 10px;">${escapeHTML(data.customer_name)}</div>` : ''}
        ${data.customer_phone ? `<div style="font-size: 10px;">Ph: ${escapeHTML(data.customer_phone)}</div>` : ''}
      </div>
    `
  }

  // Partial payment customer section
  let partialCustomerHTML = ''
  if (data.partial_customer) {
    partialCustomerHTML = `
      <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <div style="font-weight: bold; font-size: 10px;">⚠ CREDIT SALE:</div>
        <div style="font-size: 10px;">${escapeHTML(data.partial_customer.name)}</div>
        <div style="font-size: 10px;">Ph: ${escapeHTML(data.partial_customer.phone)}</div>
        <div style="font-weight: bold; font-size: 10px;">Due: ${currency} ${data.partial_customer.amount_remaining.toFixed(0)}</div>
      </div>
    `
  }

  // Discount section
  let discountHTML = ''
  if (hasDiscount) {
    discountHTML = `
      <tr>
        <td style="padding: 2px 0; font-size: 10px;">Subtotal:</td>
        <td style="padding: 2px 0; text-align: right; font-size: 10px;">${currency} ${subtotal.toFixed(0)}</td>
      </tr>
      <tr>
        <td style="padding: 2px 0; font-size: 10px;">Discount:</td>
        <td style="padding: 2px 0; text-align: right; font-size: 10px;">-${discountAmount.toFixed(0)}</td>
      </tr>
    `
  }

  // Amount due or change
  let finalAmountHTML = ''
  if (data.payment_status === 'Partial') {
    finalAmountHTML = `
      <tr style="font-weight: bold;">
        <td style="padding: 2px 0; font-size: 10px;">DUE:</td>
        <td style="padding: 2px 0; text-align: right; font-size: 10px;">${currency} ${data.amount_due.toFixed(0)}</td>
      </tr>
    `
  } else {
    finalAmountHTML = `
      <tr>
        <td style="padding: 2px 0; font-size: 10px;">Change:</td>
        <td style="padding: 2px 0; text-align: right; font-size: 10px;">${currency} ${data.change_given.toFixed(0)}</td>
      </tr>
    `
  }

  // Logo HTML for thermal
  let logoHTML = ''
  if (settings.show_logo && settings.logo_url) {
    const logoMaxWidth = paperWidth === '80mm' ? '100px' : '70px'
    logoHTML = `<div style="text-align: center; margin-bottom: 4px;">
      <img src="${escapeHTML(settings.logo_url)}" alt="Logo" style="max-width: ${logoMaxWidth}; max-height: 40px; object-fit: contain;" onerror="this.style.display='none'" />
    </div>`
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${data.sale_number}</title>
  <style>
    @media print {
      @page {
        size: ${paperWidth} auto;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 0;
      }
    }
    body {
      font-family: 'Courier New', monospace;
      width: ${receiptWidth};
      margin: 0 auto;
      padding: 6px;
      background: white;
      color: black;
      overflow-wrap: break-word;
      word-wrap: break-word;
    }
    .receipt {
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Header -->
    <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
      ${logoHTML}
      <div style="font-weight: bold; font-size: 13px; letter-spacing: 1px;">${escapeHTML(settings.business_name)}</div>
      ${settings.business_address ? `<div style="font-size: 10px; margin-top: 2px;">${escapeHTML(settings.business_address)}</div>` : ''}
      ${settings.business_phone ? `<div style="font-size: 10px;">Tel: ${escapeHTML(settings.business_phone)}</div>` : ''}
      ${settings.business_email ? `<div style="font-size: 9px;">${escapeHTML(settings.business_email)}</div>` : ''}
      ${settings.show_tax_id && settings.tax_id ? `<div style="font-size: 9px; margin-top: 2px;">Tax ID: ${escapeHTML(settings.tax_id)}</div>` : ''}
    </div>

    <!-- Receipt Title -->
    <div style="text-align: center; font-weight: bold; font-size: 12px; letter-spacing: 2px; margin-bottom: 6px;">SALES RECEIPT</div>

    <!-- Sale Info -->
    <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
      <table style="width: 100%; font-size: 10px;">
        <tr>
          <td>Sale#:</td>
          <td style="text-align: right; font-weight: bold;">${escapeHTML(data.sale_number)}</td>
        </tr>
        <tr>
          <td>Date:</td>
          <td style="text-align: right;">${formatDate(data.sale_date, 'short')}</td>
        </tr>
        <tr>
          <td>Cashier:</td>
          <td style="text-align: right;">${escapeHTML(data.cashier_name || '-')}</td>
        </tr>
        <tr>
          <td>Payment:</td>
          <td style="text-align: right;">${data.payment_method}</td>
        </tr>
        ${data.payment_status === 'Partial' ? `
        <tr style="font-weight: bold;">
          <td>Status:</td>
          <td style="text-align: right;">PARTIAL ⚠</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <!-- Customer Info -->
    ${customerHTML}

    <!-- Partial Payment Customer -->
    ${partialCustomerHTML}

    <!-- Items -->
    <div style="border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
      <table style="width: 100%;">
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th style="text-align: left; padding: 4px 0; font-size: 10px;">Item</th>
            <th style="text-align: right; padding: 4px 0; font-size: 10px;">Amt</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <table style="width: 100%;">
      <tbody>
        ${discountHTML}
        <tr style="font-weight: bold; font-size: 12px; border-top: 1px solid #000;">
          <td style="padding: 4px 0;">TOTAL:</td>
          <td style="padding: 4px 0; text-align: right;">${currency} ${data.total_amount.toFixed(0)}</td>
        </tr>
        <tr>
          <td style="padding: 2px 0; font-size: 10px;">Paid:</td>
          <td style="padding: 2px 0; text-align: right; font-size: 10px;">${currency} ${data.amount_paid.toFixed(0)}</td>
        </tr>
        ${finalAmountHTML}
      </tbody>
    </table>

    ${data.payment_status === 'Partial' ? `
    <div style="margin-top: 8px; padding: 4px; background: #000; color: #fff; text-align: center; font-weight: bold; font-size: 10px;">
      ⚠ AMOUNT DUE ⚠
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="text-align: center; margin-top: 12px; padding-top: 8px; border-top: 1px dashed #000;">
      <div style="font-weight: bold; font-size: 11px;">${escapeHTML(settings.thank_you_message)}</div>
      ${settings.return_policy ? `<div style="font-size: 8px; margin-top: 4px; color: #666;">${escapeHTML(settings.return_policy)}</div>` : ''}
      <div style="font-size: 8px; margin-top: 8px;">${new Date().toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}</div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Escape HTML special characters
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ===== UTILITY FUNCTIONS =====

/**
 * Open PDF in new window for printing
 */
export async function printPDFReceipt(data: ReceiptData): Promise<void> {
  const doc = await generatePDFReceipt(data)
  const pdfBlob = doc.output('blob')
  const pdfUrl = URL.createObjectURL(pdfBlob)
  
  const printWindow = window.open(pdfUrl, '_blank')
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}

/**
 * Download PDF receipt
 */
export async function downloadPDFReceipt(data: ReceiptData): Promise<void> {
  const doc = await generatePDFReceipt(data)
  doc.save(`receipt-${data.sale_number}.pdf`)
}

/**
 * Print thermal receipt by opening in new window
 */
export function printThermalReceipt(data: ReceiptData, options?: ThermalReceiptOptions): void {
  const html = generateThermalReceiptHTML(data, options)
  const printWindow = window.open('', '_blank', 'width=400,height=600')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}

/**
 * Convert sale data from API to ReceiptData format
 */
export function saleToReceiptData(sale: any, settings: ReceiptSettings, currency: string = 'PKR'): ReceiptData {
  const items = (sale.sale_items || []).map((item: any) => ({
    name: item.product_name || item.products?.name || 'Unknown Item',
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.subtotal,
  }))

  const partialCustomer = sale.partial_payment_customers?.[0]

  return {
    sale_number: sale.sale_number,
    sale_date: sale.sale_date,
    cashier_name: sale.cashier_name || null,
    payment_method: sale.payment_method,
    payment_status: sale.payment_status,
    currency,
    subtotal: items.reduce((sum: number, item: any) => sum + item.subtotal, 0),
    discount_type: sale.discount_type || 'none',
    discount_value: sale.discount_value || 0,
    total_amount: sale.total_amount,
    amount_paid: sale.amount_paid,
    amount_due: sale.amount_due || 0,
    change_given: Math.max(0, sale.amount_paid - sale.total_amount),
    items,
    customer_name: sale.customer_name,
    customer_phone: sale.customer_phone,
    customer_cnic: sale.customer_cnic,
    partial_customer: partialCustomer
      ? {
          name: partialCustomer.customer_name,
          phone: partialCustomer.customer_phone,
          amount_remaining: partialCustomer.amount_remaining,
        }
      : null,
    settings,
  }
}
