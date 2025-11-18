'use client'

import { useEffect, useState } from 'react'
import { Calendar, User, DollarSign, CreditCard, ChevronDown, ChevronUp, Package, Filter, FileText } from 'lucide-react'
import { generateSalesPDF } from '@/lib/pdf-generator'


export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([])
  const [filteredSales, setFilteredSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null)
  
  // Filter states
  const [cashiers, setCashiers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedCashier, setSelectedCashier] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [pdfPeriod, setPdfPeriod] = useState<'day' | 'month' | 'year'>('day')
  const [pdfDate, setPdfDate] = useState(new Date().toISOString().split('T')[0])
  const [generatingPdf, setGeneratingPdf] = useState(false)

  useEffect(() => {
    fetchSales()
    fetchCashiers()
    fetchProducts()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [sales, selectedCashier, selectedProduct, selectedPaymentMethod, selectedPaymentStatus, startDate, endDate])

  const fetchSales = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sales')
      const result = await response.json()

      if (result.success) {
        setSales(result.data)
        setFilteredSales(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to fetch sales')
    } finally {
      setLoading(false)
    }
  }

  const fetchCashiers = async () => {
    try {
      const response = await fetch('/api/users')
      const result = await response.json()
      if (result.success) {
        setCashiers(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch cashiers')
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      const result = await response.json()
      if (result.success) {
        setProducts(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch products')
    }
  }

  const applyFilters = () => {
    let filtered = [...sales]

    // Filter by cashier
    if (selectedCashier) {
      filtered = filtered.filter(sale => sale.cashier_id === selectedCashier)
    }

    // Filter by product
    if (selectedProduct) {
      filtered = filtered.filter(sale => 
        sale.sale_items?.some((item: any) => item.product_id === parseInt(selectedProduct))
      )
    }

    // Filter by payment method
    if (selectedPaymentMethod) {
      filtered = filtered.filter(sale => sale.payment_method === selectedPaymentMethod)
    }

    // Filter by payment status
    if (selectedPaymentStatus) {
      filtered = filtered.filter(sale => sale.payment_status === selectedPaymentStatus)
    }

    // Filter by date range
    if (startDate) {
      filtered = filtered.filter(sale => new Date(sale.sale_date) >= new Date(startDate))
    }
    if (endDate) {
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      filtered = filtered.filter(sale => new Date(sale.sale_date) <= endDateTime)
    }

    setFilteredSales(filtered)
  }

  const clearFilters = () => {
    setSelectedCashier('')
    setSelectedProduct('')
    setSelectedPaymentMethod('')
    setSelectedPaymentStatus('')
    setStartDate('')
    setEndDate('')
  }

  const generatePDF = async () => {
    setGeneratingPdf(true)
    try {
      await generateSalesPDF(sales, pdfPeriod, pdfDate)
      setShowPdfModal(false)
    } catch (err: any) {
      console.error('Failed to generate PDF:', err)
      alert(err.message || 'Failed to generate PDF. Please try again.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Loading sales...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Sales History</h1>
        <button
          onClick={() => setShowPdfModal(true)}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <FileText size={20} />
          Sales Record
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-status-error text-white rounded">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded border-2 border-black mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} />
          <h2 className="font-bold text-lg">Filters</h2>
          {(selectedCashier || selectedProduct || selectedPaymentMethod || selectedPaymentStatus || startDate || endDate) && (
            <button
              onClick={clearFilters}
              className="ml-auto text-sm text-status-error hover:underline"
            >
              Clear All Filters
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Cashier Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">Cashier</label>
            <select
              value={selectedCashier}
              onChange={(e) => setSelectedCashier(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none text-sm font-sans"
            >
              <option value="">All Cashiers</option>
              {cashiers.map((cashier) => (
                <option key={cashier.id} value={cashier.id}>
                  {cashier.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Product Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">Product</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none text-sm font-sans"
            >
              <option value="">All Products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">Payment Method</label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none text-sm font-sans"
            >
              <option value="">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Digital">Digital</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">Payment Status</label>
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none text-sm font-sans"
            >
              <option value="">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          {/* Start Date Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none text-sm"
            />
          </div>

          {/* End Date Filter */}
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none text-sm"
            />
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-text-secondary">
          Showing {filteredSales.length} of {sales.length} sales
        </div>
      </div>

      {filteredSales.length === 0 ? (
        <div className="bg-white p-8 rounded border-2 border-black text-center">
          <p className="text-text-secondary">
            {sales.length === 0 ? 'No sales found' : 'No sales match the selected filters'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded border-2 border-black overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-black text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 text-left">Cashier</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">Payment</th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale, index) => {
                  const isExpanded = expandedSaleId === sale.id
                  const totalCost = sale.sale_items?.reduce(
                    (sum: number, item: any) => sum + (item.cost_price_snapshot || 0) * item.quantity,
                    0
                  ) || 0
                  const profit = sale.total_amount - totalCost

                  return (
                    <>
                      <tr
                        key={sale.id}
                        onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                        className={`cursor-pointer transition-all ${
                          sale.payment_status === 'Partial' ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-600' :
                          index % 2 === 0 ? 'bg-white' : 'bg-bg-secondary'
                        } ${isExpanded && sale.payment_status !== 'Partial' ? 'border-l-4 border-black' : ''} ${
                          sale.payment_status !== 'Partial' ? 'hover:bg-gray-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <span className="font-normal">{sale.sale_description || sale.sale_number}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {new Date(sale.sale_date).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3">{sale.users?.full_name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          ${sale.total_amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-bg-secondary rounded text-sm">
                            {sale.payment_method === 'Cash' ? (
                              <DollarSign size={14} />
                            ) : (
                              <CreditCard size={14} />
                            )}
                            {sale.payment_method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              sale.payment_status === 'Paid'
                                ? 'bg-black text-white'
                                : sale.payment_status === 'Partial'
                                ? 'bg-red-600 text-white'
                                : 'bg-status-warning text-white'
                            }`}
                          >
                            {sale.payment_status === 'Partial' && '⚠️ '}
                            {sale.payment_status}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${sale.id}-details`} className="animate-fadeIn">
                          <td colSpan={6} className={
                            sale.payment_status === 'Partial' ? 'bg-red-50' :
                            index % 2 === 0 ? 'bg-white' : 'bg-bg-secondary'
                          }>
                            <div className="px-4 py-4 border-t-2 border-gray-200">
                              {/* Mobile-only info */}
                              <div className="md:hidden mb-4 pb-4 border-b-2 border-gray-300">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="text-text-secondary">Date:</span>
                                    <span className="ml-2 font-medium">
                                      {new Date(sale.sale_date).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-text-secondary">Payment:</span>
                                    <span className="ml-2 inline-flex items-center gap-1">
                                      {sale.payment_method === 'Cash' ? (
                                        <DollarSign size={12} />
                                      ) : (
                                        <CreditCard size={12} />
                                      )}
                                      {sale.payment_method}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-text-secondary">Status:</span>
                                    <span className="ml-2">
                                      <span
                                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                          sale.payment_status === 'Paid'
                                            ? 'bg-black text-white'
                                            : sale.payment_status === 'Partial'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-status-warning text-white'
                                        }`}
                                      >
                                        {sale.payment_status === 'Partial' && '⚠️ '}
                                        {sale.payment_status}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Partial Payment Customer Info */}
                              {sale.payment_status === 'Partial' && (sale as any).partial_payment_customers?.[0] && (
                                <div className="mb-4 p-4 bg-red-600 border-2 border-red-800 rounded">
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-white font-bold">⚠️ PARTIAL PAYMENT CUSTOMER</span>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div>
                                      <div className="text-red-100 mb-1">Customer Name</div>
                                      <div className="font-bold text-white">{(sale as any).partial_payment_customers[0].customer_name}</div>
                                    </div>
                                    <div>
                                      <div className="text-red-100 mb-1">CNIC</div>
                                      <div className="font-medium text-white">{(sale as any).partial_payment_customers[0].customer_cnic}</div>
                                    </div>
                                    <div>
                                      <div className="text-red-100 mb-1">Phone</div>
                                      <div className="font-medium text-white">{(sale as any).partial_payment_customers[0].customer_phone}</div>
                                    </div>
                                    <div>
                                      <div className="text-red-100 mb-1">Amount Remaining</div>
                                      <div className="font-bold text-white text-lg">
                                        ${(sale as any).partial_payment_customers[0].amount_remaining.toFixed(2)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-3 p-2 bg-red-800 text-white rounded font-bold text-center">
                                    OUTSTANDING BALANCE DUE
                                  </div>
                                </div>
                              )}

                              {/* Sale Summary */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="p-3 border-2 border-black rounded">
                                  <div className="text-xs text-text-secondary mb-1">Sale Date</div>
                                  <div className="font-bold">
                                    {new Date(sale.sale_date).toLocaleString('en-US', {
                                      month: 'long',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                </div>
                                <div className="p-3 border-2 border-black rounded">
                                  <div className="text-xs text-text-secondary mb-1">Cashier</div>
                                  <div className="font-bold">{sale.users?.full_name || 'Unknown'}</div>
                                </div>
                                <div className="p-3 border-2 border-black rounded">
                                  <div className="text-xs text-text-secondary mb-1">Amount Paid</div>
                                  <div className="font-bold">${sale.amount_paid?.toFixed(2) || '0.00'}</div>
                                </div>
                                <div className="p-3 border-2 border-black rounded">
                                  <div className="text-xs text-text-secondary mb-1">Profit</div>
                                  <div className={`font-bold ${profit >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                                    ${profit.toFixed(2)}
                                  </div>
                                </div>
                              </div>

                              {/* Sale Items */}
                              <div className="mb-3">
                                <div className="flex items-center gap-2 text-sm font-bold mb-2">
                                  <Package size={16} />
                                  Sale Items ({sale.sale_items?.length || 0})
                                </div>
                                <div className="border-2 border-black rounded overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left">SKU</th>
                                        <th className="px-3 py-2 text-left">Product</th>
                                        <th className="px-3 py-2 text-center">Qty</th>
                                        <th className="px-3 py-2 text-right">Unit Price</th>
                                        <th className="px-3 py-2 text-right">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sale.sale_items?.map((item: any, idx: number) => (
                                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                          <td className="px-3 py-2 font-mono text-xs">{item.product_sku || 'N/A'}</td>
                                          <td className="px-3 py-2">{item.product_name || 'Unknown Product'}</td>
                                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                                          <td className="px-3 py-2 text-right">${item.unit_price.toFixed(2)}</td>
                                          <td className="px-3 py-2 text-right font-bold">${item.subtotal.toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="bg-black text-white">
                                      <tr>
                                        <td colSpan={4} className="px-3 py-2 text-right font-bold">Total:</td>
                                        <td className="px-3 py-2 text-right font-bold">${sale.total_amount.toFixed(2)}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>

                              {/* Notes */}
                              {sale.notes && (
                                <div className="text-sm">
                                  <div className="font-bold mb-1">Notes:</div>
                                  <div className="text-text-secondary italic">{sale.notes}</div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PDF Generation Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border-2 border-black max-w-md w-full p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2">Generate Sales Record</h2>
              <p className="text-sm text-text-secondary">Select the time period for the sales report</p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block mb-2 font-medium text-sm">
                  Period Type <span className="text-status-error">*</span>
                </label>
                <select
                  value={pdfPeriod}
                  onChange={(e) => setPdfPeriod(e.target.value as 'day' | 'month' | 'year')}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none font-sans"
                >
                  <option value="day">Daily Report</option>
                  <option value="month">Monthly Report</option>
                  <option value="year">Yearly Report</option>
                </select>
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm">
                  {pdfPeriod === 'day' ? 'Select Date' : pdfPeriod === 'month' ? 'Select Month' : 'Select Year'} <span className="text-status-error">*</span>
                </label>
                <input
                  type={pdfPeriod === 'year' ? 'number' : pdfPeriod === 'month' ? 'month' : 'date'}
                  value={pdfPeriod === 'year' ? new Date(pdfDate).getFullYear() : pdfDate}
                  onChange={(e) => {
                    if (pdfPeriod === 'year') {
                      setPdfDate(`${e.target.value}-01-01`)
                    } else {
                      setPdfDate(e.target.value)
                    }
                  }}
                  min={pdfPeriod === 'year' ? '2020' : undefined}
                  max={pdfPeriod === 'year' ? new Date().getFullYear().toString() : undefined}
                  className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none font-sans"
                />
              </div>

              <div className="p-3 bg-bg-secondary border-2 border-black rounded text-sm">
                <p className="text-text-secondary">
                  The report will include all sales for the selected {pdfPeriod} and can be printed or saved as PDF.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPdfModal(false)}
                className="flex-1 px-4 py-3 border-2 border-black rounded hover:bg-bg-secondary transition-colors font-medium"
                disabled={generatingPdf}
              >
                Cancel
              </button>
              <button
                onClick={generatePDF}
                disabled={generatingPdf}
                className="flex-1 px-4 py-3 bg-black text-white rounded hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {generatingPdf ? 'Generating...' : 'Generate PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )


}
