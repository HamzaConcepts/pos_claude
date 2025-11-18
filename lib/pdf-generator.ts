interface Sale {
  id: string
  sale_date: string
  sale_description?: string
  sale_number: string
  total_amount: number
  amount_paid?: number
  payment_method: string
  payment_status: string
  users?: {
    full_name: string
  }
  sale_items?: Array<{
    quantity: number
    cost_price_snapshot?: number
  }>
  partial_payment_customers?: Array<{
    amount_remaining: number
  }>
}

export async function generateSalesPDF(
  sales: Sale[],
  period: 'day' | 'month' | 'year',
  date: string
) {
  const selectedDate = new Date(date)
  let startPeriod: Date
  let endPeriod: Date
  let periodLabel: string

  if (period === 'day') {
    startPeriod = new Date(selectedDate.setHours(0, 0, 0, 0))
    endPeriod = new Date(selectedDate.setHours(23, 59, 59, 999))
    periodLabel = startPeriod.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
  } else if (period === 'month') {
    startPeriod = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 0, 0, 0, 0)
    endPeriod = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999)
    periodLabel = startPeriod.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    })
  } else {
    startPeriod = new Date(selectedDate.getFullYear(), 0, 1, 0, 0, 0, 0)
    endPeriod = new Date(selectedDate.getFullYear(), 11, 31, 23, 59, 59, 999)
    periodLabel = selectedDate.getFullYear().toString()
  }

  const filteredSales = sales.filter(sale => {
    const saleDate = new Date(sale.sale_date)
    return saleDate >= startPeriod && saleDate <= endPeriod
  })

  if (filteredSales.length === 0) {
    throw new Error('No sales found for the selected period.')
  }

  // Calculate totals
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total_amount, 0)
  const totalCost = filteredSales.reduce((sum, sale) => {
    const saleCost = sale.sale_items?.reduce(
      (itemSum, item) => itemSum + (item.cost_price_snapshot || 0) * item.quantity,
      0
    ) || 0
    return sum + saleCost
  }, 0)
  const totalProfit = totalRevenue - totalCost
  const totalPaid = filteredSales.reduce((sum, sale) => sum + (sale.amount_paid || 0), 0)
  const cashSales = filteredSales.filter(s => s.payment_method === 'Cash')
  const digitalSales = filteredSales.filter(s => s.payment_method === 'Digital')
  const cashRevenue = cashSales.reduce((sum, sale) => sum + sale.total_amount, 0)
  const digitalRevenue = digitalSales.reduce((sum, sale) => sum + sale.total_amount, 0)
  const partialPayments = filteredSales.filter(s => s.payment_status === 'Partial')
  const loanedAmount = partialPayments.reduce((sum, sale) => {
    const customer = sale.partial_payment_customers?.[0]
    return sum + (customer?.amount_remaining || 0)
  }, 0)

  // Generate PDF HTML with print-optimized styling
  const pdfContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sales Report - ${periodLabel}</title>
      <style>
        @media print {
          @page { margin: 0.5in; }
          body { margin: 0; }
        }
        
        body { 
          font-family: Arial, sans-serif; 
          padding: 20px;
          font-size: 10pt;
          line-height: 1.4;
        }
        
        h1 { 
          text-align: center; 
          margin-bottom: 5px;
          font-size: 18pt;
          font-weight: bold;
        }
        
        .subtitle { 
          text-align: center; 
          color: #666; 
          margin-bottom: 20px;
          font-size: 11pt;
        }
        
        .summary { 
          display: grid; 
          grid-template-columns: repeat(4, 1fr); 
          gap: 10px; 
          margin-bottom: 20px;
        }
        
        .summary-card { 
          border: 2px solid black; 
          padding: 10px;
        }
        
        .summary-label { 
          font-size: 8pt; 
          color: #666; 
          margin-bottom: 3px;
        }
        
        .summary-value { 
          font-size: 14pt; 
          font-weight: bold;
        }
        
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 15px;
          font-size: 9pt;
        }
        
        th, td { 
          border: 1px solid black; 
          padding: 6px 8px;
          text-align: left;
        }
        
        th { 
          background-color: black; 
          color: white;
          font-size: 9pt;
          font-weight: bold;
        }
        
        tr:nth-child(even) { 
          background-color: #f2f2f2;
        }
        
        .partial-row { 
          background-color: #fee;
        }
        
        .text-right { 
          text-align: right;
        }
        
        .text-center { 
          text-align: center;
        }
        
        .footer { 
          margin-top: 20px; 
          padding-top: 15px; 
          border-top: 2px solid black; 
          text-align: center; 
          color: #666;
          font-size: 8pt;
        }
      </style>
    </head>
    <body>
      <h1>Sales Report</h1>
      <div class="subtitle">${periodLabel}</div>
      
      <div class="summary">
        <div class="summary-card" style="grid-column: span 4; background-color: #f9fafb; border: 3px solid black;">
          <div style="text-align: center; font-size: 10pt; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Sales Summary</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
            <div>
              <div class="summary-label">Total Sales (Revenue)</div>
              <div class="summary-value">$${totalRevenue.toFixed(2)}</div>
            </div>
            <div>
              <div class="summary-label">Total Cost</div>
              <div class="summary-value">$${totalCost.toFixed(2)}</div>
            </div>
            <div>
              <div class="summary-label">Total Profit</div>
              <div class="summary-value" style="color: ${totalProfit >= 0 ? '#16a34a' : '#dc2626'};">$${totalProfit.toFixed(2)}</div>
            </div>
            <div>
              <div class="summary-label">Loaned Amount</div>
              <div class="summary-value" style="color: #dc2626;">$${loanedAmount.toFixed(2)}</div>
            </div>
          </div>
        </div>
        
        <div class="summary-card" style="grid-column: span 2; background-color: #fafaf9; border: 3px solid black;">
          <div style="text-align: center; font-size: 10pt; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Cash Transactions</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            <div>
              <div class="summary-label">Number of Sales</div>
              <div class="summary-value">${cashSales.length}</div>
            </div>
            <div>
              <div class="summary-label">Total Revenue</div>
              <div class="summary-value">$${cashRevenue.toFixed(2)}</div>
            </div>
          </div>
        </div>
        
        <div class="summary-card" style="grid-column: span 2; background-color: #fafaf9; border: 3px solid black;">
          <div style="text-align: center; font-size: 10pt; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Digital Transactions</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            <div>
              <div class="summary-label">Number of Sales</div>
              <div class="summary-value">${digitalSales.length}</div>
            </div>
            <div>
              <div class="summary-label">Total Revenue</div>
              <div class="summary-value">$${digitalRevenue.toFixed(2)}</div>
            </div>
          </div>
        </div>
        
        <div class="summary-card" style="grid-column: span 4; background-color: #fef2f2; border: 3px solid #dc2626;">
          <div style="text-align: center; font-size: 10pt; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; color: #dc2626;">Collection Summary</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            <div>
              <div class="summary-label">Total Transactions</div>
              <div class="summary-value">${filteredSales.length}</div>
            </div>
            <div>
              <div class="summary-label">Amount Collected</div>
              <div class="summary-value" style="color: #16a34a;">$${totalPaid.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Cashier</th>
            <th class="text-center">Payment Method</th>
            <th class="text-center">Status</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${filteredSales.map(sale => `
            <tr class="${sale.payment_status === 'Partial' ? 'partial-row' : ''}">
              <td>${new Date(sale.sale_date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}</td>
              <td>${sale.sale_description || sale.sale_number}</td>
              <td>${sale.users?.full_name || 'Unknown'}</td>
              <td class="text-center">${sale.payment_method}</td>
              <td class="text-center">${sale.payment_status}</td>
              <td class="text-right"><strong>$${sale.total_amount.toFixed(2)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        Generated on ${new Date().toLocaleString('en-US')}
      </div>
    </body>
    </html>
  `

  // Create and download HTML file
  const blob = new Blob([pdfContent], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Sales_Report_${periodLabel.replace(/\s/g, '_')}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  // Open in new window for printing
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(pdfContent)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  return periodLabel
}
