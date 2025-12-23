'use client'

import { useEffect, useState } from 'react'
import { Calendar, User, DollarSign, CreditCard, ChevronDown, ChevronUp, Package, Filter, FileText, Edit, X } from 'lucide-react'
import { generateSalesPDF } from '@/lib/pdf-generator'
import { getStoreId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useDarkMode } from '@/hooks/useDarkMode'


export default function SalesPage() {
  const router = useRouter()
  const isDarkMode = useDarkMode()
  const [sales, setSales] = useState<any[]>([])
  const [filteredSales, setFilteredSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null)
  
  // Filter states
  const [cashiers, setCashiers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCashier, setSelectedCashier] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [pdfPeriod, setPdfPeriod] = useState<'day' | 'month' | 'year'>('day')
  const [pdfDate, setPdfDate] = useState(new Date().toISOString().split('T')[0])
  const [pdfCashierId, setPdfCashierId] = useState('')
  const [pdfCustomerId, setPdfCustomerId] = useState('')
  const [generatingPdf, setGeneratingPdf] = useState(false)

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSale, setEditingSale] = useState<any>(null)
  const [editPaymentMethod, setEditPaymentMethod] = useState('')
  const [editPaymentStatus, setEditPaymentStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [updating, setUpdating] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    fetchSales()
    fetchCashiers()
    fetchProducts()
    fetchCustomers()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [sales, selectedCashier, selectedProduct, selectedPaymentMethod, selectedPaymentStatus, startDate, endDate])

  const fetchSales = async () => {
    try {
      setLoading(true)
      
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        router.push('/login')
        return
      }

      const response = await fetch(`/api/sales?store_id=${storeId}`)
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
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/users?store_id=${storeId}`)
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
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/products?store_id=${storeId}`)
      const result = await response.json()
      if (result.success) {
        setProducts(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch products')
    }
  }

  const fetchCustomers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/partial-payment-customers?store_id=${storeId}`)
      const result = await response.json()
      if (result.success) {
        setCustomers(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch customers')
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

  const handleEdit = (sale: any) => {
    setEditingSale(sale)
    setEditPaymentMethod(sale.payment_method || 'Cash')
    setEditPaymentStatus(sale.payment_status || 'Paid')
    setEditNotes(sale.notes || '')
    setShowEditModal(true)
    setEditError('')
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingSale) {
      setEditError('No sale selected for editing')
      return
    }

    setUpdating(true)
    setEditError('')

    try {
      const response = await fetch(`/api/sales/${editingSale.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: editPaymentMethod,
          payment_status: editPaymentStatus,
          notes: editNotes
        })
      })

      const result = await response.json()

      if (result.success) {
        setShowEditModal(false)
        setEditingSale(null)
        fetchSales()
      } else {
        setEditError(result.error || 'Failed to update sale')
      }
    } catch (err) {
      setEditError('Failed to update sale')
    } finally {
      setUpdating(false)
    }
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
      // Filter sales by selected cashier and customer if needed
      let filteredForPdf = sales
      
      if (pdfCashierId) {
        filteredForPdf = filteredForPdf.filter(sale => sale.cashier_id === pdfCashierId)
      }
      
      if (pdfCustomerId) {
        const selectedCustomer = customers.find(c => c.id === parseInt(pdfCustomerId))
        if (selectedCustomer) {
          filteredForPdf = filteredForPdf.filter(sale => 
            sale.payment_status === 'Partial' && 
            (sale as any).partial_payment_customers?.some((c: any) => 
              c.customer_name === selectedCustomer.customer_name
            )
          )
        }
      }
      
      await generateSalesPDF(filteredForPdf, pdfPeriod, pdfDate)
      setShowPdfModal(false)
      setPdfCashierId('')
      setPdfCustomerId('')
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
    <>
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Sales History</h1>
        <button
          onClick={() => setShowPdfModal(true)}
          className="px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors flex items-center gap-2"
        >
          <FileText size={16} />
          Sales Record
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded border border-gray-200 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-gray-600" />
          <h2 className="font-semibold text-base text-gray-900">Filters</h2>
          {(selectedCashier || selectedProduct || selectedPaymentMethod || selectedPaymentStatus || startDate || endDate) && (
            <button
              onClick={clearFilters}
              className="ml-auto text-xs text-red-600 hover:text-red-700"
            >
              Clear All Filters
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Cashier Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cashier</label>
            <select
              value={selectedCashier}
              onChange={(e) => setSelectedCashier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Product</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
            >
              <option value="">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Digital">Digital</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Payment Status</label>
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
            >
              <option value="">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          {/* Start Date Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
            />
          </div>

          {/* End Date Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
            />
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-xs text-gray-600">
          Showing {filteredSales.length} of {sales.length} sales
        </div>
      </div>

      {filteredSales.length === 0 ? (
        <div className="bg-white p-6 rounded border border-gray-200 text-center">
          <p className="text-gray-500 text-sm">
            {sales.length === 0 ? 'No sales found' : 'No sales match the selected filters'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Description</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold hidden md:table-cell">Date</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Cashier</th>
                  <th className="px-3 py-2.5 text-right text-sm font-semibold">Total</th>
                  <th className="px-3 py-2.5 text-center text-sm font-semibold hidden md:table-cell">Payment</th>
                  <th className="px-3 py-2.5 text-center text-sm font-semibold hidden md:table-cell">Status</th>
                  <th className="px-3 py-2.5 text-center text-sm font-semibold">Actions</th>
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
                        className={`cursor-pointer transition-all border-b border-gray-100 ${
                          sale.payment_status === 'Partial' ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-600' :
                          'bg-white hover:bg-gray-50'
                        } ${isExpanded && sale.payment_status !== 'Partial' ? 'border-l-4 border-l-cyan-600' : ''}`}
                      >
                        <td className="px-3 py-2.5 text-sm">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                            <span className="font-normal text-gray-900">{sale.sale_description || sale.sale_number}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell text-sm text-gray-600">
                          {new Date(sale.sale_date).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-900">{sale.cashier_name || 'Unknown'}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-sm text-gray-900">
                          ${sale.total_amount.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 text-center hidden md:table-cell">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                            {sale.payment_method === 'Cash' ? (
                              <DollarSign size={14} />
                            ) : (
                              <CreditCard size={14} />
                            )}
                            {sale.payment_method}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center hidden md:table-cell">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium border ${
                              sale.payment_status === 'Paid'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : sale.payment_status === 'Partial'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }`}
                          >
                            {sale.payment_status === 'Partial' && '⚠️ '}
                            {sale.payment_status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(sale)
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors"
                            title="Edit Sale"
                          >
                            <Edit size={14} />
                            Edit
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${sale.id}-details`} className="animate-fadeIn">
                          <td colSpan={7} className={
                            sale.payment_status === 'Partial' ? 'bg-red-50' : 'bg-cyan-50'
                          }>
                            <div className="px-4 py-4 border-t border-gray-200">
                              {/* Mobile-only info */}
                              <div className="md:hidden mb-4 pb-4 border-b border-gray-200">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="text-gray-600">Date:</span>
                                    <span className="ml-2 font-medium text-gray-900">
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
                                    <span className="text-gray-600">Payment:</span>
                                    <span className="ml-2 inline-flex items-center gap-1 text-gray-900">
                                      {sale.payment_method === 'Cash' ? (
                                        <DollarSign size={12} />
                                      ) : (
                                        <CreditCard size={12} />
                                      )}
                                      {sale.payment_method}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600">Status:</span>
                                    <span className="ml-2">
                                      <span
                                        className={`inline-block px-2 py-1 rounded text-xs font-medium border ${
                                          sale.payment_status === 'Paid'
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : sale.payment_status === 'Partial'
                                            ? 'bg-red-50 text-red-700 border-red-200'
                                            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
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
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                <div className="p-3 border border-gray-200 rounded bg-white">
                                  <div className="text-xs text-gray-600 mb-1">Sale Date</div>
                                  <div className="font-semibold text-sm text-gray-900">
                                    {new Date(sale.sale_date).toLocaleString('en-US', {
                                      month: 'long',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                </div>
                                <div className="p-3 border border-gray-200 rounded bg-white">
                                  <div className="text-xs text-gray-600 mb-1">Cashier</div>
                                  <div className="font-semibold text-sm text-gray-900">{sale.cashier_name || 'Unknown'}</div>
                                </div>
                                <div className="p-3 border border-gray-200 rounded bg-white">
                                  <div className="text-xs text-gray-600 mb-1">Amount Paid</div>
                                  <div className="font-semibold text-sm text-gray-900">${sale.amount_paid?.toFixed(2) || '0.00'}</div>
                                </div>
                                <div className="p-3 border border-gray-200 rounded bg-white">
                                  <div className="text-xs text-gray-600 mb-1">Profit</div>
                                  <div className={`font-semibold text-sm ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ${profit.toFixed(2)}
                                  </div>
                                </div>
                              </div>

                              {/* Sale Items */}
                              <div className="mb-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                                  <Package size={16} className="text-gray-600" />
                                  Sale Items ({sale.sale_items?.length || 0})
                                </div>
                                <div className="border border-gray-200 rounded overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-700">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-semibold">SKU</th>
                                        <th className="px-3 py-2 text-left font-semibold">Product</th>
                                        <th className="px-3 py-2 text-center font-semibold">Qty</th>
                                        <th className="px-3 py-2 text-right font-semibold">Unit Price</th>
                                        <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sale.sale_items?.map((item: any, idx: number) => (
                                        <tr key={item.id} className="border-b border-gray-100 bg-white hover:bg-gray-50">
                                          <td className="px-3 py-2 font-mono text-xs text-gray-600">{item.product_sku || 'N/A'}</td>
                                          <td className="px-3 py-2 text-gray-900">{item.product_name || 'Unknown Product'}</td>
                                          <td className="px-3 py-2 text-center text-gray-900">{item.quantity}</td>
                                          <td className="px-3 py-2 text-right text-gray-900">${item.unit_price.toFixed(2)}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-gray-900">${item.subtotal.toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="bg-cyan-600 text-white">
                                      <tr>
                                        <td colSpan={4} className="px-3 py-2 text-right font-semibold">Total:</td>
                                        <td className="px-3 py-2 text-right font-semibold">${sale.total_amount.toFixed(2)}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>

                              {/* Payment History */}
                              {(sale as any).payments && (sale as any).payments.length > 0 && (
                                <div className="mb-3">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                                    <DollarSign size={16} className="text-gray-600" />
                                    Payment History ({(sale as any).payments.length})
                                  </div>
                                  <div className="border border-gray-200 rounded overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-50 text-gray-700">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-semibold">Date</th>
                                          <th className="px-3 py-2 text-left font-semibold">Method</th>
                                          <th className="px-3 py-2 text-left font-semibold">Recorded By</th>
                                          <th className="px-3 py-2 text-right font-semibold">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(sale as any).payments.map((payment: any, idx: number) => (
                                          <tr key={payment.id} className="border-b border-gray-100 bg-white hover:bg-gray-50">
                                            <td className="px-3 py-2 text-gray-900">
                                              {new Date(payment.payment_date).toLocaleString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </td>
                                            <td className="px-3 py-2 text-gray-900">
                                              <span className="inline-flex items-center gap-1">
                                                {payment.payment_method === 'Cash' ? (
                                                  <DollarSign size={12} />
                                                ) : (
                                                  <CreditCard size={12} />
                                                )}
                                                {payment.payment_method}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-900">{payment.recorded_by_name || 'Unknown'}</td>
                                            <td className="px-3 py-2 text-right font-semibold text-gray-900">${payment.amount.toFixed(2)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {/* Notes */}
                              {sale.notes && (
                                <div className="text-sm">
                                  <div className="font-semibold text-gray-900 mb-1">Notes:</div>
                                  <div className="text-gray-600 italic">{sale.notes}</div>
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

      {/* Edit Sale Modal */}
      {showEditModal && editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 max-w-md w-full p-5">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Edit Sale</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingSale(null)
                  setEditError('')
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600 font-medium">{editError}</p>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                <div className="mb-2">
                  <span className="font-semibold text-gray-700">Sale #:</span> <span className="text-gray-900">{editingSale.sale_number}</span>
                </div>
                <div className="mb-2">
                  <span className="font-semibold text-gray-700">Total:</span> <span className="text-gray-900">${editingSale.total_amount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Date:</span>{' '}
                  <span className="text-gray-900">
                  {new Date(editingSale.sale_date).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  Payment Method <span className="text-red-600">*</span>
                </label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                >
                  <option value="Cash">Cash</option>
                  <option value="Digital">Digital</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  Payment Status <span className="text-red-600">*</span>
                </label>
                <select
                  value={editPaymentStatus}
                  onChange={(e) => setEditPaymentStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                >
                  <option value="Paid">Paid</option>
                  <option value="Partial">Partial</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  Notes (Optional)
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600 resize-none"
                  rows={3}
                  placeholder="Add any notes about this sale..."
                  maxLength={500}
                />
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
                <p className="text-yellow-800">
                  <strong>Note:</strong> You can only edit payment details and notes. Sale items cannot be modified after creation.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingSale(null)
                    setEditError('')
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {updating ? 'Updating...' : 'Update Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Generation Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 max-w-md w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Generate Sales Record</h2>
              <p className="text-xs text-gray-600">Select filters for the sales report</p>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  Period Type <span className="text-red-600">*</span>
                </label>
                <select
                  value={pdfPeriod}
                  onChange={(e) => setPdfPeriod(e.target.value as 'day' | 'month' | 'year')}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600">
                >
                  <option value="day">Daily Report</option>
                  <option value="month">Monthly Report</option>
                  <option value="year">Yearly Report</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700">
                  {pdfPeriod === 'day' ? 'Select Date' : pdfPeriod === 'month' ? 'Select Month' : 'Select Year'} <span className="text-red-600">*</span>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                />
              </div>

              <div className="border-t-2 border-gray-300 pt-4">
                <div className="mb-3 text-sm font-bold">Optional Filters</div>
                
                {/* Cashier Filter */}
                <div className="mb-4">
                  <label className="block mb-1 font-medium text-xs text-gray-700">
                    Cashier Name
                  </label>
                  <select
                    value={pdfCashierId}
                    onChange={(e) => setPdfCashierId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600">
                    <option value="">All Cashiers</option>
                    {cashiers.map((cashier) => (
                      <option key={cashier.id} value={cashier.id}>
                        {cashier.full_name}
                      </option>
                    ))}
                  </select>
                  {pdfCashierId && cashiers.find(c => c.id === pdfCashierId) && (
                    <div className="mt-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded text-sm">
                      <span className="text-text-secondary">Phone: </span>
                      <span className="font-medium">
                        {cashiers.find(c => c.id === pdfCashierId)?.phone_number || 'N/A'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Customer Filter */}
                <div>
                  <label className="block mb-1 font-medium text-xs text-gray-700">
                    Customer Name
                  </label>
                  <select
                    value={pdfCustomerId}
                    onChange={(e) => setPdfCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600">
                  >
                    <option value="">All Customers (No Filter)</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.customer_name}
                      </option>
                    ))}
                  </select>
                  {pdfCustomerId && customers.find(c => c.id === parseInt(pdfCustomerId)) && (
                    <div className="mt-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded text-sm">
                      <span className="text-text-secondary">Phone: </span>
                      <span className="font-medium">
                        {customers.find(c => c.id === parseInt(pdfCustomerId))?.customer_phone || 'N/A'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs">
                <p className="text-gray-600">
                  The report will include sales for the selected {pdfPeriod}
                  {pdfCashierId && ' filtered by cashier'}
                  {pdfCustomerId && ' filtered by customer'}
                  . It can be printed or saved as PDF.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPdfModal(false)
                  setPdfCashierId('')
                  setPdfCustomerId('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
                disabled={generatingPdf}
              >
                Cancel
              </button>
              <button
                onClick={generatePDF}
                disabled={generatingPdf}
                className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {generatingPdf ? 'Generating...' : 'Generate PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )


}
