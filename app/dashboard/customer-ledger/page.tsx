'use client'

import { Fragment, useEffect, useState } from 'react'
import { MagnifyingGlassIcon, TrashIcon, CaretDownIcon, CaretRightIcon, CurrencyDollarIcon, ReceiptIcon, DownloadSimpleIcon } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { getStoreId, supabase } from '@/lib/supabase'
import { useCurrency } from '@/lib/currency-context'
import { generateCustomerLedgerPDF } from '@/lib/pdf-generator'

interface KhaataCustomer {
  id: number
  sale_id: number
  customer_name: string
  customer_phone: string
  total_amount: number
  amount_paid: number
  amount_remaining: number
  notes: string | null
  store_id: number
  created_at: string
  updated_at?: string
  sales?: {
    sale_description: string | null
    sale_number: string | null
    sale_items?: LedgerSaleItem[]
  }
}

interface LedgerSaleItem {
  product_name: string | null
  product_sku: string | null
  quantity: number
  unit_price: number
  subtotal: number
}

interface AggregatedCustomer {
  customer_name: string
  customer_phone: string
  total_amount: number
  amount_paid: number
  amount_remaining: number
  transactions: KhaataCustomer[]
}

interface InitialCustomer {
  id: number
  customer_name: string
  customer_cnic: string | null
  customer_phone: string | null
  amount_owed: number
  notes: string | null
  created_at: string
}

interface OrderCustomer {
  customer_name: string
  customer_phone: string | null
  last_sale_date: string
}

interface BankAccount {
  id: number
  account_name: string
}

interface CustomerPaymentHistory {
  id: number
  partial_payment_customer_id: number | null
  sale_id: number | null
  customer_name: string
  customer_phone: string
  payment_amount: number
  payment_date: string
  payment_method: string
  bank_account_name: string | null
  notes: string | null
  payment_reference: string | null
  transaction_remaining_before: number | null
  transaction_remaining_after: number | null
  customer_remaining_before: number | null
  customer_remaining_after: number | null
}

