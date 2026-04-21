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

const HECTAGON_FOOTER_LOGO_PATH = '/logo-black.png'
const imageDataCache = new Map<string, Promise<{ base64: string; width: number; height: number } | null>>()

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

function splitMultilineTextForPdf(doc: jsPDF, text: string, maxWidth: number): string[] {
  const normalized = (text || '').replace(/\r\n/g, '\n')
  const sourceLines = normalized.split('\n')
  const output: string[] = []

  sourceLines.forEach((line) => {
    if (!line.trim()) {
      output.push('')
      return
    }

    const wrappedLines = doc.splitTextToSize(line, maxWidth)
    output.push(...wrappedLines)
  })

  return output.length > 0 ? output : ['']
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

function resolveCustomerInfo(data: ReceiptData): { name: string; phone: string } {
  const rawName = data.customer_name || data.partial_customer?.name || ''
  const rawPhone = data.customer_phone || data.partial_customer?.phone || ''

  return {
    name: rawName.trim(),
    phone: rawPhone.trim(),
  }
}

/**
 * Load image from URL and return as base64 data URL for jsPDF
 */
async function loadImageAsBase64(url: string): Promise<{ base64: string; width: number; height: number } | null> {
  if (!url) {
    return null
  }

  const cached = imageDataCache.get(url)
  if (cached) {
    return cached
  }

  try {
    const loader = new Promise<{ base64: string; width: number; height: number } | null>((resolve) => {
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

    imageDataCache.set(url, loader)
    return await loader
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
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginLeft = 20
  const marginRight = 20
  const contentWidth = pageWidth - marginLeft - marginRight
  const centerX = pageWidth / 2
  let yPos = 18

  const drawDivider = () => {
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.25)
    doc.line(marginLeft, yPos, pageWidth - marginRight, yPos)
    yPos += 5
  }

  // Top restaurant logo (smaller, centered)
  if (settings.show_logo && settings.logo_url) {
    const headerLogo = await loadImageAsBase64(settings.logo_url)
    if (headerLogo) {
      const maxLogoWidth = 24
      const maxLogoHeight = 14
      const aspectRatio = headerLogo.width / headerLogo.height
      let logoWidth = maxLogoWidth
      let logoHeight = logoWidth / aspectRatio

      if (logoHeight > maxLogoHeight) {
        logoHeight = maxLogoHeight
        logoWidth = logoHeight * aspectRatio
      }

      doc.addImage(headerLogo.base64, 'PNG', centerX - logoWidth / 2, yPos, logoWidth, logoHeight)
      yPos += logoHeight + 4
    }
  }

  // Header text
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(settings.business_name || 'BUSINESS NAME', centerX, yPos, { align: 'center' })
  yPos += 5.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  if (settings.business_address) {
    const addressLines = doc.splitTextToSize(settings.business_address, contentWidth)
    addressLines.forEach((line: string) => {
      doc.text(line, centerX, yPos, { align: 'center' })
      yPos += 4
    })
  }

  const contactParts = [settings.business_phone, settings.business_email].filter(Boolean)
  if (contactParts.length > 0) {
    doc.text(contactParts.join(' / '), centerX, yPos, { align: 'center' })
    yPos += 4
  }

  yPos += 1
  drawDivider()

  // Sale number boxed line
  const saleLabel = `SALE NO # ${data.sale_number}`
  const boxWidth = Math.min(112, contentWidth)
  const boxX = centerX - boxWidth / 2
  doc.setDrawColor(0, 0, 0)
  doc.rect(boxX, yPos, boxWidth, 9)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(saleLabel, centerX, yPos + 6, { align: 'center' })
  yPos += 13

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Date    : ${formatDate(data.sale_date, 'short')}`, marginLeft, yPos)
  yPos += 5
  doc.text(`Cashier : ${data.cashier_name || 'Unknown'}`, marginLeft, yPos)
  yPos += 5
  const customer = resolveCustomerInfo(data)
  doc.text(`Customer name: ${customer.name || '-'}`, marginLeft, yPos)
  yPos += 5
  if (data.payment_method === 'Digital') {
    doc.text(`Customer no: ${customer.phone || '-'}`, marginLeft, yPos)
    yPos += 5
  }

  drawDivider()

  // Items table with ITEM / QTY / UNIT PRICE / LINE TOTAL
  const tableData = data.items.map((item) => [
    item.name,
    item.quantity.toString(),
    item.unit_price.toFixed(2),
    item.subtotal.toFixed(2),
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['ITEM', 'QTY', 'UNIT PRICE', 'TOTAL']],
    body: tableData,
    margin: { left: marginLeft, right: marginRight },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 2.5,
      lineColor: [230, 230, 230],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
    },
    theme: 'plain',
    styles: { overflow: 'linebreak' },
  })

  yPos = (doc as any).lastAutoTable.finalY + 4
  drawDivider()

  const subtotal = calculateSubtotal(data)
  const discountAmount = calculateDiscountAmount(data)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal', pageWidth - marginRight - 55, yPos)
  doc.text(subtotal.toFixed(2), pageWidth - marginRight, yPos, { align: 'right' })
  yPos += 5

  if (discountAmount > 0) {
    doc.text('Discount', pageWidth - marginRight - 55, yPos)
    doc.text(`-${discountAmount.toFixed(2)}`, pageWidth - marginRight, yPos, { align: 'right' })
    yPos += 5
  }

  drawDivider()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL', pageWidth - marginRight - 55, yPos)
  doc.text(data.total_amount.toFixed(2), pageWidth - marginRight, yPos, { align: 'right' })
  yPos += 5
  drawDivider()

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Payment: ${data.payment_method.toUpperCase()}`, marginLeft, yPos)
  yPos += 5
  if (data.payment_method === 'Digital') {
    doc.text(`Bank account: ${data.bank_account_name?.trim() || '-'}`, marginLeft, yPos)
    yPos += 5
  }
  doc.text('Received:', pageWidth - marginRight - 55, yPos)
  doc.text(data.amount_paid.toFixed(2), pageWidth - marginRight, yPos, { align: 'right' })
  yPos += 5

  if (data.payment_status === 'Partial') {
    doc.text('Amount Due:', pageWidth - marginRight - 55, yPos)
    doc.text(data.amount_due.toFixed(2), pageWidth - marginRight, yPos, { align: 'right' })
  } else {
    doc.text('Change:', pageWidth - marginRight - 55, yPos)
    doc.text(data.change_given.toFixed(2), pageWidth - marginRight, yPos, { align: 'right' })
  }
  yPos += 6

  drawDivider()

  // Footer message and branding
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const thankYouLines = splitMultilineTextForPdf(doc, settings.thank_you_message, contentWidth)
  thankYouLines.forEach((line) => {
    if (!line) {
      yPos += 3
      return
    }
    doc.text(line, centerX, yPos, { align: 'center' })
    yPos += 4
  })

  if (settings.return_policy) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const policyLines = splitMultilineTextForPdf(doc, settings.return_policy, contentWidth)
    policyLines.forEach((line) => {
      if (!line) {
        yPos += 2
        return
      }
      doc.text(line, centerX, yPos, { align: 'center' })
      yPos += 3.5
    })
  }

  yPos += 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Developed by Hectagon', centerX, yPos, { align: 'center' })
  yPos += 4
  doc.text('www.thehectagon.com', centerX, yPos, { align: 'center' })
  yPos += 5

  const footerLogo = await loadImageAsBase64(HECTAGON_FOOTER_LOGO_PATH)
  if (footerLogo) {
    const maxLogoWidth = 12
    const aspectRatio = footerLogo.width / footerLogo.height
    const logoWidth = maxLogoWidth
    const logoHeight = logoWidth / aspectRatio
    const logoY = Math.min(yPos, pageHeight - 20)
    doc.addImage(footerLogo.base64, 'PNG', centerX - logoWidth / 2, logoY, logoWidth, logoHeight)
  }

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
  const receiptWidth = paperWidth === '80mm' ? '302px' : '219px'
  const subtotal = calculateSubtotal(data)
  const discountAmount = calculateDiscountAmount(data)

  const itemsHTML = data.items.map((item) => `
    <tr>
      <td style="padding: 2px 0; font-size: 11px;">${escapeHTML(item.name)}</td>
      <td style="padding: 2px 0; text-align: center; font-size: 11px; width: 40px;">${item.quantity}</td>
      <td style="padding: 2px 0; text-align: right; font-size: 11px; width: 90px;">${item.unit_price.toFixed(2)} x ${item.quantity}</td>
      <td style="padding: 2px 0; text-align: right; font-size: 11px; width: 72px; font-weight: bold;">${item.subtotal.toFixed(2)}</td>
    </tr>
  `).join('')

  const customer = resolveCustomerInfo(data)
  const customerNameDisplay = escapeHTML(customer.name || '-')
  const customerPhoneDisplay = escapeHTML(customer.phone || '-')
  const customerDetailsHTML =
    data.payment_method === 'Digital'
      ? `<div>Customer name: ${customerNameDisplay}</div><div>Customer no : ${customerPhoneDisplay}</div>`
      : `<div>Customer name: ${customerNameDisplay}</div>`

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
    <div style="text-align: center; font-size: 11px; line-height: 1.35;">
      <div style="font-weight: bold; font-size: 13px;">${escapeHTML(settings.business_name || 'BUSINESS NAME')}</div>
      ${settings.business_address ? `<div>${escapeHTML(settings.business_address)}</div>` : ''}
      ${(settings.business_phone || settings.business_email) ? `<div>${escapeHTML([settings.business_phone, settings.business_email].filter(Boolean).join(' / '))}</div>` : ''}
    </div>

    <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

    <div style="border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold; font-size: 11px; margin-bottom: 6px;">
      SALE NO # ${escapeHTML(data.sale_number)}
    </div>

    <div style="font-size: 10.5px; line-height: 1.45; margin-bottom: 6px;">
      <div>Date   : ${formatDate(data.sale_date, 'short')}</div>
      <div>Cashier: ${escapeHTML(data.cashier_name || 'Unknown')}</div>
      ${customerDetailsHTML}
    </div>

    <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

    <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
      <thead>
        <tr style="border-bottom: 1px solid #000;">
          <th style="text-align: left; padding: 3px 0;">ITEM</th>
          <th style="text-align: center; padding: 3px 0; width: 40px;">QTY</th>
          <th style="text-align: right; padding: 3px 0; width: 90px;">UNIT x QTY</th>
          <th style="text-align: right; padding: 3px 0; width: 72px;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

    ${discountAmount > 0 ? `
    <div style="display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 2px;">
      <span>Discount</span>
      <span>-${discountAmount.toFixed(2)}</span>
    </div>
    ` : ''}

    <div style="display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 2px;">
      <span>Subtotal</span>
      <span>${subtotal.toFixed(2)}</span>
    </div>

    <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11.5px; margin-bottom: 2px;">
      <span>TOTAL</span>
      <span>${data.total_amount.toFixed(2)}</span>
    </div>

    <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

    <div style="font-size: 10.5px; line-height: 1.45;">
      <div>Payment: ${data.payment_method.toUpperCase()}</div>
      ${data.payment_method === 'Digital' ? `<div>Bank account: ${escapeHTML(data.bank_account_name?.trim() || '-')}</div>` : ''}
      <div style="display: flex; justify-content: space-between;"><span>Received:</span><span>${data.amount_paid.toFixed(2)}</span></div>
      ${data.payment_status === 'Partial'
        ? `<div style="display: flex; justify-content: space-between;"><span>Amount Due:</span><span>${data.amount_due.toFixed(2)}</span></div>`
        : `<div style="display: flex; justify-content: space-between;"><span>Change:</span><span>${data.change_given.toFixed(2)}</span></div>`}
    </div>

    <div style="border-top: 1px dashed #000; margin: 8px 0 6px;"></div>

    <div style="text-align: center; font-size: 10px; line-height: 1.45;">
      <div style="font-weight: bold; white-space: pre-line;">${escapeHTML(settings.thank_you_message)}</div>
      ${settings.return_policy ? `<div style="font-size: 9px; margin-top: 3px; white-space: pre-line;">${escapeHTML(settings.return_policy)}</div>` : ''}
      <div style="margin-top: 4px;">Developed by Hectagon</div>
      <div>www.thehectagon.com</div>
      <div style="margin-top: 6px;">
        <img src="${HECTAGON_FOOTER_LOGO_PATH}" alt="HECTAGON LOGO" style="max-width: 64px; max-height: 24px; object-fit: contain;" onerror="this.style.display='none'" />
      </div>
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

function escapeHTMLWithLineBreaks(str: string): string {
  return escapeHTML(str).replace(/\r?\n/g, '<br/>')
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
    bank_account_name: sale.bank_account_name,
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
