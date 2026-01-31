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
 * Format currency with Rs. symbol
 */
function formatCurrency(amount: number, decimals: number = 2): string {
  return `Rs. ${amount.toFixed(decimals)}`
}

/**
 * Format date for receipt display
 */
function formatDate(dateString: string, format: 'full' | 'short' = 'full'): string {
  const date = new Date(dateString)
  if (format === 'short') {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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

// ===== PDF RECEIPT GENERATION (A4 Format) =====

export function generatePDFReceipt(data: ReceiptData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const settings = data.settings
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginLeft = 15
  const marginRight = 15
  const contentWidth = pageWidth - marginLeft - marginRight
  let yPos = 20

  // ===== HEADER SECTION =====
  
  // Business Name
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(settings.business_name, pageWidth / 2, yPos, { align: 'center' })
  yPos += 8

  // Business Address
  if (settings.business_address) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const addressLines = doc.splitTextToSize(settings.business_address, contentWidth)
    doc.text(addressLines, pageWidth / 2, yPos, { align: 'center' })
    yPos += addressLines.length * 4 + 2
  }

  // Contact Info
  const contactParts: string[] = []
  if (settings.business_phone) contactParts.push(`Tel: ${settings.business_phone}`)
  if (settings.business_email) contactParts.push(settings.business_email)
  if (contactParts.length > 0) {
    doc.setFontSize(9)
    doc.text(contactParts.join(' | '), pageWidth / 2, yPos, { align: 'center' })
    yPos += 5
  }

  // Tax ID
  if (settings.show_tax_id && settings.tax_id) {
    doc.setFontSize(9)
    doc.text(`Tax ID: ${settings.tax_id}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 5
  }

  // Separator line
  yPos += 3
  doc.setDrawColor(51, 51, 51)
  doc.setLineWidth(0.5)
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos)
  yPos += 8

  // ===== RECEIPT INFO BAR =====
  doc.setFontSize(10)
  
  // Left side: Receipt number and Cashier
  doc.setFont('helvetica', 'bold')
  doc.text(`Receipt #: ${data.sale_number}`, marginLeft, yPos)
  doc.setFont('helvetica', 'normal')
  doc.text(`Date: ${formatDate(data.sale_date)}`, pageWidth - marginRight, yPos, { align: 'right' })
  yPos += 5

  doc.text(`Cashier: ${data.cashier_name || 'Unknown'}`, marginLeft, yPos)
  doc.text(`Payment: ${data.payment_method}`, pageWidth - marginRight, yPos, { align: 'right' })
  yPos += 5

  // Payment status (highlighted if partial)
  if (data.payment_status === 'Partial') {
    doc.setTextColor(211, 47, 47) // Red
    doc.setFont('helvetica', 'bold')
    doc.text(`Status: PARTIAL PAYMENT`, marginLeft, yPos)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
  } else {
    doc.text(`Status: ${data.payment_status}`, marginLeft, yPos)
  }
  yPos += 8

  // Separator line
  doc.setDrawColor(204, 204, 204)
  doc.setLineWidth(0.3)
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos)
  yPos += 5

  // ===== CUSTOMER INFO (if present) =====
  if (data.customer_name || data.customer_phone) {
    doc.setFillColor(245, 245, 245)
    doc.rect(marginLeft, yPos, contentWidth, 18, 'F')
    yPos += 5
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Customer Information', marginLeft + 3, yPos)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    if (data.customer_name) {
      doc.text(`Name: ${data.customer_name}`, marginLeft + 3, yPos)
      yPos += 4
    }
    if (data.customer_phone) {
      doc.text(`Phone: ${data.customer_phone}`, marginLeft + 3, yPos)
      yPos += 4
    }
    yPos += 5
  }

  // ===== PARTIAL PAYMENT CUSTOMER (if present) =====
  if (data.partial_customer) {
    doc.setFillColor(255, 235, 235) // Light red background
    doc.setDrawColor(211, 47, 47)
    doc.setLineWidth(0.5)
    doc.rect(marginLeft, yPos, contentWidth, 22, 'FD')
    yPos += 5
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(211, 47, 47)
    doc.text('⚠ PARTIAL PAYMENT - CREDIT SALE', marginLeft + 3, yPos)
    doc.setTextColor(0, 0, 0)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    doc.text(`Customer: ${data.partial_customer.name}`, marginLeft + 3, yPos)
    yPos += 4
    doc.text(`Phone: ${data.partial_customer.phone}`, marginLeft + 3, yPos)
    yPos += 4
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(211, 47, 47)
    doc.text(`Amount Due: ${formatCurrency(data.partial_customer.amount_remaining)}`, marginLeft + 3, yPos)
    doc.setTextColor(0, 0, 0)
    yPos += 8
  }

  // ===== ITEMS TABLE =====
  const tableData = data.items.map((item) => [
    item.name,
    item.quantity.toString(),
    formatCurrency(item.unit_price),
    formatCurrency(item.subtotal),
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['Item', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    margin: { left: marginLeft, right: marginRight },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  })

  yPos = (doc as any).lastAutoTable.finalY + 10

  // ===== TOTALS SECTION =====
  const totalsX = pageWidth - marginRight - 80
  const totalsWidth = 80
  
  // Subtotal (if discount applied)
  const hasDiscount = data.discount_type !== 'none' && data.discount_value > 0
  if (hasDiscount) {
    const subtotal = calculateSubtotal(data)
    doc.setFontSize(10)
    doc.text('Subtotal:', totalsX, yPos)
    doc.text(formatCurrency(subtotal), pageWidth - marginRight, yPos, { align: 'right' })
    yPos += 5

    // Discount
    doc.setTextColor(211, 47, 47) // Red
    const discountLabel = data.discount_type === 'percentage' 
      ? `Discount (${data.discount_value}%):` 
      : 'Discount:'
    doc.text(discountLabel, totalsX, yPos)
    doc.text(`-${formatCurrency(calculateDiscountAmount(data))}`, pageWidth - marginRight, yPos, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    yPos += 5
  }

  // Total
  doc.setDrawColor(51, 51, 51)
  doc.setLineWidth(0.5)
  doc.line(totalsX, yPos, pageWidth - marginRight, yPos)
  yPos += 6
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL:', totalsX, yPos)
  doc.text(formatCurrency(data.total_amount), pageWidth - marginRight, yPos, { align: 'right' })
  yPos += 8

  // Amount Paid
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Amount Paid:', totalsX, yPos)
  doc.text(formatCurrency(data.amount_paid), pageWidth - marginRight, yPos, { align: 'right' })
  yPos += 5

  // Change or Amount Due
  if (data.payment_status === 'Partial') {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(211, 47, 47)
    doc.text('Amount Due:', totalsX, yPos)
    doc.text(formatCurrency(data.amount_due), pageWidth - marginRight, yPos, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  } else {
    doc.text('Change:', totalsX, yPos)
    doc.text(formatCurrency(data.change_given), pageWidth - marginRight, yPos, { align: 'right' })
  }
  yPos += 15

  // ===== FOOTER SECTION =====
  doc.setDrawColor(51, 51, 51)
  doc.setLineWidth(0.3)
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos)
  yPos += 8

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
    doc.setTextColor(0, 0, 0)
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
          ${item.quantity} × Rs.${item.unit_price.toFixed(0)}
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
        <div style="font-weight: bold; font-size: 10px;">Due: Rs.${data.partial_customer.amount_remaining.toFixed(0)}</div>
      </div>
    `
  }

  // Discount section
  let discountHTML = ''
  if (hasDiscount) {
    discountHTML = `
      <tr>
        <td style="padding: 2px 0; font-size: 10px;">Subtotal:</td>
        <td style="padding: 2px 0; text-align: right; font-size: 10px;">Rs.${subtotal.toFixed(0)}</td>
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
        <td style="padding: 2px 0; text-align: right; font-size: 10px;">Rs.${data.amount_due.toFixed(0)}</td>
      </tr>
    `
  } else {
    finalAmountHTML = `
      <tr>
        <td style="padding: 2px 0; font-size: 10px;">Change:</td>
        <td style="padding: 2px 0; text-align: right; font-size: 10px;">Rs.${data.change_given.toFixed(0)}</td>
      </tr>
    `
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
      padding: 8px;
      background: white;
      color: black;
    }
    .receipt {
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Header -->
    <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
      <div style="font-weight: bold; font-size: 14px;">${escapeHTML(settings.business_name)}</div>
      ${settings.business_address ? `<div style="font-size: 10px;">${escapeHTML(settings.business_address)}</div>` : ''}
      ${settings.business_phone ? `<div style="font-size: 10px;">Tel: ${escapeHTML(settings.business_phone)}</div>` : ''}
      ${settings.show_tax_id && settings.tax_id ? `<div style="font-size: 9px;">Tax ID: ${escapeHTML(settings.tax_id)}</div>` : ''}
    </div>

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
          <td style="padding: 4px 0; text-align: right;">Rs.${data.total_amount.toFixed(0)}</td>
        </tr>
        <tr>
          <td style="padding: 2px 0; font-size: 10px;">Paid:</td>
          <td style="padding: 2px 0; text-align: right; font-size: 10px;">Rs.${data.amount_paid.toFixed(0)}</td>
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
      <div style="font-size: 8px; margin-top: 8px;">${new Date().toLocaleDateString()}</div>
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
export function printPDFReceipt(data: ReceiptData): void {
  const doc = generatePDFReceipt(data)
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
export function downloadPDFReceipt(data: ReceiptData): void {
  const doc = generatePDFReceipt(data)
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
export function saleToReceiptData(sale: any, settings: ReceiptSettings): ReceiptData {
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