export default function CustomerLedgerPage() {
  const router = useRouter()
  const { currency, formatCurrency } = useCurrency()
  const [customers, setCustomers] = useState<KhaataCustomer[]>([])
  const [initialCustomers, setInitialCustomers] = useState<InitialCustomer[]>([])
  const [orderCustomers, setOrderCustomers] = useState<OrderCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set())

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<KhaataCustomer | null>(null)
  const [editFormData, setEditFormData] = useState({
    amount_paid: '',
    notes: ''
  })

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<KhaataCustomer | null>(null)

  // Pay Dues modal states
  const [showPayDuesModal, setShowPayDuesModal] = useState(false)
  const [selectedForPayment, setSelectedForPayment] = useState<any>(null)
  const [paymentFormData, setPaymentFormData] = useState({
    payment_amount: '',
    payment_method: 'Cash',
    notes: ''
  })
  const [isSplitPayment, setIsSplitPayment] = useState(false)
  const [cashPaid, setCashPaid] = useState('')
  const [digitalPaid, setDigitalPaid] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false)
  const [selectedBankAccount, setSelectedBankAccount] = useState('')
  const [recorderManagerId, setRecorderManagerId] = useState<string | null>(null)
  const [recorderCashierId, setRecorderCashierId] = useState<number | null>(null)

  // Payment history per transaction (keyed by partial_payment_customers.id)
  const [paymentHistoryByTxnId, setPaymentHistoryByTxnId] = useState<Record<number, any[]>>({})
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState<Record<number, boolean>>({})
  const [expandedTxnIds, setExpandedTxnIds] = useState<Set<number>>(new Set())
  const [customerPaymentHistoryByPhone, setCustomerPaymentHistoryByPhone] = useState<Record<string, CustomerPaymentHistory[]>>({})
  const [customerPaymentHistoryLoading, setCustomerPaymentHistoryLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    resolvePaymentRecorder()
    fetchCustomers()
    fetchInitialCustomers()
    fetchOrderCustomers()
    fetchBankAccounts()
  }, [])

  const resolvePaymentRecorder = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        setRecorderManagerId(user.id)
        setRecorderCashierId(null)
        return
      }

      const userSession = localStorage.getItem('user_session')
      if (userSession) {
        const parsed = JSON.parse(userSession)
        const parsedCashierId = Number.parseInt(String(parsed?.id), 10)
        if (!Number.isNaN(parsedCashierId)) {
          setRecorderManagerId(null)
          setRecorderCashierId(parsedCashierId)
          return
        }
      }

      setRecorderManagerId(null)
      setRecorderCashierId(null)
    } catch (err) {
      console.error('Failed to resolve payment recorder:', err)
      setRecorderManagerId(null)
      setRecorderCashierId(null)
    }
  }

  const parseAmountValue = (value: string) => {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const getPaidTotal = () => {
    if (isSplitPayment) {
      return parseAmountValue(cashPaid) + parseAmountValue(digitalPaid)
    }

    return parseAmountValue(paymentFormData.payment_amount)
  }

  const hasDigitalPayment = () => {
    if (isSplitPayment) {
      return parseAmountValue(digitalPaid) > 0
    }

    return paymentFormData.payment_method === 'Digital'
  }

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        router.push('/login')
        return
      }

      const response = await fetch(`/api/partial-payment-customers?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setCustomers(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to fetch customers')
    } finally {
      setLoading(false)
    }
  }

  const fetchInitialCustomers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/initial-customers?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setInitialCustomers(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch initial customers:', err)
    }
  }

  const fetchOrderCustomers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/customer-contacts?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setOrderCustomers(result.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch order customers:', err)
    }
  }

  const fetchBankAccounts = async () => {
    try {
      setBankAccountsLoading(true)
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/bank-accounts?store_id=${storeId}`, {
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success) {
        setBankAccounts(result.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch bank accounts:', err)
    } finally {
      setBankAccountsLoading(false)
    }
  }

  const aggregateCustomers = (): AggregatedCustomer[] => {
    const grouped = new Map<string, AggregatedCustomer>()

    customers.forEach(customer => {
      const key = customer.customer_phone
      if (!grouped.has(key)) {
        grouped.set(key, {
          customer_name: customer.customer_name,
          customer_phone: customer.customer_phone,
          total_amount: 0,
          amount_paid: 0,
          amount_remaining: 0,
          transactions: []
        })
      }
      
      const agg = grouped.get(key)!
      agg.total_amount += customer.total_amount
      agg.amount_paid += customer.amount_paid
      agg.amount_remaining += customer.amount_remaining
      agg.transactions.push(customer)
    })

    return Array.from(grouped.values()).sort((a, b) => 
      b.amount_remaining - a.amount_remaining
    )
  }

  const toggleCustomerExpansion = (phone: string) => {
    const newExpanded = new Set(expandedCustomers)
    if (newExpanded.has(phone)) {
      newExpanded.delete(phone)
    } else {
      newExpanded.add(phone)
      fetchCustomerPaymentHistory(phone)
    }
    setExpandedCustomers(newExpanded)
  }

  const fetchTxnPaymentHistory = async (txnId: number, saleId: number) => {
    if (paymentHistoryByTxnId[txnId] !== undefined) return
    try {
      const storeId = getStoreId()
      setPaymentHistoryLoading(prev => ({ ...prev, [txnId]: true }))
      const res = await fetch(`/api/khaata-payments?store_id=${storeId}&sale_id=${saleId}`)
      const result = await res.json()
      setPaymentHistoryByTxnId(prev => ({ ...prev, [txnId]: result.success ? result.data : [] }))
    } catch {
      setPaymentHistoryByTxnId(prev => ({ ...prev, [txnId]: [] }))
    } finally {
      setPaymentHistoryLoading(prev => ({ ...prev, [txnId]: false }))
    }
  }

  const fetchCustomerPaymentHistory = async (customerPhone: string) => {
    if (!customerPhone || customerPaymentHistoryByPhone[customerPhone] !== undefined) return

    try {
      const storeId = getStoreId()
      if (!storeId) return

      setCustomerPaymentHistoryLoading(prev => ({ ...prev, [customerPhone]: true }))
      const res = await fetch(`/api/khaata-payments?store_id=${storeId}&customer_phone=${encodeURIComponent(customerPhone)}`)
      const result = await res.json()
      setCustomerPaymentHistoryByPhone(prev => ({
        ...prev,
        [customerPhone]: result.success ? result.data : []
      }))
    } catch {
      setCustomerPaymentHistoryByPhone(prev => ({ ...prev, [customerPhone]: [] }))
    } finally {
      setCustomerPaymentHistoryLoading(prev => ({ ...prev, [customerPhone]: false }))
    }
  }

  const toggleTxnExpansion = (txnId: number, saleId: number) => {
    const next = new Set(expandedTxnIds)
    if (next.has(txnId)) {
      next.delete(txnId)
    } else {
      next.add(txnId)
      fetchTxnPaymentHistory(txnId, saleId)
    }
    setExpandedTxnIds(next)
  }

  const openEditModal = (customer: KhaataCustomer) => {
    setSelectedCustomer(customer)
    setEditFormData({
      amount_paid: customer.amount_paid.toString(),
      notes: customer.notes || ''
    })
    setShowEditModal(true)
    setError('')
  }

  const handleUpdate = async () => {
    if (!selectedCustomer) return

    const updatedAmountPaid = parseFloat(editFormData.amount_paid)
    if (Number.isNaN(updatedAmountPaid) || updatedAmountPaid < 0) {
      setError('Please enter a valid paid amount')
      return
    }

    if (updatedAmountPaid > selectedCustomer.total_amount) {
      setError('Paid amount cannot exceed total amount')
      return
    }

    try {
      const response = await fetch(`/api/khaata-customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: selectedCustomer.customer_name,
          customer_phone: selectedCustomer.customer_phone,
          total_amount: selectedCustomer.total_amount,
          amount_paid: updatedAmountPaid,
          notes: editFormData.notes
        })
      })

      const result = await response.json()

      if (result.success) {
        setShowEditModal(false)
        setSelectedCustomer(null)
        setError('')
        fetchCustomers()
      } else {
        setError(result.error || 'Failed to update customer')
      }
    } catch (err) {
      setError('Failed to update customer')
    }
  }

  const handleDeleteCustomer = (id: number) => {
    const customer = customers.find(c => c.id === id)
    if (customer) {
      setCustomerToDelete(customer)
      setShowDeleteModal(true)
    }
  }

  const confirmDelete = async () => {
    if (!customerToDelete) return

    try {
      const response = await fetch(`/api/khaata-customers/${customerToDelete.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        setShowDeleteModal(false)
        setCustomerToDelete(null)
        fetchCustomers()
      } else {
        setError(result.error || 'Failed to delete customer')
      }
    } catch (err) {
      setError('Failed to delete customer')
    }
  }

  const handlePayDues = async () => {
    if (!selectedForPayment) return

    const totalPayment = getPaidTotal()
    const cashAmount = parseAmountValue(cashPaid)
    const digitalAmount = parseAmountValue(digitalPaid)
    const requiresDigital = hasDigitalPayment()

    if (isSplitPayment && cashAmount === 0 && digitalAmount === 0) {
      setError('Enter a cash or digital amount for split payment')
      return
    }

    if (!isSplitPayment && totalPayment <= 0) {
      setError('Please enter a valid payment amount')
      return
    }

    if (totalPayment > selectedForPayment.remaining_balance) {
      setError('Payment amount cannot exceed remaining balance')
      return
    }

    if (requiresDigital && bankAccounts.length === 0) {
      setError('No bank account found. Please add one in Store Settings before taking digital payments.')
      return
    }

    if (requiresDigital && !selectedBankAccount) {
      setError('Please select a bank account for Digital payment')
      return
    }

    try {
      const paymentSplits = isSplitPayment
        ? [
            cashAmount > 0
              ? { payment_method: 'Cash', amount: cashAmount }
              : null,
            digitalAmount > 0
              ? { payment_method: 'Digital', amount: digitalAmount, bank_account_name: selectedBankAccount }
              : null,
          ].filter(Boolean)
        : [
            {
              payment_method: paymentFormData.payment_method,
              amount: totalPayment,
              bank_account_name: requiresDigital ? selectedBankAccount : null,
            },
          ]

      const payload = {
        customer_phone: selectedForPayment.customer_phone,
        payment_amount: totalPayment,
        payment_method: isSplitPayment ? 'Mixed' : paymentFormData.payment_method,
        payments: paymentSplits,
        bank_account_name: requiresDigital ? selectedBankAccount : null,
        notes: paymentFormData.notes.trim() || null,
        store_id: getStoreId(),
        recorded_by: recorderManagerId,
        cashier_id: recorderCashierId,
      }

      const response = await fetch('/api/khaata-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (result.success) {
        setShowPayDuesModal(false)
        setSelectedForPayment(null)
        setPaymentFormData({ payment_amount: '', payment_method: 'Cash', notes: '' })
        setIsSplitPayment(false)
        setCashPaid('')
        setDigitalPaid('')
        setSelectedBankAccount('')
        fetchCustomers()
      } else {
        setError(result.error || 'Failed to record payment')
      }
    } catch (err) {
      setError('Failed to record payment: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  const handleExportCustomerPdf = async (customer: AggregatedCustomer) => {
    try {
      await generateCustomerLedgerPDF(
        {
          customer_name: customer.customer_name,
          customer_phone: customer.customer_phone,
          total_amount: customer.total_amount,
          amount_paid: customer.amount_paid,
          amount_remaining: customer.amount_remaining,
          transactions: customer.transactions.map((transaction) => ({
            sale_id: transaction.sale_id,
            sale_description: transaction.sales?.sale_description,
            sale_number: transaction.sales?.sale_number,
            items: transaction.sales?.sale_items,
            transaction_date: transaction.created_at,
            total_amount: transaction.total_amount,
            amount_paid: transaction.amount_paid,
            amount_remaining: transaction.amount_remaining,
            notes: transaction.notes,
          })),
        },
        { currency }
      )
    } catch (err) {
      console.error('Failed to generate customer ledger PDF:', err)
      alert(err instanceof Error ? err.message : 'Failed to generate customer ledger report.')
    }
  }

  const aggregatedCustomers = aggregateCustomers()
  const filteredAggregatedCustomers = aggregatedCustomers.filter(customer =>
    customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.customer_phone.includes(searchTerm)
  )
  const outstandingCustomers = filteredAggregatedCustomers.filter(customer => customer.amount_remaining > 0)
  const completedCustomers = filteredAggregatedCustomers.filter(customer => customer.amount_remaining <= 0)
  const ledgerPhones = new Set(aggregatedCustomers.map(customer => customer.customer_phone).filter(Boolean))
  const ledgerNames = new Set(aggregatedCustomers.map(customer => customer.customer_name.toLowerCase()))
  const nonLedgerCustomers = orderCustomers.filter((customer) => {
    const phone = customer.customer_phone ? customer.customer_phone.trim() : ''
    const nameKey = customer.customer_name.trim().toLowerCase()
    if (phone) {
      return !ledgerPhones.has(phone)
    }
    return nameKey.length > 0 && !ledgerNames.has(nameKey)
  })

  return (
    <div className="animate-fadeIn">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1">Customer Ledger</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400">View and manage customer accounts with outstanding balances</p>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      {/* Info Message */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
        <p className="text-blue-900">
          <strong>ℹ️ Note:</strong> Customers are automatically added when partial payments are made in POS. 
          Use the Edit button to update payment status or add notes.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Customers Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="mx-auto mb-3 animate-pulse">
            <svg width={40} height={Math.round(40 * (1196 / 1061))} viewBox="0 0 1061 1196" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-current text-cyan-500 mx-auto"><path d="M538.795 609.092L871.505 276.381C976.486 372.749 1042.32 511.172 1042.38 664.993C1041.64 664.973 1040.9 664.949 1040.16 664.926C1046.75 665.171 1053.37 665.296 1060.02 665.298C777.219 665.385 546.193 886.933 530.915 1165.94L530.096 1180.67C530.596 1189.81 530.158 1186.07 530.102 1193.71L530.096 1195.39C530.096 1190.47 529.746 1185.56 529.88 1180.67C522.081 894.715 287.839 665.299 0 665.299C6.05981 665.299 12.0958 665.194 18.1064 664.992C18.1652 506.975 88.0333 365.252 198.592 268.889L538.795 609.092ZM674.459 135.664L538.795 271.328L403.132 135.664L538.795 0L674.459 135.664Z" /></svg>
          </div>
          <div className="w-40 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mx-auto mb-3">
            <div className="h-full bg-cyan-500 rounded-full [animation:progressBar_1.5s_ease-in-out_infinite]" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading customers...</p>
        </div>
      ) : filteredAggregatedCustomers.length === 0 ? (
        <div className="text-center py-8 border border-gray-200 dark:border-gray-700 rounded">
          <p className="text-gray-500 dark:text-gray-400 text-sm">No customers found</p>
        </div>
      ) : (
        <>
          {outstandingCustomers.length === 0 ? (
            <div className="text-center py-8 border border-gray-200 dark:border-gray-700 rounded">
              <p className="text-gray-500 dark:text-gray-400 text-sm">No customers with outstanding balance</p>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
              <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2.5 text-left w-12"></th>
                <th className="px-3 py-2.5 text-left text-sm font-semibold">Customer Name</th>
                <th className="px-3 py-2.5 text-left text-sm font-semibold">Phone Number</th>
                <th className="px-3 py-2.5 text-right text-sm font-semibold">Total Owed</th>
                <th className="px-3 py-2.5 text-right text-sm font-semibold">Total Paid</th>
                <th className="px-3 py-2.5 text-right text-sm font-semibold">Remaining Balance</th>
                <th className="px-3 py-2.5 text-center text-sm font-semibold">Transactions</th>
                <th className="px-3 py-2.5 text-center text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {outstandingCustomers.map((customer) => {
                const isExpanded = expandedCustomers.has(customer.customer_phone)
                return (
                  <>
                    {/* Aggregated Row */}
                    <tr 
                      key={customer.customer_phone} 
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1a1a1a]"
                      onClick={() => toggleCustomerExpansion(customer.customer_phone)}
                    >
                      <td className="px-3 py-2.5">
                        {isExpanded ? <CaretDownIcon size={16} className="text-gray-400" /> : <CaretRightIcon size={16} className="text-gray-400" />}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-sm text-gray-900 dark:text-white">{customer.customer_name}</td>
                      <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-white">{customer.customer_phone}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-sm text-gray-900 dark:text-white">{formatCurrency(customer.total_amount, 2)}</td>
                      <td className="px-3 py-2.5 text-right text-green-600 font-semibold text-sm">{formatCurrency(customer.amount_paid, 2)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-sm text-orange-600">
                        {formatCurrency(customer.amount_remaining, 2)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium">
                          {customer.transactions.length}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedForPayment({
                                type: 'customer',
                                customer_name: customer.customer_name,
                                customer_phone: customer.customer_phone,
                                remaining_balance: customer.amount_remaining
                              })
                              setShowPayDuesModal(true)
                            }}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium flex items-center gap-1"
                            disabled={customer.amount_remaining <= 0}
                          >
                            <CurrencyDollarIcon size={14} />
                            Pay Dues
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleExportCustomerPdf(customer)
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-medium flex items-center gap-1"
                            title="Export PDF"
                          >
                            <DownloadSimpleIcon size={14} />
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Transactions */}
                    {isExpanded && customer.transactions.map((transaction) => {
                      const txnExpanded = expandedTxnIds.has(transaction.id)
                      const txnPayments = paymentHistoryByTxnId[transaction.id]
                      const txnLoading = paymentHistoryLoading[transaction.id]
                      return (
                        <Fragment key={transaction.id}>
                          <tr className="bg-cyan-50 dark:bg-cyan-900/20 border-t border-cyan-200 dark:border-cyan-800">
                            <td className="px-3 py-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleTxnExpansion(transaction.id, transaction.sale_id) }}
                                className="p-0.5 rounded hover:bg-cyan-200 dark:hover:bg-cyan-800 transition-colors"
                                title="Toggle payment history"
                              >
                                {txnExpanded ? <CaretDownIcon size={14} className="text-cyan-700 dark:text-cyan-300" /> : <ReceiptIcon size={14} className="text-cyan-600 dark:text-cyan-400" />}
                              </button>
                            </td>
                            <td className="px-3 py-2" colSpan={2}>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-700 dark:text-gray-300 font-medium">
                                  {transaction.sales?.sale_number || `Sale #${transaction.sale_id}`}
                                </span>
                                {transaction.sales?.sale_description && (
                                  <>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-700 dark:text-gray-300">{transaction.sales.sale_description}</span>
                                  </>
                                )}
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600 dark:text-gray-400">{new Date(transaction.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}</span>
                                {transaction.notes && (
                                  <>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-600 dark:text-gray-400 italic">{transaction.notes}</span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-sm text-gray-900 dark:text-white">{formatCurrency(transaction.total_amount, 2)}</td>
                            <td className="px-3 py-2 text-right text-sm text-green-600">{formatCurrency(transaction.amount_paid, 2)}</td>
                            <td className="px-3 py-2 text-right text-sm font-medium text-orange-600">{formatCurrency(transaction.amount_remaining, 2)}</td>
                            <td className="px-3 py-2">
                              <div className="flex justify-center">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditModal(transaction) }}
                                  className="px-3 py-1.5 bg-cyan-600 text-white rounded text-xs font-medium hover:bg-cyan-700 transition-colors"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>

                          <tr className="border-t border-cyan-100 dark:border-cyan-900">
                            <td colSpan={8} className="bg-white dark:bg-[#1a1a1a] px-4 py-3">
                              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Invoice Items</p>
                              {transaction.sales?.sale_items?.length ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead className="text-gray-600 dark:text-gray-400">
                                      <tr>
                                        <th className="px-2 py-1 text-left font-medium">Item</th>
                                        <th className="px-2 py-1 text-left font-medium">SKU</th>
                                        <th className="px-2 py-1 text-right font-medium">Qty</th>
                                        <th className="px-2 py-1 text-right font-medium">Unit Price</th>
                                        <th className="px-2 py-1 text-right font-medium">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {transaction.sales.sale_items.map((item, index) => (
                                        <tr key={`${transaction.id}-item-${index}`} className="border-t border-gray-100 dark:border-gray-700">
                                          <td className="px-2 py-1 text-gray-900 dark:text-white">{item.product_name || 'Unknown Product'}</td>
                                          <td className="px-2 py-1 text-gray-600 dark:text-gray-400">{item.product_sku || 'N/A'}</td>
                                          <td className="px-2 py-1 text-right text-gray-900 dark:text-white">{item.quantity}</td>
                                          <td className="px-2 py-1 text-right text-gray-900 dark:text-white">{formatCurrency(item.unit_price, 2)}</td>
                                          <td className="px-2 py-1 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(item.subtotal, 2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400">No item details available.</p>
                              )}
                            </td>
                          </tr>

                          {/* Nested Payment History */}
                          {txnExpanded && (
                            <tr className="border-t border-gray-100 dark:border-gray-700">
                              <td colSpan={8} className="bg-gray-50 dark:bg-[#111] px-4 py-3">
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Payment History (FIFO allocations)</p>
                                {txnLoading ? (
                                  <p className="text-xs text-gray-400">Loading...</p>
                                ) : !txnPayments || txnPayments.length === 0 ? (
                                  <p className="text-xs text-gray-400 italic">No payments recorded yet.</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                                        <th className="text-left py-1 pr-4 font-medium">Date</th>
                                        <th className="text-left py-1 pr-4 font-medium">Reference</th>
                                        <th className="text-right py-1 pr-4 font-medium">Applied</th>
                                        <th className="text-right py-1 pr-4 font-medium">Txn Remaining</th>
                                        <th className="text-right py-1 pr-4 font-medium">Customer Remaining</th>
                                        <th className="text-left py-1 pr-4 font-medium">Method</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {txnPayments.map((p: any) => (
                                        <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                                          <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300">
                                            {new Date(p.payment_date || p.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                          </td>
                                          <td className="py-1.5 pr-4 font-mono text-gray-700 dark:text-gray-300">{p.payment_reference || '-'}</td>
                                          <td className="py-1.5 pr-4 text-right font-semibold text-green-600">{formatCurrency(p.payment_amount, 2)}</td>
                                          <td className="py-1.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                                            {formatCurrency(p.transaction_remaining_before || 0, 2)} {'->'} {formatCurrency(p.transaction_remaining_after || 0, 2)}
                                          </td>
                                          <td className="py-1.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                                            {formatCurrency(p.customer_remaining_before || 0, 2)} {'->'} {formatCurrency(p.customer_remaining_after || 0, 2)}
                                          </td>
                                          <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">
                                            <div>{p.payment_method}</div>
                                            {p.bank_account_name && (
                                              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                                Bank: {p.bank_account_name}
                                              </div>
                                            )}
                                            {p.notes && <div className="text-[11px] text-gray-500 dark:text-gray-400 italic">{p.notes}</div>}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}

                    {isExpanded && (
                      <tr className="border-t border-gray-100 dark:border-gray-700">
                        <td colSpan={8} className="bg-gray-50 dark:bg-[#111] px-4 py-3">
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                            Separate Ledger Entries (Payment Allocations)
                          </p>
                          {customerPaymentHistoryLoading[customer.customer_phone] ? (
                            <p className="text-xs text-gray-400">Loading payment entries...</p>
                          ) : (customerPaymentHistoryByPhone[customer.customer_phone] || []).length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No payment entries recorded yet.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                                  <th className="text-left py-1 pr-4 font-medium">Date</th>
                                  <th className="text-left py-1 pr-4 font-medium">Reference</th>
                                  <th className="text-right py-1 pr-4 font-medium">Applied</th>
                                  <th className="text-right py-1 pr-4 font-medium">Txn Remaining</th>
                                  <th className="text-right py-1 pr-4 font-medium">Customer Remaining</th>
                                  <th className="text-left py-1 pr-4 font-medium">Method</th>
                                </tr>
                              </thead>
                              <tbody>
                                {customerPaymentHistoryByPhone[customer.customer_phone].map((payment) => (
                                  <tr key={`customer-payment-${payment.id}`} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                                    <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300">
                                      {new Date(payment.payment_date).toLocaleString('en-PK', {
                                        timeZone: 'Asia/Karachi',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true,
                                      })}
                                    </td>
                                    <td className="py-1.5 pr-4 font-mono text-gray-700 dark:text-gray-300">
                                      {payment.payment_reference || '-'}
                                    </td>
                                    <td className="py-1.5 pr-4 text-right font-semibold text-green-600">
                                      {formatCurrency(payment.payment_amount, 2)}
                                    </td>
                                    <td className="py-1.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                                      {formatCurrency(payment.transaction_remaining_before || 0, 2)} {'->'} {formatCurrency(payment.transaction_remaining_after || 0, 2)}
                                    </td>
                                    <td className="py-1.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                                      {formatCurrency(payment.customer_remaining_before || 0, 2)} {'->'} {formatCurrency(payment.customer_remaining_after || 0, 2)}
                                    </td>
                                    <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">
                                      <div>{payment.payment_method}</div>
                                      {payment.bank_account_name && (
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400">Bank: {payment.bank_account_name}</div>
                                      )}
                                      {payment.notes && <div className="text-[11px] text-gray-500 dark:text-gray-400 italic">{payment.notes}</div>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-cyan-600 text-white font-semibold">
                <td colSpan={3} className="px-3 py-2.5 text-sm">TOTAL</td>
                <td className="px-3 py-2.5 text-right text-sm">
                  {formatCurrency(outstandingCustomers.reduce((sum, c) => sum + c.total_amount, 0), 2)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm">
                  {formatCurrency(outstandingCustomers.reduce((sum, c) => sum + c.amount_paid, 0), 2)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm">
                  {formatCurrency(outstandingCustomers.reduce((sum, c) => sum + c.amount_remaining, 0), 2)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
              </table>
            </div>
          )}

          {completedCustomers.length > 0 && (
            <div className="mt-8">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Completed Dues</h2>
                <p className="text-xs text-gray-600 dark:text-gray-400">Customers who have cleared all balances</p>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-3 py-2.5 text-left w-12"></th>
                      <th className="px-3 py-2.5 text-left text-sm font-semibold">Customer Name</th>
                      <th className="px-3 py-2.5 text-left text-sm font-semibold">Phone Number</th>
                      <th className="px-3 py-2.5 text-right text-sm font-semibold">Total Owed</th>
                      <th className="px-3 py-2.5 text-right text-sm font-semibold">Total Paid</th>
                      <th className="px-3 py-2.5 text-right text-sm font-semibold">Remaining Balance</th>
                      <th className="px-3 py-2.5 text-center text-sm font-semibold">Transactions</th>
                      <th className="px-3 py-2.5 text-center text-sm font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedCustomers.map((customer) => {
                      const isExpanded = expandedCustomers.has(customer.customer_phone)
                      return (
                        <>
                          <tr
                            key={customer.customer_phone}
                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1a1a1a]"
                            onClick={() => toggleCustomerExpansion(customer.customer_phone)}
                          >
                            <td className="px-3 py-2.5">
                              {isExpanded ? <CaretDownIcon size={16} className="text-gray-400" /> : <CaretRightIcon size={16} className="text-gray-400" />}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-sm text-gray-900 dark:text-white">{customer.customer_name}</td>
                            <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-white">{customer.customer_phone}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-sm text-gray-900 dark:text-white">{formatCurrency(customer.total_amount, 2)}</td>
                            <td className="px-3 py-2.5 text-right text-green-600 font-semibold text-sm">{formatCurrency(customer.amount_paid, 2)}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-sm text-gray-500">
                              {formatCurrency(customer.amount_remaining, 2)}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium">
                                {customer.transactions.length}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium">
                                Cleared
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleExportCustomerPdf(customer)
                                }}
                                className="ml-2 inline-flex items-center gap-1 px-2 py-1 bg-slate-800 text-white rounded text-xs font-medium hover:bg-slate-900"
                                title="Export PDF"
                              >
                                <DownloadSimpleIcon size={13} />
                                PDF
                              </button>
                            </td>
                          </tr>

                          {isExpanded && customer.transactions.map((transaction) => {
                            const txnExpanded = expandedTxnIds.has(transaction.id)
                            const txnPayments = paymentHistoryByTxnId[transaction.id]
                            const txnLoading = paymentHistoryLoading[transaction.id]
                            return (
                              <Fragment key={transaction.id}>
                                <tr className="bg-cyan-50 dark:bg-cyan-900/20 border-t border-cyan-200 dark:border-cyan-800">
                                  <td className="px-3 py-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); toggleTxnExpansion(transaction.id, transaction.sale_id) }}
                                      className="p-0.5 rounded hover:bg-cyan-200 dark:hover:bg-cyan-800 transition-colors"
                                      title="Toggle payment history"
                                    >
                                      {txnExpanded ? <CaretDownIcon size={14} className="text-cyan-700 dark:text-cyan-300" /> : <ReceiptIcon size={14} className="text-cyan-600 dark:text-cyan-400" />}
                                    </button>
                                  </td>
                                  <td className="px-3 py-2" colSpan={2}>
                                    <div className="flex items-center gap-2 text-sm">
                                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                                        {transaction.sales?.sale_number || `Sale #${transaction.sale_id}`}
                                      </span>
                                      {transaction.sales?.sale_description && (
                                        <>
                                          <span className="text-gray-400">•</span>
                                          <span className="text-gray-700 dark:text-gray-300">{transaction.sales.sale_description}</span>
                                        </>
                                      )}
                                      <span className="text-gray-400">•</span>
                                      <span className="text-gray-600 dark:text-gray-400">{new Date(transaction.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}</span>
                                      {transaction.notes && (
                                        <>
                                          <span className="text-gray-400">•</span>
                                          <span className="text-gray-600 dark:text-gray-400 italic">{transaction.notes}</span>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right text-sm text-gray-900 dark:text-white">{formatCurrency(transaction.total_amount, 2)}</td>
                                  <td className="px-3 py-2 text-right text-sm text-green-600">{formatCurrency(transaction.amount_paid, 2)}</td>
                                  <td className="px-3 py-2 text-right text-sm font-medium text-gray-500">{formatCurrency(transaction.amount_remaining, 2)}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex justify-center">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); openEditModal(transaction) }}
                                        className="px-3 py-1.5 bg-cyan-600 text-white rounded text-xs font-medium hover:bg-cyan-700 transition-colors"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                <tr className="border-t border-cyan-100 dark:border-cyan-900">
                                  <td colSpan={8} className="bg-white dark:bg-[#1a1a1a] px-4 py-3">
                                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Invoice Items</p>
                                    {transaction.sales?.sale_items?.length ? (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                          <thead className="text-gray-600 dark:text-gray-400">
                                            <tr>
                                              <th className="px-2 py-1 text-left font-medium">Item</th>
                                              <th className="px-2 py-1 text-left font-medium">SKU</th>
                                              <th className="px-2 py-1 text-right font-medium">Qty</th>
                                              <th className="px-2 py-1 text-right font-medium">Unit Price</th>
                                              <th className="px-2 py-1 text-right font-medium">Subtotal</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {transaction.sales.sale_items.map((item, index) => (
                                              <tr key={`${transaction.id}-item-${index}`} className="border-t border-gray-100 dark:border-gray-700">
                                                <td className="px-2 py-1 text-gray-900 dark:text-white">{item.product_name || 'Unknown Product'}</td>
                                                <td className="px-2 py-1 text-gray-600 dark:text-gray-400">{item.product_sku || 'N/A'}</td>
                                                <td className="px-2 py-1 text-right text-gray-900 dark:text-white">{item.quantity}</td>
                                                <td className="px-2 py-1 text-right text-gray-900 dark:text-white">{formatCurrency(item.unit_price, 2)}</td>
                                                <td className="px-2 py-1 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(item.subtotal, 2)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">No item details available.</p>
                                    )}
                                  </td>
                                </tr>

                                {txnExpanded && (
                                  <tr className="border-t border-gray-100 dark:border-gray-700">
                                    <td colSpan={8} className="bg-gray-50 dark:bg-[#111] px-4 py-3">
                                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Payment History for this transaction</p>
                                      {txnLoading ? (
                                        <p className="text-xs text-gray-400">Loading...</p>
                                      ) : !txnPayments || txnPayments.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic">No payments recorded yet.</p>
                                      ) : (
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                                              <th className="text-left py-1 pr-4 font-medium">Date</th>
                                              <th className="text-right py-1 pr-4 font-medium">Amount</th>
                                              <th className="text-left py-1 pr-4 font-medium">Method</th>
                                              <th className="text-left py-1 font-medium">Notes</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {txnPayments.map((p: any) => (
                                              <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                                                <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300">
                                                  {new Date(p.payment_date || p.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </td>
                                                <td className="py-1.5 pr-4 text-right font-semibold text-green-600">{formatCurrency(p.payment_amount, 2)}</td>
                                                <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">
                                                  <div>{p.payment_method}</div>
                                                  {p.bank_account_name && (
                                                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                                      Bank: {p.bank_account_name}
                                                    </div>
                                                  )}
                                                </td>
                                                <td className="py-1.5 text-gray-500 dark:text-gray-400 italic">{p.notes || '—'}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          })}

                          {isExpanded && (
                            <tr className="border-t border-gray-100 dark:border-gray-700">
                              <td colSpan={8} className="bg-gray-50 dark:bg-[#111] px-4 py-3">
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                                  Separate Ledger Entries (Payment Allocations)
                                </p>
                                {customerPaymentHistoryLoading[customer.customer_phone] ? (
                                  <p className="text-xs text-gray-400">Loading payment entries...</p>
                                ) : (customerPaymentHistoryByPhone[customer.customer_phone] || []).length === 0 ? (
                                  <p className="text-xs text-gray-400 italic">No payment entries recorded yet.</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                                        <th className="text-left py-1 pr-4 font-medium">Date</th>
                                        <th className="text-left py-1 pr-4 font-medium">Reference</th>
                                        <th className="text-right py-1 pr-4 font-medium">Applied</th>
                                        <th className="text-right py-1 pr-4 font-medium">Txn Remaining</th>
                                        <th className="text-right py-1 pr-4 font-medium">Customer Remaining</th>
                                        <th className="text-left py-1 pr-4 font-medium">Method</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {customerPaymentHistoryByPhone[customer.customer_phone].map((payment) => (
                                        <tr key={`customer-payment-${payment.id}`} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                                          <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300">
                                            {new Date(payment.payment_date).toLocaleString('en-PK', {
                                              timeZone: 'Asia/Karachi',
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric',
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              hour12: true,
                                            })}
                                          </td>
                                          <td className="py-1.5 pr-4 font-mono text-gray-700 dark:text-gray-300">
                                            {payment.payment_reference || '-'}
                                          </td>
                                          <td className="py-1.5 pr-4 text-right font-semibold text-green-600">
                                            {formatCurrency(payment.payment_amount, 2)}
                                          </td>
                                          <td className="py-1.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                                            {formatCurrency(payment.transaction_remaining_before || 0, 2)} {'->'} {formatCurrency(payment.transaction_remaining_after || 0, 2)}
                                          </td>
                                          <td className="py-1.5 pr-4 text-right text-gray-700 dark:text-gray-300">
                                            {formatCurrency(payment.customer_remaining_before || 0, 2)} {'->'} {formatCurrency(payment.customer_remaining_after || 0, 2)}
                                          </td>
                                          <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">
                                            <div>{payment.payment_method}</div>
                                            {payment.bank_account_name && (
                                              <div className="text-[11px] text-gray-500 dark:text-gray-400">Bank: {payment.bank_account_name}</div>
                                            )}
                                            {payment.notes && <div className="text-[11px] text-gray-500 dark:text-gray-400 italic">{payment.notes}</div>}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
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

          <div className="mt-8">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Order Customers</h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">Customers who provided details on sales (no active ledger)</p>
            </div>

            {nonLedgerCustomers.length === 0 ? (
              <div className="text-center py-6 border border-gray-200 dark:border-gray-700 rounded">
                <p className="text-gray-500 dark:text-gray-400 text-sm">No additional order customers found</p>
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-3 py-2.5 text-left text-sm font-semibold">Customer Name</th>
                      <th className="px-3 py-2.5 text-left text-sm font-semibold">Phone Number</th>
                      <th className="px-3 py-2.5 text-left text-sm font-semibold">Last Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nonLedgerCustomers.map((customer) => (
                      <tr
                        key={`${customer.customer_phone || customer.customer_name}-${customer.last_sale_date}`}
                        className="border-b bg-white border-gray-100 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
                      >
                        <td className="px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-white">
                          {customer.customer_name}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">
                          {customer.customer_phone || '-'}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(customer.last_sale_date).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Initial Customers Section */}
      {initialCustomers.length > 0 && (
        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Initial Customers (Migration)</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">Customers imported when you started using Atom</p>
          </div>
          
          <div className="border rounded overflow-hidden border-gray-200 dark:border-gray-700">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Customer Name</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Phone</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">CNIC</th>
                  <th className="px-3 py-2.5 text-right text-sm font-semibold">Amount Owed</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Notes</th>
                  <th className="px-3 py-2.5 text-left text-sm font-semibold">Added On</th>
                </tr>
              </thead>
              <tbody>
                {initialCustomers.map((customer) => (
                  <tr 
                    key={customer.id}
                    className="border-b bg-white border-gray-100 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-white">
                      {customer.customer_name}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">
                      {customer.customer_phone || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300">
                      {customer.customer_cnic || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-semibold text-orange-600">
                      {formatCurrency(customer.amount_owed, 2)}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                      {customer.notes || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(customer.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-orange-600 text-white font-semibold">
                  <td colSpan={3} className="px-3 py-2.5 text-sm">TOTAL INITIAL BALANCE</td>
                  <td className="px-3 py-2.5 text-right text-sm">
                  {formatCurrency(initialCustomers.reduce((sum, c) => sum + c.amount_owed, 0), 2)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Edit Ledger Modal */}
      {showEditModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Ledger Entry</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded text-sm">
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Customer:</span>{' '}
                <span className="text-gray-900 dark:text-white">{selectedCustomer.customer_name}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Phone:</span>{' '}
                <span className="text-gray-900 dark:text-white">{selectedCustomer.customer_phone}</span>
              </div>
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Total Amount:</span>{' '}
                <span className="text-gray-900 dark:text-white">{formatCurrency(selectedCustomer.total_amount, 2)}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Remaining:</span>{' '}
                <span className="text-orange-600 font-medium">{formatCurrency(selectedCustomer.amount_remaining, 2)}</span>
              </div>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Amount Paid</label>
                <input
                  title="Edit amount paid"
                  type="number"
                  value={editFormData.amount_paid}
                  onChange={(e) => setEditFormData({ ...editFormData, amount_paid: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  step="0.01"
                  min="0"
                  max={selectedCustomer.total_amount}
                />
              </div>
              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  title="Edit notes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedCustomer(null)
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false)
                  if (selectedCustomer) {
                    handleDeleteCustomer(selectedCustomer.id)
                  }
                }}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && customerToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrashIcon size={20} className="text-red-600" />
              Delete Ledger Record
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded dark:bg-red-900/20 dark:border-red-700">
              <p className="text-sm text-red-900 dark:text-red-300 mb-3">
                Are you sure you want to delete this ledger record? This action will:
              </p>
              <ul className="text-sm text-red-800 dark:text-red-400 list-disc list-inside space-y-1">
                <li>Remove this ledger entry for the sale</li>
                <li>Delete associated payment records for this entry</li>
                <li>This action cannot be undone</li>
              </ul>
            </div>

            <div className="mb-4 p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-gray-700 rounded text-sm">
              <div className="mb-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Customer:</span>{' '}
                <span className="text-gray-900 dark:text-white">{customerToDelete.customer_name}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">Remaining Balance:</span>{' '}
                <span className="text-red-600 font-medium">{formatCurrency(customerToDelete.amount_remaining, 2)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setCustomerToDelete(null)
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
              >
                Delete Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Dues Modal */}
      {showPayDuesModal && selectedForPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700 max-w-md w-full p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Pay Dues - {selectedForPayment.customer_name}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm">
              <p className="text-blue-900 dark:text-blue-300">
                <strong>Current Balance:</strong> {formatCurrency(selectedForPayment.remaining_balance, 2)}
              </p>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Split Payment</span>
              <button
                onClick={() => {
                  setIsSplitPayment((prev) => !prev)
                  setPaymentFormData({ ...paymentFormData, payment_amount: '', payment_method: 'Cash' })
                  setCashPaid('')
                  setDigitalPaid('')
                  setSelectedBankAccount('')
                }}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  isSplitPayment
                    ? 'bg-cyan-600 text-white border-cyan-600'
                    : 'bg-white border-gray-300 text-gray-700 dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-gray-300'
                }`}
              >
                {isSplitPayment ? 'On' : 'Off'}
              </button>
            </div>

            <div className="space-y-4 mb-5">
              {!isSplitPayment ? (
                <>
                  <div>
                    <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Payment Amount*</label>
                    <input
                      type="number"
                      value={paymentFormData.payment_amount}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_amount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                      placeholder="Enter payment amount"
                      step="0.01"
                      min="0"
                      max={selectedForPayment.remaining_balance}
                    />
                  </div>

                  <div>
                    <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Payment Method*</label>
                    <select
                      title="Payment method"
                      value={paymentFormData.payment_method}
                      onChange={(e) => {
                        setPaymentFormData({ ...paymentFormData, payment_method: e.target.value })
                        setSelectedBankAccount('')
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Digital">Digital</option>
                    </select>
                  </div>

                  {paymentFormData.payment_method === 'Digital' && (
                    <div>
                      <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                        Bank Account <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={selectedBankAccount}
                        onChange={(e) => setSelectedBankAccount(e.target.value)}
                        title="Select bank account"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="">Select bank account</option>
                        {bankAccounts.map((account) => (
                          <option key={account.id} value={account.account_name}>
                            {account.account_name}
                          </option>
                        ))}
                      </select>
                      {bankAccountsLoading && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Loading bank accounts...</p>
                      )}
                      {!bankAccountsLoading && bankAccounts.length === 0 && (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          No bank account found. Add one in Store Settings.
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Split Amounts*</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block mb-1 text-[11px] text-gray-500 dark:text-gray-400">Cash</label>
                        <input
                          type="number"
                          value={cashPaid}
                          onChange={(e) => setCashPaid(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-[11px] text-gray-500 dark:text-gray-400">Digital</label>
                        <input
                          type="number"
                          value={digitalPaid}
                          onChange={(e) => setDigitalPaid(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Total Paid: {formatCurrency(getPaidTotal(), 2)}
                    </p>
                  </div>

                  {parseAmountValue(digitalPaid) > 0 && (
                    <div>
                      <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">
                        Bank Account <span className="text-red-600">*</span>
                      </label>
                      <select
                        value={selectedBankAccount}
                        onChange={(e) => setSelectedBankAccount(e.target.value)}
                        title="Select bank account"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                      >
                        <option value="">Select bank account</option>
                        {bankAccounts.map((account) => (
                          <option key={account.id} value={account.account_name}>
                            {account.account_name}
                          </option>
                        ))}
                      </select>
                      {bankAccountsLoading && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Loading bank accounts...</p>
                      )}
                      {!bankAccountsLoading && bankAccounts.length === 0 && (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          No bank account found. Add one in Store Settings.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="block mb-1 font-medium text-xs text-gray-700 dark:text-gray-300">Notes</label>
                <textarea
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:border-cyan-600 dark:bg-gray-800 dark:text-white"
                  rows={3}
                  placeholder="Add payment notes..."
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPayDuesModal(false)
                  setSelectedForPayment(null)
                  setPaymentFormData({ payment_amount: '', payment_method: 'Cash', notes: '' })
                  setIsSplitPayment(false)
                  setCashPaid('')
                  setDigitalPaid('')
                  setSelectedBankAccount('')
                  setError('')
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handlePayDues}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
