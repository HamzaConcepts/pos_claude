import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { QuotationPDFData, QuotationItem } from './types'

/**
 * Format currency with custom currency symbol
 */
function formatCurrency(amount: number, currency: string = 'PKR', decimals: number = 2): string {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/**
 * Format date for quotation display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-PK', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
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

/**
 * Generate a quotation PDF document
 */
export async function generateQuotationPDF(data: QuotationPDFData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const { quotation, items, currency } = data
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginLeft = 15
  const marginRight = 15
  const contentWidth = pageWidth - marginLeft - marginRight
  let yPos = 20

  // ===== HEADER SECTION =====

  // Logo (if available)
  if (data.logo_url) {
    const logoData = await loadImageAsBase64(data.logo_url)
    if (logoData) {
      // Scale logo to max 25mm height, maintaining aspect ratio
      const maxLogoHeight = 25
      const maxLogoWidth = 50
      const aspectRatio = logoData.width / logoData.height
      let logoWidth = maxLogoHeight * aspectRatio
      let logoHeight = maxLogoHeight
      if (logoWidth > maxLogoWidth) {
        logoWidth = maxLogoWidth
        logoHeight = maxLogoWidth / aspectRatio
      }
      const logoX = (pageWidth - logoWidth) / 2
      doc.addImage(logoData.base64, 'PNG', logoX, yPos - 5, logoWidth, logoHeight)
      yPos += logoHeight + 3
    }
  }

  // Company name
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(data.store_name || 'Company', pageWidth / 2, yPos, { align: 'center' })
  yPos += 7

  // Address
  if (data.store_address) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const addressLines = doc.splitTextToSize(data.store_address, contentWidth)
    doc.text(addressLines, pageWidth / 2, yPos, { align: 'center' })
    yPos += addressLines.length * 4 + 1
  }

  // Contact info
  const contactParts: string[] = []
  if (data.store_phone) contactParts.push(`Tel: ${data.store_phone}`)
  if (data.store_email) contactParts.push(data.store_email)
  if (contactParts.length > 0) {
    doc.setFontSize(9)
    doc.text(contactParts.join('  |  '), pageWidth / 2, yPos, { align: 'center' })
    yPos += 5
  }

  // Separator line
  yPos += 2
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  doc.line(marginLeft, yPos, pageWidth - marginRight, yPos)
  yPos += 10

  // ===== QUOTATION TITLE =====
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('QUOTATION', pageWidth / 2, yPos, { align: 'center' })
  yPos += 12

  // ===== QUOTATION INFO + CUSTOMER DETAILS =====
  const infoStartY = yPos

  // Left column: Quotation details
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Quotation No:', marginLeft, yPos)
  doc.setFont('helvetica', 'normal')
  doc.text(quotation.quotation_number, marginLeft + 32, yPos)
  yPos += 5

  doc.setFont('helvetica', 'bold')
  doc.text('Date:', marginLeft, yPos)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(quotation.created_at), marginLeft + 32, yPos)
  yPos += 5

  if (quotation.valid_until) {
    doc.setFont('helvetica', 'bold')
    doc.text('Valid Until:', marginLeft, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(formatDate(quotation.valid_until), marginLeft + 32, yPos)
    yPos += 5
  }

  // Status badge
  doc.setFont('helvetica', 'bold')
  doc.text('Status:', marginLeft, yPos)
  doc.setFont('helvetica', 'normal')
  const statusText = quotation.status.charAt(0).toUpperCase() + quotation.status.slice(1)
  doc.text(statusText, marginLeft + 32, yPos)
  yPos += 5

  // Right column: Customer info (bordered box)
  const rightColX = pageWidth / 2 + 10
  const boxWidth = pageWidth / 2 - marginRight - 10
  const hasCustomer = quotation.customer_name || quotation.customer_phone || quotation.customer_email

  if (hasCustomer) {
    let boxHeight = 10 // padding
    if (quotation.customer_name) boxHeight += 5
    if (quotation.customer_phone) boxHeight += 5
    if (quotation.customer_email) boxHeight += 5
    if (quotation.customer_address) {
      const addrLines = doc.splitTextToSize(quotation.customer_address, boxWidth - 8)
      boxHeight += addrLines.length * 4 + 1
    }

    // Draw box
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.rect(rightColX, infoStartY - 3, boxWidth, boxHeight)

    let boxY = infoStartY + 2
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Bill To:', rightColX + 4, boxY)
    boxY += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    if (quotation.customer_name) {
      doc.text(quotation.customer_name, rightColX + 4, boxY)
      boxY += 5
    }
    if (quotation.customer_phone) {
      doc.text(quotation.customer_phone, rightColX + 4, boxY)
      boxY += 5
    }
    if (quotation.customer_email) {
      doc.text(quotation.customer_email, rightColX + 4, boxY)
      boxY += 5
    }
    if (quotation.customer_address) {
      doc.setFontSize(9)
      const addrLines = doc.splitTextToSize(quotation.customer_address, boxWidth - 8)
      doc.text(addrLines, rightColX + 4, boxY)
    }
  }

  yPos = Math.max(yPos, infoStartY + (hasCustomer ? 35 : 0)) + 10

  // ===== ITEMS TABLE =====
  const tableData = items.map((item: QuotationItem, index: number) => [
    (index + 1).toString(),
    item.product_name + (item.product_sku ? `\n(SKU: ${item.product_sku})` : ''),
    item.quantity.toString(),
    formatCurrency(item.unit_price, currency),
    formatCurrency(item.line_total, currency),
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Item Description', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    margin: { left: marginLeft, right: marginRight },
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    theme: 'grid',
    styles: {
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
    },
  })

  // Get Y position after table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 10

  // ===== SUMMARY SECTION (right-aligned) =====
  const summaryX = pageWidth - marginRight - 70
  const summaryWidth = 70
  const valueX = pageWidth - marginRight

  // Subtotal
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Subtotal:', summaryX, yPos)
  doc.text(formatCurrency(quotation.subtotal, currency), valueX, yPos, { align: 'right' })
  yPos += 6

  // Discount (if any)
  if (quotation.discount_type !== 'none' && quotation.discount_amount > 0) {
    const discountLabel = quotation.discount_type === 'percentage'
      ? `Discount (${quotation.discount_value}%):`
      : 'Discount:'
    doc.text(discountLabel, summaryX, yPos)
    doc.text(`- ${formatCurrency(quotation.discount_amount, currency)}`, valueX, yPos, { align: 'right' })
    yPos += 6
  }

  // Separator before total
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  doc.line(summaryX, yPos, valueX, yPos)
  yPos += 6

  // Grand Total
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Grand Total:', summaryX, yPos)
  doc.text(formatCurrency(quotation.total, currency), valueX, yPos, { align: 'right' })
  yPos += 12

  // ===== NOTES SECTION =====
  if (quotation.notes) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Notes:', marginLeft, yPos)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const noteLines = doc.splitTextToSize(quotation.notes, contentWidth)
    doc.text(noteLines, marginLeft, yPos)
    yPos += noteLines.length * 4 + 5
  }

  // ===== TERMS & CONDITIONS SECTION =====
  if (quotation.terms_and_conditions) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Terms & Conditions:', marginLeft, yPos)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const termLines = doc.splitTextToSize(quotation.terms_and_conditions, contentWidth)
    doc.text(termLines, marginLeft, yPos)
    yPos += termLines.length * 4 + 5
  }

  // ===== FOOTER =====
  const footerY = pageHeight - 20

  // Separator line
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.line(marginLeft, footerY, pageWidth - marginRight, footerY)

  // Disclaimer
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  doc.text(
    'This quotation is not a tax invoice. Prices are valid until the date specified above.',
    pageWidth / 2,
    footerY + 5,
    { align: 'center' }
  )

  // Signature line
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Prepared by: _______________', pageWidth - marginRight, footerY + 12, { align: 'right' })

  // Page number  
  doc.text(`Page 1 of 1`, marginLeft, footerY + 12)

  return doc
}

/**
 * Open quotation PDF in a new tab for printing
 */
export async function printQuotationPDF(data: QuotationPDFData): Promise<void> {
  const doc = await generateQuotationPDF(data)
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
 * Download quotation PDF
 */
export async function downloadQuotationPDF(data: QuotationPDFData): Promise<void> {
  const doc = await generateQuotationPDF(data)
  doc.save(`${data.quotation.quotation_number}.pdf`)
}
