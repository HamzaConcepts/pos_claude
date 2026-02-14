'use client'

import { useEffect, useState } from 'react'
import { CalendarIcon, UserIcon, CurrencyDollarIcon, CreditCardIcon, CaretDownIcon, CaretUpIcon, PackageIcon, FunnelIcon, FileTextIcon, PencilSimpleIcon, XIcon, PrinterIcon, TrashIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { generateSalesPDF } from '@/lib/pdf-generator'
import { getStoreId, isManager, isCashier } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useDarkMode } from '@/hooks/useDarkMode'
import PrintReceiptButton from '@/components/PrintReceiptButton'
import { getPKTDate } from '@/lib/date-utils'
import { useCurrency } from '@/lib/currency-context'


export default function SalesPage() {
  const router = useRouter()
  const isDarkMode = useDarkMode()
  const { currency, formatCurrency } = useCurrency()
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
  const [pdfDate, setPdfDate] = useState(getPKTDate())
  const [pdfCashierId, setPdfCashierId] = useState('')
  const [pdfCustomerId, setPdfCustomerId] = useState('')
  const [generatingPdf, setGeneratingPdf] = useState(false)

  // Receipt modal states
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [receiptSale, setReceiptSale] = useState<any>(null)

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSale, setEditingSale] = useState<any>(null)
  const [editPaymentMethod, setEditPaymentMethod] = useState('')
  const [editPaymentStatus, setEditPaymentStatus] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [updating, setUpdating] = useState(false)
  const [editError, setEditError] = useState('')

  // Role-based access states
  const [userIsManager, setUserIsManager] = useState(false)
  const [userIsCashier, setUserIsCashier] = useState(false)

  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingSale, setDeletingSale] = useState<any>(null)

  // Mark for review modal states
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewingSale, setReviewingSale] = useState<any>(null)
  const [reviewNote, setReviewNote] = useState('')
  
  // Receipt settings for preview
  const [receiptSettings, setReceiptSettings] = useState<any>(null)

  useEffect(() => {
    // Check user role
    const checkRole = async () => {
      setUserIsManager(await isManager())
      setUserIsCashier(isCashier())
    }
    checkRole()
    
    fetchSales()
    fetchCashiers()
    fetchProducts()
    fetchCustomers()
    fetchReceiptSettings()
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

  const fetchReceiptSettings = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/receipt-settings?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setReceiptSettings(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch receipt settings:', err)
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

  const handleShowReceipt = (sale: any) => {
    setReceiptSale(sale)
    setShowReceiptModal(true)
  }

  const handlePrintReceipt = () => {
    window.print()
  }

  const handleDeleteSale = async () => {
    if (!deletingSale) return
    
    try {
      const response = await fetch(`/api/sales/${deletingSale.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setShowDeleteModal(false)
        setDeletingSale(null)
        fetchSales()
        setError('')
      } else {
        setError(result.error || 'Failed to delete sale')
      }
    } catch (err) {
      setError('Failed to delete sale: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const handleMarkForReview = async () => {
    if (!reviewingSale) return
    
    try {
      const response = await fetch(`/api/sales/${reviewingSale.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marked_for_review: true,
          review_note: reviewNote
        })
      })

      const result = await response.json()

      if (result.success) {
        setShowReviewModal(false)
        setReviewingSale(null)
        setReviewNote('')
        fetchSales()
        setError('')
      } else {
        setError(result.error || 'Failed to mark sale for review')
      }
    } catch (err) {
      setError('Failed to mark sale for review: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${isDarkMode ? 'border-cyan-500' : 'border-black'}`}></div>
          <p className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading sales...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-5">
        <h1 className={`text-xl md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Sales History</h1>
        <button
          onClick={() => setShowPdfModal(true)}
          className="px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors flex items-center gap-2"
        >
          <FileTextIcon size={16} />
          Sales Record
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className={`p-4 rounded-lg mb-5 ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
        <div className="flex items-center gap-2 mb-4">
          <FunnelIcon size={18} className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
          <h2 className={`font-semibold text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>Filters</h2>
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
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>Cashier</label>
            <select
              value={selectedCashier}
              onChange={(e) => setSelectedCashier(e.target.value)}
              className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 ${isDarkMode ? 'bg-[#1a1a1a] border-gray-600 text-gray-300' : 'border-gray-300'}`}
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
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Product</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
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
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Payment Method</label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
            >
              <option value="">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Digital">Digital</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Payment Status</label>
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}`}
            >
              <option value="">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          {/* Start Date Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 ${isDarkMode ? 'bg-[#1a1a1a] border-gray-600 text-gray-300' : 'border-gray-300'}`}
            />
          </div>

          {/* End Date Filter */}
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 ${isDarkMode ? 'bg-[#1a1a1a] border-gray-600 text-gray-300' : 'border-gray-300'}`}
            />
          </div>
        </div>

        {/* Results Count */}
        <div className={`mt-4 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Showing {filteredSales.length} of {sales.length} sales
        </div>
      </div>

      {filteredSales.length === 0 ? (
        <div className={`p-6 rounded border text-center ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 dark-shadow' : 'bg-white border-gray-200 shadow-sm'}`}>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {sales.length === 0 ? 'No sales found' : 'No sales match the selected filters'}
          </p>
        </div>
      ) : (
        <div className={`rounded-lg overflow-hidden ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${isDarkMode ? 'bg-[#0f0f0f]' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-3 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>Description</th>
                  <th className={`px-3 py-3 text-left text-xs font-semibold hidden md:table-cell ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>Date</th>
                  <th className={`px-3 py-3 text-left text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>Cashier</th>
                  <th className={`px-3 py-3 text-right text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>Total</th>
                  <th className={`px-3 py-3 text-center text-xs font-semibold hidden md:table-cell ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>Payment</th>
                  <th className={`px-3 py-3 text-center text-xs font-semibold hidden md:table-cell ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>Status</th>
                  <th className={`px-3 py-3 text-center text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>Actions</th>
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
                        className={`cursor-pointer transition-all border-b ${
                          isDarkMode ? 'border-gray-800' : 'border-gray-100'
                        } ${
                          sale.payment_status === 'Partial' 
                            ? (isDarkMode ? 'bg-red-900/20 hover:bg-red-900/30 border-l-4 border-l-red-600' : 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-600')
                            : (isDarkMode ? 'hover:bg-gray-800/50' : 'bg-white hover:bg-gray-50')
                        } ${isExpanded && sale.payment_status !== 'Partial' ? 'border-l-4 border-l-cyan-600' : ''}`}
                      >
                        <td className="px-3 py-2.5 text-sm">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <CaretUpIcon size={16} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} /> : <CaretDownIcon size={16} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />}
                            <span className={`font-normal ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{sale.sale_description || sale.sale_number}</span>
                          </div>
                        </td>
                        <td className={`px-3 py-2.5 hidden md:table-cell text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {new Date(sale.sale_date).toLocaleString('en-PK', {
                            timeZone: 'Asia/Karachi',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </td>
                        <td className={`px-3 py-2.5 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{sale.cashier_name || 'Unknown'}</td>
                        <td className={`px-3 py-2.5 text-right font-semibold text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                          {formatCurrency(sale.total_amount, 2)}
                        </td>
                        <td className="px-3 py-2.5 text-center hidden md:table-cell">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                            {sale.payment_method === 'Cash' ? (
                              <CurrencyDollarIcon size={14} />
                            ) : (
                              <CreditCardIcon size={14} />
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
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEdit(sale)
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors"
                              title="Edit Sale"
                            >
                              <PencilSimpleIcon size={14} />
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleShowReceipt(sale)
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                              title="Show Receipt"
                            >
                              <FileTextIcon size={14} />
                              Receipt
                            </button>
                            <div onClick={(e) => e.stopPropagation()}>
                              <PrintReceiptButton
                                saleId={sale.id}
                                variant="small"
                              />
                            </div>
                            {/* Manager only: Delete button */}
                            {userIsManager && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeletingSale(sale)
                                  setShowDeleteModal(true)
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                title="Delete Sale"
                              >
                                <TrashIcon size={14} />
                                Delete
                              </button>
                            )}
                            {/* Cashier only: Mark for Review button */}
                            {userIsCashier && !sale.marked_for_review && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setReviewingSale(sale)
                                  setShowReviewModal(true)
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                                title="Mark for Review"
                              >
                                <WarningCircleIcon size={14} />
                                Review
                              </button>
                            )}
                            {/* Show indicator if already marked for review */}
                            {sale.marked_for_review && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 border border-yellow-300 rounded">
                                <WarningCircleIcon size={14} />
                                Marked
                              </span>
                            )}
                          </div>
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
                                      {new Date(sale.sale_date).toLocaleDateString('en-PK', {
                                        timeZone: 'Asia/Karachi',
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
                                        <CurrencyDollarIcon size={12} />
                                      ) : (
                                        <CreditCardIcon size={12} />
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
                                        {formatCurrency((sale as any).partial_payment_customers[0].amount_remaining, 2)}
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
                                    {new Date(sale.sale_date).toLocaleString('en-PK', {
                                      timeZone: 'Asia/Karachi',
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
                                  <div className="font-semibold text-sm text-gray-900">{formatCurrency(sale.amount_paid || 0, 2)}</div>
                                </div>
                                <div className="p-3 border border-gray-200 rounded bg-white">
                                  <div className="text-xs text-gray-600 mb-1">Profit</div>
                                  <div className={`font-semibold text-sm ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(profit, 2)}
                                  </div>
                                </div>
                              </div>

                              {/* Sale Items */}
                              <div className="mb-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                                  <PackageIcon size={16} className="text-gray-600" />
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
                                          <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(item.unit_price, 2)}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(item.subtotal, 2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="bg-cyan-600 text-white">
                                      <tr>
                                        <td colSpan={4} className="px-3 py-2 text-right font-semibold">Total:</td>
                                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(sale.total_amount, 2)}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>

                              {/* Payment History */}
                              {(sale as any).payments && (sale as any).payments.length > 0 && (
                                <div className="mb-3">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                                    <CurrencyDollarIcon size={16} className="text-gray-600" />
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
                                              {new Date(payment.payment_date).toLocaleString('en-PK', {
                                                timeZone: 'Asia/Karachi',
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
                                                  <CurrencyDollarIcon size={12} />
                                                ) : (
                                                  <CreditCardIcon size={12} />
                                                )}
                                                {payment.payment_method}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-900">{payment.recorded_by_name || 'Unknown'}</td>
                                            <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(payment.amount, 2)}</td>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
                <XIcon size={20} />
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
                  {new Date(editingSale.sale_date).toLocaleString('en-PK', {
                    timeZone: 'Asia/Karachi',
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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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

      {/* Receipt Modal */}
      {showReceiptModal && receiptSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:bg-white">
          <div className="bg-white rounded border border-gray-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header (print:hidden) */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 print:hidden">
              <h2 className="text-lg font-semibold text-gray-900">Sale Receipt</h2>
              <button
                onClick={() => {
                  setShowReceiptModal(false)
                  setReceiptSale(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Receipt Content */}
            <div className="p-6">
              <div className="text-center mb-5">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{receiptSettings?.business_name || 'POS System'}</h1>
                {receiptSettings?.business_address && (
                  <p className="text-sm text-gray-600 mt-1">{receiptSettings.business_address}</p>
                )}
                <div className="text-xs text-gray-600 mt-2">
                  {receiptSettings?.business_phone && (
                    <p>Tel: {receiptSettings.business_phone}</p>
                  )}
                  {receiptSettings?.business_email && (
                    <p>{receiptSettings.business_email}</p>
                  )}
                  {receiptSettings?.show_tax_id && receiptSettings?.tax_id && (
                    <p className="mt-1">Tax ID: {receiptSettings.tax_id}</p>
                  )}
                </div>
              </div>

              <div className="mb-5 border-t border-b border-gray-200 py-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-600">Sale Number</p>
                    <p className="font-mono font-semibold text-gray-900">{receiptSale.sale_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(receiptSale.sale_date).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', hour12: true })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Cashier</p>
                    <p className="font-medium text-gray-900">{receiptSale.cashier_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Payment Method</p>
                    <p className="font-medium text-gray-900">{receiptSale.payment_method}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Payment Status</p>
                    <p className={`font-medium ${receiptSale.payment_status === 'Partial' ? 'text-red-600' : 'text-gray-900'}`}>
                      {receiptSale.payment_status}
                      {receiptSale.payment_status === 'Partial' && ' ⚠️'}
                    </p>
                  </div>
                </div>

                {/* Show customer info for partial payments */}
                {receiptSale.payment_status === 'Partial' && receiptSale.partial_payment_customers && receiptSale.partial_payment_customers.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="font-semibold text-red-900 mb-2 flex items-center gap-2 text-sm">
                      <span>⚠️</span> PARTIAL PAYMENT CUSTOMER
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-red-700">Name</p>
                        <p className="font-medium text-red-900">{receiptSale.partial_payment_customers[0].customer_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-red-700">Phone</p>
                        <p className="font-medium text-red-900">{receiptSale.partial_payment_customers[0].customer_phone}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-red-700">Amount Remaining</p>
                        <p className="font-bold text-red-900 text-base">
                          ${receiptSale.partial_payment_customers[0].amount_remaining.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <table className="w-full mb-5">
                <thead className="border-b border-gray-300">
                  <tr className="text-sm">
                    <th className="text-left py-2 text-gray-700">Item</th>
                    <th className="text-right py-2 text-gray-700">Qty</th>
                    <th className="text-right py-2 text-gray-700">Price</th>
                    <th className="text-right py-2 text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptSale.sale_items?.map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-200">
                      <td className="py-2 text-sm text-gray-900">{item.product_name || item.products?.name || 'Unknown Product'}</td>
                      <td className="text-right text-sm text-gray-900">{item.quantity}</td>
                      <td className="text-right text-sm text-gray-900">${item.unit_price.toFixed(2)}</td>
                      <td className="text-right font-medium text-sm text-gray-900">
                        ${item.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-gray-300 pt-4">
                {receiptSale.discount_value > 0 && receiptSale.discount_type !== 'none' && (
                  <>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="text-gray-900">
                        ${(
                          receiptSale.discount_type === 'percentage'
                            ? receiptSale.total_amount / (1 - receiptSale.discount_value / 100)
                            : receiptSale.total_amount + receiptSale.discount_value
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between mb-2 text-green-600 text-sm">
                      <span>
                        Discount ({receiptSale.discount_type === 'percentage' ? `${receiptSale.discount_value}%` : 'Amount'}):
                      </span>
                      <span>
                        -${(
                          receiptSale.discount_type === 'percentage'
                            ? (receiptSale.total_amount / (1 - receiptSale.discount_value / 100)) * (receiptSale.discount_value / 100)
                            : receiptSale.discount_value
                        ).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-lg font-bold mb-2 text-gray-900">
                  <span>Total:</span>
                  <span>${receiptSale.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="text-gray-900">${receiptSale.amount_paid.toFixed(2)}</span>
                </div>
                {receiptSale.payment_status === 'Partial' ? (
                  <div className="flex justify-between text-base font-medium text-red-600">
                    <span>Amount Due:</span>
                    <span>${receiptSale.amount_due.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-base font-medium text-gray-900">
                    <span>Change:</span>
                    <span>${(receiptSale.amount_paid - receiptSale.total_amount).toFixed(2)}</span>
                  </div>
                )}
                
                {/* Additional warning for partial payment */}
                {receiptSale.payment_status === 'Partial' && (
                  <div className="mt-4 p-3 bg-red-600 text-white rounded font-semibold text-center text-sm">
                    ⚠️ OUTSTANDING BALANCE DUE ⚠️
                  </div>
                )}
              </div>

              <div className="mt-5 text-center text-sm text-gray-600">
                <p>{receiptSettings?.thank_you_message || 'Thank you for your business!'}</p>
                {receiptSettings?.return_policy && (
                  <p className="text-xs mt-2">{receiptSettings.return_policy}</p>
                )}
              </div>
            </div>

            {/* Modal Actions (print:hidden) */}
            <div className="flex gap-3 p-4 border-t border-gray-200 print:hidden">
              <PrintReceiptButton
                sale={receiptSale}
                showFormatOptions={true}
                defaultFormat="pdf"
                className="flex-1"
              />
              <button
                onClick={() => {
                  setShowReceiptModal(false)
                  setReceiptSale(null)
                }}
                className="flex-1 bg-white border border-gray-300 px-4 py-2.5 rounded text-sm hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Sale Modal */}
      {showDeleteModal && deletingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrashIcon size={20} className="text-red-600" />
              Delete Sale
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-900 mb-3">
                Are you sure you want to delete this sale? This action will:
              </p>
              <ul className="text-sm text-red-800 list-disc list-inside space-y-1">
                <li>Permanently remove the sale record</li>
                <li>Restore product stock quantities</li>
                <li>Restore IMEI numbers if applicable</li>
                <li>Cannot be undone</li>
              </ul>
            </div>

            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Sale #:</span>{' '}
                <span className="text-gray-900">{deletingSale.sale_description || deletingSale.sale_number}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Total:</span>{' '}
                <span className="text-gray-900">${deletingSale.total_amount.toFixed(2)}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Date:</span>{' '}
                <span className="text-gray-900">
                  {new Date(deletingSale.sale_date).toLocaleString('en-PK', {
                    timeZone: 'Asia/Karachi',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletingSale(null)
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSale}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
              >
                Delete Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark for Review Modal */}
      {showReviewModal && reviewingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-gray-200 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <WarningCircleIcon size={20} className="text-yellow-600" />
              Mark Sale for Review
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
              <p className="text-yellow-900">
                This will flag the sale for manager review. Add a note explaining why this sale needs attention.
              </p>
            </div>

            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Sale #:</span>{' '}
                <span className="text-gray-900">{reviewingSale.sale_description || reviewingSale.sale_number}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700">Total:</span>{' '}
                <span className="text-gray-900">${reviewingSale.total_amount.toFixed(2)}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Date:</span>{' '}
                <span className="text-gray-900">
                  {new Date(reviewingSale.sale_date).toLocaleString('en-PK', {
                    timeZone: 'Asia/Karachi',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>

            <div className="mb-5">
              <label className="block mb-1 font-medium text-xs text-gray-700">Review Note*</label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                rows={4}
                placeholder="Explain why this sale needs review..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReviewModal(false)
                  setReviewingSale(null)
                  setReviewNote('')
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkForReview}
                className="flex-1 px-3 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition-colors"
                disabled={!reviewNote.trim()}
              >
                Mark for Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
