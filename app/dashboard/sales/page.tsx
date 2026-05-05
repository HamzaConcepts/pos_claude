'use client'

import { Fragment, useEffect, useState } from 'react'
import { CalendarIcon, UserIcon, CurrencyDollarIcon, CreditCardIcon, CaretDownIcon, CaretUpIcon, PackageIcon, FunnelIcon, FileTextIcon, PencilSimpleIcon, XIcon, PrinterIcon, TrashIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { generateSalesPDF } from '@/lib/pdf-generator'
import { supabase, getStoreId, isManager, isCashier } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import PrintReceiptButton from '@/components/PrintReceiptButton'
import { getPKTDate } from '@/lib/date-utils'
import { useCurrency } from '@/lib/currency-context'
import SalesSkeleton from '@/components/skeletons/SalesSkeleton'


export default function SalesPage() {
  const router = useRouter()
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
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [selectedCashier, setSelectedCashier] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [selectedBankAccount, setSelectedBankAccount] = useState('')
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
    fetchBankAccounts()
    fetchReceiptSettings()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [sales, selectedCashier, selectedProduct, selectedPaymentMethod, selectedBankAccount, selectedPaymentStatus, startDate, endDate])

  const normalizePaymentStatus = (status: string) =>
    status === 'Pending' ? 'Partial' : status

  const getDisplayPaymentStatus = (sale: any, ledgerCustomer?: any) => {
    if (ledgerCustomer) {
      const remaining = Number(ledgerCustomer.amount_remaining || 0)
      return remaining <= 0.01 ? 'Paid' : 'Partial'
    }

    const totalAmount = Number(sale.total_amount || 0)
    const amountPaid = Number(sale.amount_paid || 0)
    const amountDue = Number.isFinite(Number(sale.amount_due))
      ? Number(sale.amount_due)
      : Math.max(0, totalAmount - amountPaid)

    if (sale.payment_status === 'Paid' || amountPaid >= totalAmount || amountDue <= 0) {
      return 'Paid'
    }

    return normalizePaymentStatus(sale.payment_status || 'Paid')
  }

  const getLedgerAmounts = (sale: any, ledgerCustomer?: any) => {
    const amountPaid = ledgerCustomer
      ? Number(ledgerCustomer.amount_paid || 0)
      : Number(sale.amount_paid || 0)
    const totalAmount = Number(sale.total_amount || 0)
    const fallbackDue = Math.max(0, totalAmount - amountPaid)
    const amountDue = Number.isFinite(Number(sale.amount_due))
      ? Number(sale.amount_due)
      : fallbackDue
    const amountRemaining = ledgerCustomer
      ? Number(ledgerCustomer.amount_remaining || 0)
      : Math.max(0, amountDue, fallbackDue)

    return {
      amountPaid,
      amountRemaining,
    }
  }

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

  const fetchBankAccounts = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/bank-accounts?store_id=${storeId}`)
      const result = await response.json()
      if (result.success) {
        setBankAccounts(result.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch bank accounts')
    }
  }

  const fetchReceiptSettings = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const [settingsRes, storeInfoRes] = await Promise.all([
        fetch(`/api/receipt-settings?store_id=${storeId}`),
        fetch(`/api/store-info?store_id=${storeId}`),
      ])
      const settingsResult = await settingsRes.json()
      const storeInfoResult = await storeInfoRes.json()
      const storeLogo = storeInfoResult?.success ? storeInfoResult.data?.logo_url : null

      if (settingsResult.success) {
        setReceiptSettings({
          ...settingsResult.data,
          logo_url: settingsResult.data.logo_url || storeLogo,
        })
      } else if (storeLogo) {
        setReceiptSettings({ logo_url: storeLogo, show_logo: true })
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

    // Filter by bank account (digital payments only)
    if (selectedPaymentMethod === 'Digital' && selectedBankAccount) {
      filtered = filtered.filter(sale => sale.bank_account_name === selectedBankAccount)
    }

    // Filter by payment status
    if (selectedPaymentStatus) {
      filtered = filtered.filter(sale =>
        getDisplayPaymentStatus(sale, sale.partial_payment_customers?.[0]) === selectedPaymentStatus
      )
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
    setEditPaymentStatus(sale.payment_status === 'Pending' ? 'Partial' : sale.payment_status || 'Paid')
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
    setSelectedBankAccount('')
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
      const storeId = getStoreId()
      const { data: { user } } = await supabase.auth.getUser()
      const fallbackManagerId = typeof window !== 'undefined' ? sessionStorage.getItem('user_id') : null
      const managerId = user?.id || fallbackManagerId

      if (!managerId) {
        setError('Manager authentication required')
        return
      }

      if (!storeId) {
        setError('Store ID is required')
        return
      }

      const response = await fetch(`/api/sales/${deletingSale.id}?manager_id=${encodeURIComponent(managerId)}&store_id=${storeId}`, {
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

  const receiptPartialCustomer = receiptSale?.partial_payment_customers?.[0]
  const receiptCustomerName =
    (typeof receiptSale?.customer_name === 'string' ? receiptSale.customer_name.trim() : '') ||
    (typeof receiptPartialCustomer?.customer_name === 'string' ? receiptPartialCustomer.customer_name.trim() : '')
  const receiptCustomerPhone =
    (typeof receiptSale?.customer_phone === 'string' ? receiptSale.customer_phone.trim() : '') ||
    (typeof receiptPartialCustomer?.customer_phone === 'string' ? receiptPartialCustomer.customer_phone.trim() : '')
  const receiptBankAccount =
    typeof receiptSale?.bank_account_name === 'string' ? receiptSale.bank_account_name.trim() : ''
  const showReceiptDigitalCustomer =
    receiptSale?.payment_method === 'Digital' && (receiptCustomerName || receiptCustomerPhone || receiptBankAccount)

  if (loading) {
    return <SalesSkeleton />
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Sales History</h1>
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
      <div className="p-4 rounded-lg mb-5 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow dark:shadow-none">
        <div className="flex items-center gap-2 mb-4">
          <FunnelIcon size={18} className="text-gray-600 dark:text-gray-400" />
          <h2 className="font-semibold text-sm text-gray-900 dark:text-gray-300">Filters</h2>
          {(selectedCashier || selectedProduct || selectedPaymentMethod || selectedBankAccount || selectedPaymentStatus || startDate || endDate) && (
            <button
              onClick={clearFilters}
              className="ml-auto text-xs text-red-600 hover:text-red-700"
            >
              Clear All Filters
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Cashier Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-400">Cashier</label>
            <select
              value={selectedCashier}
              onChange={(e) => setSelectedCashier(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 border-gray-300 dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-gray-300"
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
            <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Product</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
            <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Payment Method</label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => {
                const method = e.target.value
                setSelectedPaymentMethod(method)
                if (method !== 'Digital') {
                  setSelectedBankAccount('')
                }
              }}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Digital">Digital</option>
            </select>
          </div>

          {/* Digital Bank Account Filter */}
          {selectedPaymentMethod === 'Digital' && (
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Bank Account</label>
              <select
                value={selectedBankAccount}
                onChange={(e) => setSelectedBankAccount(e.target.value)}
                title="Filter digital sales by bank account"
                aria-label="Bank account filter"
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">All Digital Accounts</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.account_name}>
                    {account.account_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Payment Status Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Payment Status</label>
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
            </select>
          </div>

          {/* Start Date Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-400">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 border-gray-300 dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-gray-300"
            />
          </div>

          {/* End Date Filter */}
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-400">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 border-gray-300 dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-gray-300"
            />
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
          Showing {filteredSales.length} of {sales.length} sales
        </div>
      </div>

      {filteredSales.length === 0 ? (
        <div className="p-6 rounded border text-center bg-white border-gray-200 shadow-sm dark:bg-[#0f0f0f] dark:border-gray-700 dark:dark-shadow dark:shadow-none">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {sales.length === 0 ? 'No sales found' : 'No sales match the selected filters'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow dark:shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-[#0f0f0f]">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-400">Description</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold hidden md:table-cell text-gray-700 dark:text-gray-400">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-400">Cashier</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-400">Total</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold hidden md:table-cell text-gray-700 dark:text-gray-400">Payment</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold hidden md:table-cell text-gray-700 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => {
                  const isExpanded = expandedSaleId === sale.id
                  const totalCost = sale.sale_items?.reduce(
                    (sum: number, item: any) => sum + (item.cost_price_snapshot || 0) * item.quantity,
                    0
                  ) || 0
                  const profit = sale.total_amount - totalCost
                  const partialPaymentCustomer = sale.partial_payment_customers?.[0]
                  const displayPaymentStatus = getDisplayPaymentStatus(sale, partialPaymentCustomer)
                  const ledgerAmounts = getLedgerAmounts(sale, partialPaymentCustomer)
                  const outstandingDue = displayPaymentStatus === 'Paid'
                    ? 0
                    : Math.max(0, ledgerAmounts.amountRemaining)
                  const digitalCustomerName =
                    (typeof sale.customer_name === 'string' ? sale.customer_name.trim() : '') ||
                    (typeof partialPaymentCustomer?.customer_name === 'string'
                      ? partialPaymentCustomer.customer_name.trim()
                      : '')
                  const digitalCustomerPhone =
                    (typeof sale.customer_phone === 'string' ? sale.customer_phone.trim() : '') ||
                    (typeof partialPaymentCustomer?.customer_phone === 'string'
                      ? partialPaymentCustomer.customer_phone.trim()
                      : '')
                  const digitalBankAccount =
                    typeof sale.bank_account_name === 'string' ? sale.bank_account_name.trim() : ''
                  const showDigitalCustomerDetails =
                    sale.payment_method === 'Digital' && (digitalCustomerName || digitalCustomerPhone || digitalBankAccount)
                  const partialRemaining = Number(partialPaymentCustomer?.amount_remaining || 0)
                  const isKhaataCleared = Boolean(partialPaymentCustomer) && partialRemaining <= 0.01

                  return (
                    <Fragment key={sale.id}>
                      <tr
                        onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                        className={`cursor-pointer transition-all border-b border-gray-100 dark:border-gray-800 ${
                          displayPaymentStatus === 'Partial' 
                            ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/30'
                            : 'bg-white hover:bg-gray-50 dark:bg-transparent dark:hover:bg-gray-800/50'
                        } ${isExpanded && displayPaymentStatus !== 'Partial' ? 'border-l-4 border-l-cyan-600' : ''}`}
                      >
                        <td className="px-3 py-2.5 text-sm">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <CaretUpIcon size={16} className="text-gray-400 dark:text-gray-500" /> : <CaretDownIcon size={16} className="text-gray-400 dark:text-gray-500" />}
                            <span className="font-normal text-gray-900 dark:text-gray-300">{sale.sale_description || sale.sale_number}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell text-sm text-gray-600 dark:text-gray-400">
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
                        <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-gray-300">{sale.cashier_name || 'Unknown'}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-sm text-gray-900 dark:text-gray-300">
                          <div className="flex flex-col items-end gap-1">
                            <span>{formatCurrency(sale.total_amount, 2)}</span>
                            {outstandingDue > 0 && (
                              <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
                                ⚠ Due {formatCurrency(outstandingDue, 2)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center hidden md:table-cell">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-300">
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
                              displayPaymentStatus === 'Paid'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {displayPaymentStatus === 'Partial' && '⚠️ '}
                            {displayPaymentStatus}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="animate-fadeIn">
                          <td colSpan={6} className={
                            displayPaymentStatus === 'Partial' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-cyan-50 dark:bg-cyan-900/20'
                          }>
                            <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
                              {/* Mobile-only info */}
                              <div className="md:hidden mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400">Date:</span>
                                    <span className="ml-2 font-medium text-gray-900 dark:text-white">
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
                                    <span className="text-gray-600 dark:text-gray-400">Payment:</span>
                                    <span className="ml-2 inline-flex items-center gap-1 text-gray-900 dark:text-white">
                                      {sale.payment_method === 'Cash' ? (
                                        <CurrencyDollarIcon size={12} />
                                      ) : (
                                        <CreditCardIcon size={12} />
                                      )}
                                      {sale.payment_method}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                                    <span className="ml-2">
                                      <span
                                        className={`inline-block px-2 py-1 rounded text-xs font-medium border ${
                                          displayPaymentStatus === 'Paid'
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : 'bg-red-50 text-red-700 border-red-200'
                                        }`}
                                      >
                                        {displayPaymentStatus === 'Partial' && '⚠️ '}
                                        {displayPaymentStatus}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="mb-4">
                                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Actions</p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    onClick={() => handleEdit(sale)}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors"
                                    title="Edit Sale"
                                  >
                                    <PencilSimpleIcon size={14} />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleShowReceipt(sale)}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                                    title="Show Receipt"
                                  >
                                    <FileTextIcon size={14} />
                                    Receipt
                                  </button>
                                  <PrintReceiptButton
                                    sale={sale}
                                    settings={receiptSettings || undefined}
                                    currency={currency}
                                    variant="small"
                                  />
                                  {userIsManager && (
                                    <button
                                      onClick={() => {
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
                                  {userIsCashier && !sale.marked_for_review && (
                                    <button
                                      onClick={() => {
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
                                  {sale.marked_for_review && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 border border-yellow-300 rounded">
                                      <WarningCircleIcon size={14} />
                                      Marked
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Digital Payment Customer Info */}
                              {showDigitalCustomerDetails && (
                                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded dark:bg-blue-900/20 dark:border-blue-700">
                                  <p className="font-semibold text-blue-900 dark:text-blue-300 mb-2 text-sm">
                                    DIGITAL PAYMENT CUSTOMER
                                  </p>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                    <div>
                                      <p className="text-xs text-blue-700 dark:text-blue-400">Customer Name</p>
                                      <p className="font-medium text-blue-900 dark:text-blue-200">{digitalCustomerName || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-blue-700 dark:text-blue-400">Customer Number</p>
                                      <p className="font-medium text-blue-900 dark:text-blue-200">{digitalCustomerPhone || '-'}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-blue-700 dark:text-blue-400">Bank Account</p>
                                      <p className="font-medium text-blue-900 dark:text-blue-200">{digitalBankAccount || '-'}</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Partial Payment Customer Info */}
                              {partialPaymentCustomer && !isKhaataCleared && (
                                <div className="mb-4 p-4 bg-red-600 border-2 border-red-800 rounded">
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-white font-bold">⚠️ KHAATA CUSTOMER</span>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div>
                                      <div className="text-red-100 mb-1">Customer Name</div>
                                      <div className="font-bold text-white">{partialPaymentCustomer.customer_name}</div>
                                    </div>
                                    <div>
                                      <div className="text-red-100 mb-1">CNIC</div>
                                      <div className="font-medium text-white">{partialPaymentCustomer.customer_cnic}</div>
                                    </div>
                                    <div>
                                      <div className="text-red-100 mb-1">Phone</div>
                                      <div className="font-medium text-white">{partialPaymentCustomer.customer_phone}</div>
                                    </div>
                                    <div>
                                      <div className="text-red-100 mb-1">Amount Remaining</div>
                                      <div className="font-bold text-white text-lg">
                                        {formatCurrency(partialRemaining, 2)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-3 p-2 bg-red-800 text-white rounded font-bold text-center">
                                    OUTSTANDING BALANCE DUE
                                  </div>
                                </div>
                              )}
                              {partialPaymentCustomer && isKhaataCleared && (
                                <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded">
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-emerald-700 font-bold">KHAATA CLEARED</span>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div>
                                      <div className="text-emerald-700 mb-1">Customer Name</div>
                                      <div className="font-semibold text-emerald-900">{partialPaymentCustomer.customer_name}</div>
                                    </div>
                                    <div>
                                      <div className="text-emerald-700 mb-1">CNIC</div>
                                      <div className="font-medium text-emerald-900">{partialPaymentCustomer.customer_cnic}</div>
                                    </div>
                                    <div>
                                      <div className="text-emerald-700 mb-1">Phone</div>
                                      <div className="font-medium text-emerald-900">{partialPaymentCustomer.customer_phone}</div>
                                    </div>
                                    <div>
                                      <div className="text-emerald-700 mb-1">Amount Remaining</div>
                                      <div className="font-bold text-emerald-900 text-lg">{formatCurrency(0, 2)}</div>
                                    </div>
                                  </div>
                                  <div className="mt-3 p-2 bg-emerald-100 text-emerald-800 rounded font-bold text-center">
                                    BALANCE SETTLED
                                  </div>
                                </div>
                              )}

                              {/* Sale Summary */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                <div className="p-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1a1a1a]">
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Sale Date</div>
                                  <div className="font-semibold text-sm text-gray-900 dark:text-white">
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
                                <div className="p-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1a1a1a]">
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cashier</div>
                                  <div className="font-semibold text-sm text-gray-900 dark:text-white">{sale.cashier_name || 'Unknown'}</div>
                                </div>
                                <div className="p-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1a1a1a]">
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Amount Paid</div>
                                  <div className="font-semibold text-sm text-gray-900 dark:text-white">{formatCurrency(ledgerAmounts.amountPaid || 0, 2)}</div>
                                </div>
                                <div className="p-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1a1a1a]">
                                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Profit</div>
                                  <div className={`font-semibold text-sm ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(profit, 2)}
                                  </div>
                                </div>
                              </div>

                              {/* Sale Items */}
                              <div className="mb-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                  <PackageIcon size={16} className="text-gray-600 dark:text-gray-400" />
                                  Sale Items ({sale.sale_items?.length || 0})
                                </div>
                                <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
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
                                        <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] hover:bg-gray-50 dark:hover:bg-gray-800">
                                          <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{item.product_sku || 'N/A'}</td>
                                          <td className="px-3 py-2 text-gray-900 dark:text-white">{item.product_name || 'Unknown Product'}</td>
                                          <td className="px-3 py-2 text-center text-gray-900 dark:text-white">{item.quantity}</td>
                                          <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{formatCurrency(item.unit_price, 2)}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(item.subtotal, 2)}</td>
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
                                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                    <CurrencyDollarIcon size={16} className="text-gray-600 dark:text-gray-400" />
                                    Payment History ({(sale as any).payments.length})
                                  </div>
                                  <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-semibold">Date</th>
                                          <th className="px-3 py-2 text-left font-semibold">Method</th>
                                          <th className="px-3 py-2 text-left font-semibold">Recorded By</th>
                                          <th className="px-3 py-2 text-right font-semibold">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(sale as any).payments.map((payment: any, idx: number) => (
                                          <tr key={payment.id} className="border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] hover:bg-gray-50 dark:hover:bg-gray-800">
                                            <td className="px-3 py-2 text-gray-900 dark:text-white">
                                              {new Date(payment.payment_date).toLocaleString('en-PK', {
                                                timeZone: 'Asia/Karachi',
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </td>
                                            <td className="px-3 py-2 text-gray-900 dark:text-white">
                                              <span className="inline-flex items-center gap-1">
                                                {payment.payment_method === 'Cash' ? (
                                                  <CurrencyDollarIcon size={12} />
                                                ) : (
                                                  <CreditCardIcon size={12} />
                                                )}
                                                {payment.payment_method}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-900 dark:text-white">{payment.recorded_by_name || 'Unknown'}</td>
                                            <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(payment.amount, 2)}</td>
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
                                  <div className="font-semibold text-gray-900 dark:text-white mb-1">Notes:</div>
                                  <div className="text-gray-600 dark:text-gray-400 italic">{sale.notes}</div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Sale</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingSale(null)
                  setEditError('')
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
              <div className="p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded text-sm">
                <div className="mb-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Sale #:</span> <span className="text-gray-900 dark:text-white">{editingSale.sale_number}</span>
                </div>
                <div className="mb-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Total:</span> <span className="text-gray-900 dark:text-white">${editingSale.total_amount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Date:</span>{' '}
                  <span className="text-gray-900 dark:text-white">
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
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Payment Method <span className="text-red-600">*</span>
                </label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="Digital">Digital</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Payment Status <span className="text-red-600">*</span>
                </label>
                <select
                  value={editPaymentStatus}
                  onChange={(e) => setEditPaymentStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="Paid">Paid</option>
                  <option value="Partial">Partial</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Notes (Optional)
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
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
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Generate Sales Record</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">Select filters for the sales report</p>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                  Period Type <span className="text-red-600">*</span>
                </label>
                <select
                  value={pdfPeriod}
                  onChange={(e) => setPdfPeriod(e.target.value as 'day' | 'month' | 'year')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                  <option value="day">Daily Report</option>
                  <option value="month">Monthly Report</option>
                  <option value="year">Yearly Report</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-4">
                <div className="mb-3 text-sm font-bold dark:text-white">Optional Filters</div>
                
                {/* Cashier Filter */}
                <div className="mb-4">
                  <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                    Cashier Name
                  </label>
                  <select
                    value={pdfCashierId}
                    onChange={(e) => setPdfCashierId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    <option value="">All Cashiers</option>
                    {cashiers.map((cashier) => (
                      <option key={cashier.id} value={cashier.id}>
                        {cashier.full_name}
                      </option>
                    ))}
                  </select>
                  {pdfCashierId && cashiers.find(c => c.id === pdfCashierId) && (
                    <div className="mt-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm dark:text-gray-300">
                      <span className="text-gray-500 dark:text-gray-400">Cashier: </span>
                      <span className="font-medium">{cashiers.find(c => c.id === pdfCashierId)?.full_name}</span>
                    </div>
                  )}
                </div>

                {/* Customer Filter */}
                <div>
                  <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                    Customer Name
                  </label>
                  <select
                    value={pdfCustomerId}
                    onChange={(e) => setPdfCustomerId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    <option value="">All Customers (No Filter)</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.customer_name}
                      </option>
                    ))}
                  </select>
                  {pdfCustomerId && customers.find(c => c.id === parseInt(pdfCustomerId)) && (
                    <div className="mt-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm dark:text-gray-300">
                      <span className="text-text-secondary">Phone: </span>
                      <span className="font-medium">
                        {customers.find(c => c.id === parseInt(pdfCustomerId))?.customer_phone || 'N/A'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded text-xs">
                <p className="text-gray-600 dark:text-gray-400">
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
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
                disabled={generatingPdf}
              >
                Cancel
              </button>
              <button
                onClick={generatePDF}
                disabled={generatingPdf}
                className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
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
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header (print:hidden) */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 print:hidden">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sale Receipt</h2>
              <button
                onClick={() => {
                  setShowReceiptModal(false)
                  setReceiptSale(null)
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XIcon size={20} />
              </button>
            </div>

            {/* Receipt Content */}
            <div className="p-6">
              <div className="text-center mb-5">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{receiptSettings?.business_name || 'Atom'}</h1>
                {receiptSettings?.business_address && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{receiptSettings.business_address}</p>
                )}
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
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

              <div className="mb-5 border-t border-b border-gray-200 dark:border-gray-700 py-4">
                {(() => {
                  const normalizedReceiptStatus = normalizePaymentStatus(receiptSale.payment_status)
                  return (
                    <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Sale Number</p>
                    <p className="font-mono font-semibold text-gray-900 dark:text-white">{receiptSale.sale_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Date</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(receiptSale.sale_date).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', hour12: true })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Cashier</p>
                    <p className="font-medium text-gray-900 dark:text-white">{receiptSale.cashier_name || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Payment Method</p>
                    <p className="font-medium text-gray-900 dark:text-white">{receiptSale.payment_method}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Payment Status</p>
                    <p className={`font-medium ${normalizedReceiptStatus === 'Partial' ? 'text-red-600' : 'text-gray-900'}`}>
                      {normalizedReceiptStatus}
                      {normalizedReceiptStatus === 'Partial' && ' ⚠️'}
                    </p>
                  </div>
                </div>

                {showReceiptDigitalCustomer && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded dark:bg-blue-900/20 dark:border-blue-700">
                    <p className="font-semibold text-blue-900 dark:text-blue-300 mb-2 text-sm">
                      DIGITAL PAYMENT CUSTOMER
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-blue-700 dark:text-blue-400">Name</p>
                        <p className="font-medium text-blue-900 dark:text-blue-200">{receiptCustomerName || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700 dark:text-blue-400">Number</p>
                        <p className="font-medium text-blue-900 dark:text-blue-200">{receiptCustomerPhone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-700 dark:text-blue-400">Bank Account</p>
                        <p className="font-medium text-blue-900 dark:text-blue-200">{receiptBankAccount || '-'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show customer info for partial payments */}
                {normalizedReceiptStatus === 'Partial' && receiptSale.partial_payment_customers && receiptSale.partial_payment_customers.length > 0 && (
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
                          {currency} {receiptSale.partial_payment_customers[0].amount_remaining.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                    </>
                  )
                })()}
              </div>

              <table className="w-full mb-5">
                <thead className="border-b border-gray-300 dark:border-gray-600">
                  <tr className="text-sm">
                    <th className="text-left py-2 text-gray-700 dark:text-gray-300">Item</th>
                    <th className="text-right py-2 text-gray-700 dark:text-gray-300">Qty</th>
                    <th className="text-right py-2 text-gray-700 dark:text-gray-300">Price</th>
                    <th className="text-right py-2 text-gray-700 dark:text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptSale.sale_items?.map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-2 text-sm text-gray-900 dark:text-white">{item.product_name || item.products?.name || 'Unknown Product'}</td>
                      <td className="text-right text-sm text-gray-900 dark:text-white">{item.quantity}</td>
                      <td className="text-right text-sm text-gray-900 dark:text-white">{currency} {item.unit_price.toFixed(2)}</td>
                      <td className="text-right font-medium text-sm text-gray-900 dark:text-white">
                        {currency} {item.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-gray-300 dark:border-gray-600 pt-4">
                {receiptSale.discount_value > 0 && (
                  <>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                      <span className="text-gray-900 dark:text-white">
                        {currency} {(
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
                        -{currency} {(
                          receiptSale.discount_type === 'percentage'
                            ? (receiptSale.total_amount / (1 - receiptSale.discount_value / 100)) * (receiptSale.discount_value / 100)
                            : receiptSale.discount_value
                        ).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-lg font-bold mb-2 text-gray-900 dark:text-white">
                  <span>Total:</span>
                  <span>{currency} {receiptSale.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Amount Paid:</span>
                  <span className="text-gray-900 dark:text-white">{currency} {receiptSale.amount_paid.toFixed(2)}</span>
                </div>
                {normalizePaymentStatus(receiptSale.payment_status) === 'Partial' ? (
                  <div className="flex justify-between text-base font-medium text-red-600">
                    <span>Amount Due:</span>
                    <span>{currency} {receiptSale.amount_due.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-base font-medium text-gray-900 dark:text-white">
                    <span>Change:</span>
                    <span>{currency} {(receiptSale.amount_paid - receiptSale.total_amount).toFixed(2)}</span>
                  </div>
                )}
                
                {/* Additional warning for partial payment */}
                {normalizePaymentStatus(receiptSale.payment_status) === 'Partial' && (
                  <div className="mt-4 p-3 bg-red-600 text-white rounded font-semibold text-center text-sm">
                    ⚠️ OUTSTANDING BALANCE DUE ⚠️
                  </div>
                )}
              </div>

              <div className="mt-5 text-center text-sm text-gray-600 dark:text-gray-400">
                <p>{receiptSettings?.thank_you_message || 'Thank you for your business!'}</p>
                {receiptSettings?.return_policy && (
                  <p className="text-xs mt-2">{receiptSettings.return_policy}</p>
                )}
              </div>
            </div>

            {/* Modal Actions (print:hidden) */}
            <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700 print:hidden">
              <PrintReceiptButton
                sale={receiptSale}
                settings={receiptSettings || undefined}
                currency={currency}
                className="flex-1"
              />
              <button
                onClick={() => {
                  setShowReceiptModal(false)
                  setReceiptSale(null)
                }}
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2.5 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors dark:text-gray-300"
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
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
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

            <div className="mb-4 p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded text-sm">
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Sale #:</span>{' '}
                <span className="text-gray-900 dark:text-white">{deletingSale.sale_description || deletingSale.sale_number}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Total:</span>{' '}
                <span className="text-gray-900 dark:text-white">{currency} {deletingSale.total_amount.toFixed(2)}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Date:</span>{' '}
                <span className="text-gray-900 dark:text-white">
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
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
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
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              Mark for Review
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

            <div className="mb-4 p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded text-sm">
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Sale #:</span>{' '}
                <span className="text-gray-900 dark:text-white">{reviewingSale.sale_description || reviewingSale.sale_number}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Total:</span>{' '}
                <span className="text-gray-900 dark:text-white">${reviewingSale.total_amount.toFixed(2)}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Date:</span>{' '}
                <span className="text-gray-900 dark:text-white">
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
              <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Review Note*</label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
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
