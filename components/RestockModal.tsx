'use client'

import { useState, useEffect } from 'react'
import { XIcon, MagnifyingGlassIcon } from '@phosphor-icons/react'
import type { ProductWithBackwardCompatibility, Supplier } from '@/lib/types'
import { getCashierId, getManagerId, getStoreId } from '@/lib/supabase'

interface RestockModalProps {
  onClose: (refresh: boolean) => void
  isInitialStock?: boolean // Flag to mark stock as initial (not counted as expense)
}

interface BankAccount {
  id: number
  store_id: number
  account_name: string
}

export default function RestockModal({ onClose, isInitialStock = false }: RestockModalProps) {
  const [allProducts, setAllProducts] = useState<ProductWithBackwardCompatibility[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductWithBackwardCompatibility | null>(null)
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [formData, setFormData] = useState({
    cost_price: '',
    selling_price: '',
    lowest_negotiable_price: '',
    quantity_added: '',
    supplier_id: '',
    supplier_name: '',
    supplier_phone: '',
    amount_paid: '', // Payment to supplier
    payment_method: 'Cash', // Payment method: Cash or Digital
    // IMEI fields for phone products
    imei_numbers: [''],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(true)
  const [userRole, setUserRole] = useState<string>('')
  const [isSplitPayment, setIsSplitPayment] = useState(false)
  const [cashPaid, setCashPaid] = useState('')
  const [digitalPaid, setDigitalPaid] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false)
  const [selectedBankAccount, setSelectedBankAccount] = useState('')

  useEffect(() => {
    fetchAllProducts()
    fetchSuppliers()
    checkUserRole()
    fetchBankAccounts()
  }, [])

  const checkUserRole = () => {
    // Check if it's a cashier (localStorage session)
    const cashierSession = localStorage.getItem('user_session')
    if (cashierSession) {
      setUserRole('Cashier')
      return
    }

    // Check if it's a manager (sessionStorage)
    const userType = sessionStorage.getItem('user_type')
    if (userType === 'Manager') {
      setUserRole('Manager')
    }
  }

  const fetchAllProducts = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) {
        console.error('No store ID found')
        setSearching(false)
        return
      }

      const response = await fetch(`/api/products?include_inactive=true&store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setAllProducts(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch products')
    } finally {
      setSearching(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/suppliers?store_id=${storeId}`)
      const data = await response.json()

      if (data.success) {
        setSuppliers(data.data)
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err)
    }
  }

  const fetchBankAccounts = async () => {
    try {
      setBankAccountsLoading(true)
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/bank-accounts?store_id=${storeId}`)
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

  const searchSuppliersByPhone = async (phone: string) => {
    if (phone.length < 1) {
      setFilteredSuppliers([])
      return
    }

    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/suppliers?store_id=${storeId}&search=${encodeURIComponent(phone)}`)
      const data = await response.json()

      if (data.success) {
        setFilteredSuppliers(data.data)
        setShowSupplierDropdown(true)
      }
    } catch (err) {
      console.error('Error searching suppliers:', err)
    }
  }

  const selectSupplier = (supplier: Supplier) => {
    setFormData({
      ...formData,
      supplier_id: supplier.id.toString(),
      supplier_name: supplier.supplier_name,
      supplier_phone: supplier.phone_number,
    })
    setShowSupplierDropdown(false)
    setFilteredSuppliers([])
  }

  const filteredProducts = searchTerm
    ? allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : []

  const handleProductSelect = (product: ProductWithBackwardCompatibility) => {
    setSelectedProduct(product)
    
    // Initialize IMEI array based on quantity (default 1)
    const initialIMEIs = product.is_phone ? [''] : []
    
    setFormData({
      cost_price: product.aggregated_stock?.aggregated_cost_price?.toString() || '',
      selling_price: product.aggregated_stock?.aggregated_selling_price?.toString() || '',
      lowest_negotiable_price: product.aggregated_stock?.aggregated_lowest_negotiable?.toString() || '',
      quantity_added: '',
      supplier_id: '',
      supplier_name: '',
      supplier_phone: '',
      amount_paid: '',
      payment_method: 'Cash',
      imei_numbers: initialIMEIs,
    })
    setIsSplitPayment(false)
    setCashPaid('')
    setDigitalPaid('')
    setSelectedBankAccount('')
    setSearchTerm('')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    // If quantity changes and it's a phone, update IMEI fields count
    if (name === 'quantity_added' && selectedProduct?.is_phone) {
      const qty = parseInt(value) || 0
      const newIMEIs = Array(qty).fill('').map((_, i) => formData.imei_numbers[i] || '')
      setFormData({ ...formData, [name]: value, imei_numbers: newIMEIs })
    } else if (name === 'supplier_phone') {
      setFormData({ ...formData, [name]: value })
      searchSuppliersByPhone(value)
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const handleIMEIChange = (index: number, value: string) => {
    const newIMEIs = [...formData.imei_numbers]
    newIMEIs[index] = value
    setFormData({ ...formData, imei_numbers: newIMEIs })
  }

  const parseAmountValue = (value: string) => {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const getPaidTotal = () => {
    if (isSplitPayment) {
      return parseAmountValue(cashPaid) + parseAmountValue(digitalPaid)
    }

    return parseAmountValue(formData.amount_paid)
  }

  const hasDigitalPayment = () => {
    if (isSplitPayment) {
      return parseAmountValue(digitalPaid) > 0
    }

    return formData.payment_method === 'Digital'
  }

  const getSplitPaymentMethod = () => {
    if (!isSplitPayment) {
      return formData.payment_method
    }

    const cashAmount = parseAmountValue(cashPaid)
    const digitalAmount = parseAmountValue(digitalPaid)

    if (cashAmount > 0 && digitalAmount > 0) {
      return 'Mixed'
    }

    if (digitalAmount > 0) {
      return 'Digital'
    }

    return 'Cash'
  }

  const addIMEIField = () => {
    setFormData({
      ...formData,
      imei_numbers: [...formData.imei_numbers, ''],
    })
  }

  const removeIMEIField = (index: number) => {
    const newIMEIs = formData.imei_numbers.filter((_, i) => i !== index)
    setFormData({ ...formData, imei_numbers: newIMEIs })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const storeId = getStoreId()
      if (!storeId) {
        setError('Store ID not found')
        setLoading(false)
        return
      }

      // Validation
      const costPrice = parseFloat(formData.cost_price)
      const sellingPrice = parseFloat(formData.selling_price)
      const lowestNegotiable = parseFloat(formData.lowest_negotiable_price)
      const quantity = parseInt(formData.quantity_added)

      if (isNaN(costPrice) || costPrice < 0) {
        setError('Cost price must be a positive number')
        setLoading(false)
        return
      }

      if (isNaN(sellingPrice) || sellingPrice < 0) {
        setError('Selling price must be a positive number')
        setLoading(false)
        return
      }

      if (isNaN(lowestNegotiable) || lowestNegotiable < 0) {
        setError('Lowest negotiable price must be a positive number')
        setLoading(false)
        return
      }

      if (lowestNegotiable > sellingPrice) {
        setError('Lowest negotiable price cannot exceed selling price')
        setLoading(false)
        return
      }

      if (isNaN(quantity) || quantity <= 0) {
        setError('Quantity must be greater than 0')
        setLoading(false)
        return
      }

      // Validate payment amount
      const amountPaid = getPaidTotal()
      const totalAmount = costPrice * quantity

      if (!isSplitPayment && formData.amount_paid.trim().length === 0) {
        setError('Amount paid must be a positive number')
        setLoading(false)
        return
      }

      if (isSplitPayment && amountPaid === 0) {
        setError('Please enter cash or digital payment amount')
        setLoading(false)
        return
      }

      if (Number.isNaN(amountPaid) || amountPaid < 0) {
        setError('Amount paid must be a positive number')
        setLoading(false)
        return
      }

      if (amountPaid > totalAmount) {
        setError('Amount paid cannot exceed total amount')
        setLoading(false)
        return
      }

      if (hasDigitalPayment() && bankAccounts.length === 0) {
        setError('No bank account found. Please add one in Store Settings before taking digital payments.')
        setLoading(false)
        return
      }

      if (hasDigitalPayment() && !selectedBankAccount) {
        setError('Please select a bank account for Digital payment')
        setLoading(false)
        return
      }

      // Validate IMEI count for phones
      if (selectedProduct?.is_phone) {
        const validIMEIs = formData.imei_numbers.filter(imei => imei.trim() !== '')
        if (validIMEIs.length !== quantity) {
          setError(`Please enter exactly ${quantity} IMEI number${quantity > 1 ? 's' : ''}`)
          setLoading(false)
          return
        }

        // Check for duplicates
        const uniqueIMEIs = new Set(validIMEIs)
        if (uniqueIMEIs.size !== validIMEIs.length) {
          setError('Duplicate IMEI numbers detected')
          setLoading(false)
          return
        }
      }

      // Step 1: Create or get supplier
      let supplierId = formData.supplier_id

      if (!supplierId && formData.supplier_phone) {
        // Create new supplier
        const supplierPayload = {
          store_id: storeId,
          supplier_name: formData.supplier_name || 'Unknown Supplier',
          phone_number: formData.supplier_phone,
        }

        const supplierResponse = await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(supplierPayload),
        })

        const supplierResult = await supplierResponse.json()

        if (!supplierResult.success) {
          setError(supplierResult.error || 'Failed to create supplier')
          setLoading(false)
          return
        }

        supplierId = supplierResult.data.id
      }

      // Step 2: Validate supplier info if partial payment
      // (totalAmount and amountPaid already declared above during validation)
      
      // Supplier info is required when partial payment
      if (amountPaid < totalAmount && !formData.supplier_phone) {
        setError('Supplier information is required when making partial payment')
        setLoading(false)
        return
      }
      
      // Create stock batch (API will update product prices automatically)
      const cashAmount = parseAmountValue(cashPaid)
      const digitalAmount = parseAmountValue(digitalPaid)
      const paymentMethodForBatch = getSplitPaymentMethod()
      const paymentSplits = isSplitPayment
        ? [
            cashAmount > 0
              ? { payment_method: 'Cash', amount: cashAmount }
              : null,
            digitalAmount > 0
              ? {
                  payment_method: 'Digital',
                  amount: digitalAmount,
                  bank_account_name: selectedBankAccount,
                }
              : null,
          ].filter(Boolean)
        : null

      const batchPayload = {
        product_id: selectedProduct!.id,
        store_id: storeId,
        supplier_id: supplierId || null,
        cost_price: costPrice,
        quantity_purchased: quantity,
        selling_price: sellingPrice,
        lowest_negotiable_price: lowestNegotiable,
        is_initial_stock: isInitialStock, // Mark as initial stock if adding from Store tab
        
        // Payment tracking for supplier khaata
        amount_paid: amountPaid,
        supplier_name: formData.supplier_name || 'Unknown',
        supplier_phone: formData.supplier_phone || '',
        payment_method: paymentMethodForBatch, // Payment method (Cash/Digital/Mixed)
        payments: paymentSplits && paymentSplits.length > 0 ? paymentSplits : undefined,
        bank_account_name: hasDigitalPayment() ? selectedBankAccount : null,
        recorded_by: null as string | null,
        recorded_by_cashier_id: null as number | null,
      }

      const managerId = await getManagerId()
      const cashierId = getCashierId()
      if (managerId) {
        batchPayload.recorded_by = managerId
      } else if (cashierId) {
        batchPayload.recorded_by_cashier_id = cashierId
      }

      const batchResponse = await fetch('/api/stock-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload),
      })

      const batchResult = await batchResponse.json()

      if (!batchResult.success) {
        setError(batchResult.error || 'Failed to create stock batch')
        setLoading(false)
        return
      }

      // Step 3: Add IMEIs if it's a phone
      if (selectedProduct?.is_phone && formData.imei_numbers.length > 0) {
        const validIMEIs = formData.imei_numbers.filter(imei => imei.trim() !== '')

        if (validIMEIs.length > 0) {
          const imeiPayload = {
            product_id: selectedProduct.id,
            batch_id: batchResult.data.batch.id,
            store_id: storeId,
            imei_numbers: validIMEIs,
          }

          const imeiResponse = await fetch('/api/imeis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(imeiPayload),
          })

          const imeiResult = await imeiResponse.json()

          if (!imeiResult.success) {
            console.warn('Failed to add IMEIs:', imeiResult.error)
            // Don't fail the whole operation, just warn
          }
        }
      }

      // Success!
      onClose(true)
    } catch (err) {
      console.error('Restock error:', err)
      setError('Failed to restock product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-lg border w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold">
              {isInitialStock ? 'Add Initial Stock' : 'Restock Product'}
            </h2>
            {isInitialStock && (
              <p className="text-xs text-blue-600 mt-1">
                ⚠️ This stock will NOT be recorded as an expense
              </p>
            )}
          </div>
          <button
            onClick={() => onClose(false)}
            title="Close restock"
            aria-label="Close restock"
            className="p-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <XIcon size={24} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-3 bg-status-error text-white rounded">
            {error}
          </div>
        )}

        <div className="p-6">
          {!selectedProduct ? (
            <div>
              <p className="mb-4 text-text-secondary">
                Search for a product to restock (includes inactive products)
              </p>
              <div className="relative mb-4">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
                <input
                  type="text"
                  placeholder="Search by name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border-2 rounded focus:outline-none bg-white border-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  autoFocus
                />
              </div>

              {searchTerm && filteredProducts.length > 0 && (
                <div className="border-2 rounded max-h-64 overflow-y-auto border-black dark:border-gray-600">
                  {filteredProducts.slice(0, 10).map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className="w-full p-3 text-left transition-colors border-b last:border-b-0 hover:bg-bg-secondary border-gray-300 dark:hover:bg-gray-700 dark:border-gray-600"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-text-secondary">
                            {product.sku} • {product.category || 'No category'}
                            {!product.is_active && (
                              <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded">
                                Inactive
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-text-secondary">Current Stock</p>
                          <p className="font-bold">{product.stock_quantity || 0}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchTerm && filteredProducts.length === 0 && !searching && (
                <p className="text-center py-4 text-text-secondary">
                  No products found matching "{searchTerm}"
                </p>
              )}
            </div>
          ) : (
            <div>
              {/* Selected Product Info */}
              <div className="mb-6 p-4 rounded border-2 bg-bg-secondary border-black dark:bg-gray-700 dark:border-gray-600">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{selectedProduct.name}</h3>
                    <p className="text-sm text-text-secondary">
                      SKU: {selectedProduct.sku} • Current Stock: {selectedProduct.stock_quantity || 0}
                    </p>
                    {!selectedProduct.is_active && (
                      <p className="text-xs text-status-warning mt-1">
                        ⚠️ This product is currently inactive. Restocking will reactivate it.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="text-sm transition-colors text-text-secondary hover:text-black dark:text-gray-400 dark:hover:text-white"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Restock Form */}
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cost Price */}
                  <div>
                    <label htmlFor="cost_price" className="block mb-2 font-medium dark:text-gray-300">
                      Cost Price (C.P) *
                      <span className="ml-2 text-xs text-text-secondary dark:text-gray-400">(Hidden from public view)</span>
                      {userRole === 'Cashier' && (
                        <span className="ml-2 text-xs text-status-warning">(View only)</span>
                      )}
                    </label>
                    <input
                      id="cost_price"
                      name="cost_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cost_price}
                      onChange={handleChange}
                      disabled={userRole === 'Cashier'}
                      className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 disabled:bg-gray-100 border-black focus:ring-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-gray-500"
                      required
                    />
                  </div>

                  {/* Target Price */}
                  <div>
                    <label htmlFor="selling_price" className="block mb-2 font-medium dark:text-gray-300">
                      Selling Price *
                      {userRole === 'Cashier' && (
                        <span className="ml-2 text-xs text-status-warning">(View only)</span>
                      )}
                    </label>
                    <input
                      id="selling_price"
                      name="selling_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.selling_price}
                      onChange={handleChange}
                      disabled={userRole === 'Cashier'}
                      className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 disabled:bg-gray-100 border-black focus:ring-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-gray-500"
                      required
                    />
                    {formData.cost_price && formData.selling_price && (
                      <p className="mt-1 text-xs text-text-secondary">
                        Profit margin: {(((parseFloat(formData.selling_price) - parseFloat(formData.cost_price)) / parseFloat(formData.cost_price)) * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>

                  {/* Lowest Negotiable Price */}
                  <div>
                    <label htmlFor="lowest_negotiable_price" className="block mb-2 font-medium dark:text-gray-300">
                      Lowest Negotiable Price *
                      {userRole === 'Cashier' && (
                        <span className="ml-2 text-xs text-status-warning">(View only)</span>
                      )}
                    </label>
                    <input
                      id="lowest_negotiable_price"
                      name="lowest_negotiable_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.lowest_negotiable_price}
                      onChange={handleChange}
                      disabled={userRole === 'Cashier'}
                      className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 disabled:bg-gray-100 border-black focus:ring-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-gray-500"
                      required
                    />
                  </div>

                  {/* Quantity */}
                  <div>
                    <label htmlFor="quantity_added" className="block mb-2 font-medium dark:text-gray-300">
                      Quantity to Add *
                    </label>
                    <input
                      id="quantity_added"
                      name="quantity_added"
                      type="number"
                      min="1"
                      value={formData.quantity_added}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 border-black focus:ring-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-gray-500"
                      required
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Split Payment</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSplitPayment((prev) => !prev)
                        setCashPaid('')
                        setDigitalPaid('')
                        setFormData({ ...formData, amount_paid: '' })
                        setSelectedBankAccount('')
                      }}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                        isSplitPayment
                          ? 'bg-cyan-600 text-white border-cyan-600'
                          : 'bg-white border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {isSplitPayment ? 'On' : 'Off'}
                    </button>
                  </div>

                  {!isSplitPayment ? (
                    <>
                      {/* Amount Paid to Supplier */}
                      <div>
                        <label htmlFor="amount_paid" className="block mb-2 font-medium dark:text-gray-300">
                          Amount Paid to Supplier *
                        </label>
                        <input
                          id="amount_paid"
                          name="amount_paid"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.amount_paid}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 border-black focus:ring-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-gray-500"
                          required
                        />
                        {formData.cost_price && formData.quantity_added && (
                          <p className="mt-1 text-xs text-text-secondary">
                            Total: Rs. {(parseFloat(formData.cost_price) * parseInt(formData.quantity_added)).toLocaleString()}
                          </p>
                        )}
                      </div>

                      {/* Payment Method */}
                      <div>
                        <label htmlFor="payment_method" className="block mb-2 font-medium dark:text-gray-300">
                          Payment Method *
                        </label>
                        <select
                          id="payment_method"
                          name="payment_method"
                          value={formData.payment_method}
                          onChange={(e) => {
                            const nextMethod = e.target.value
                            setFormData({ ...formData, payment_method: nextMethod })
                            if (nextMethod !== 'Digital') {
                              setSelectedBankAccount('')
                            }
                          }}
                          className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 border-black focus:ring-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-gray-500"
                          required
                        >
                          <option value="Cash">Cash</option>
                          <option value="Digital">Digital (Bank Transfer)</option>
                        </select>
                        <p className="mt-1 text-xs text-text-secondary">
                          How are you paying the supplier?
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="cash_paid" className="block mb-2 font-medium dark:text-gray-300">
                          Cash Paid *
                        </label>
                        <input
                          id="cash_paid"
                          type="number"
                          step="0.01"
                          min="0"
                          value={cashPaid}
                          onChange={(e) => setCashPaid(e.target.value)}
                          className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 border-black focus:ring-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-gray-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="digital_paid" className="block mb-2 font-medium dark:text-gray-300">
                          Digital Paid *
                        </label>
                        <input
                          id="digital_paid"
                          type="number"
                          step="0.01"
                          min="0"
                          value={digitalPaid}
                          onChange={(e) => setDigitalPaid(e.target.value)}
                          className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 border-black focus:ring-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-gray-500"
                        />
                      </div>
                    </>
                  )}

                  {hasDigitalPayment() && (
                    <div className="md:col-span-2">
                      <label htmlFor="bank_account" className="block mb-2 font-medium dark:text-gray-300">
                        Bank Account *
                      </label>
                      <select
                        id="bank_account"
                        value={selectedBankAccount}
                        onChange={(e) => setSelectedBankAccount(e.target.value)}
                        className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 border-black focus:ring-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-gray-500"
                      >
                        <option value="">Select bank account</option>
                        {bankAccounts.map((account) => (
                          <option key={account.id} value={account.account_name}>
                            {account.account_name}
                          </option>
                        ))}
                      </select>
                      {bankAccountsLoading && (
                        <p className="mt-1 text-xs text-text-secondary">Loading bank accounts...</p>
                      )}
                      {!bankAccountsLoading && bankAccounts.length === 0 && (
                        <p className="mt-1 text-xs text-amber-600">No bank account found. Add one in Store Settings.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Payment Status Indicator */}
                {formData.cost_price && formData.quantity_added && (
                  <div className="mt-4">
                    {getPaidTotal() < (parseFloat(formData.cost_price) * parseInt(formData.quantity_added)) ? (
                      <div className="p-3 bg-yellow-50 rounded border border-yellow-300">
                        <p className="text-sm text-yellow-800">
                          <strong>Remaining:</strong> Rs. {(
                            (parseFloat(formData.cost_price) * parseInt(formData.quantity_added)) - getPaidTotal()
                          ).toLocaleString()}
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          This will be tracked in Supplier Khaata
                        </p>
                      </div>
                    ) : getPaidTotal() === (parseFloat(formData.cost_price) * parseInt(formData.quantity_added)) ? (
                      <div className="p-3 bg-green-50 rounded border border-green-300">
                        <p className="text-sm text-green-800">
                          ✓ Full payment made
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-red-50 rounded border border-red-300">
                        <p className="text-sm text-red-800">
                          ⚠ Amount paid exceeds total amount
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Supplier Section */}
                <div className="mt-4">
                  <label className="block mb-2 font-medium dark:text-gray-300">
                    Supplier
                    <span className="ml-2 text-xs text-text-secondary dark:text-gray-400">(Optional - search by phone)</span>
                  </label>
                  
                  {formData.supplier_id ? (
                    <div className="p-3 bg-green-50 border-2 border-green-500 rounded flex justify-between items-center">
                      <div>
                        <p className="font-medium text-green-800">{formData.supplier_name}</p>
                        <p className="text-sm text-green-600">{formData.supplier_phone}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, supplier_id: '', supplier_name: '', supplier_phone: '' })}
                        className="text-sm text-green-800 hover:underline"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <input
                          type="tel"
                          name="supplier_phone"
                          placeholder="Enter supplier phone number..."
                          value={formData.supplier_phone}
                          onChange={handleChange}
                          onFocus={() => formData.supplier_phone.length >= 3 && setShowSupplierDropdown(true)}
                          className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 border-black focus:ring-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:ring-gray-500"
                        />
                        
                        {showSupplierDropdown && filteredSuppliers.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 border-2 rounded shadow-lg max-h-48 overflow-y-auto bg-white border-black dark:bg-gray-700 dark:border-gray-600">
                            {filteredSuppliers.map((supplier) => (
                              <button
                                key={supplier.id}
                                type="button"
                                onClick={() => selectSupplier(supplier)}
                                className="w-full p-3 text-left border-b last:border-b-0 hover:bg-bg-secondary border-gray-200 dark:hover:bg-gray-600 dark:border-gray-600"
                              >
                                <p className="font-medium">{supplier.supplier_name}</p>
                                <p className="text-sm text-text-secondary">{supplier.phone_number}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {formData.supplier_phone && filteredSuppliers.length === 0 && formData.supplier_phone.length >= 3 && (
                        <div className="mt-2">
                          <p className="text-sm mb-2 text-text-secondary dark:text-gray-400">New supplier - enter name:</p>
                          <input
                            type="text"
                            name="supplier_name"
                            placeholder="Supplier name"
                            value={formData.supplier_name}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 border-black focus:ring-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 dark:focus:ring-gray-500"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* IMEI Section - Only for phones */}
                {selectedProduct.is_phone && formData.quantity_added && parseInt(formData.quantity_added) > 0 && (
                  <div className="mt-4">
                    <label className="block mb-2 font-medium dark:text-gray-300">
                      IMEI Numbers *
                      <span className="ml-2 text-xs text-text-secondary dark:text-gray-400">
                        ({formData.imei_numbers.filter(i => i.trim()).length}/{parseInt(formData.quantity_added)})
                      </span>
                    </label>
                    <div className="space-y-3 max-h-64 overflow-y-auto border rounded-lg p-4 border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/30">
                      {formData.imei_numbers.map((imei, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={imei}
                            onChange={(e) => handleIMEIChange(index, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                // If not the last IMEI field, move to next
                                if (index < formData.imei_numbers.length - 1) {
                                  const nextInput = e.currentTarget.parentElement?.nextElementSibling?.querySelector('input')
                                  nextInput?.focus()
                                }
                              }
                            }}
                            autoFocus={index === 0}
                            placeholder={`IMEI #${index + 1} (15 digits)`}
                            className="flex-1 px-3 py-2.5 border rounded-lg font-mono focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 border-gray-300 bg-white dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
                            maxLength={15}
                            required
                          />
                          {formData.imei_numbers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeIMEIField(index)}
                              title={`Remove IMEI #${index + 1}`}
                              aria-label={`Remove IMEI #${index + 1}`}
                              className="px-3 py-2 border rounded-lg transition-colors border-red-300 text-red-500 hover:bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-900/30"
                            >
                              <XIcon size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      {formData.imei_numbers.length < parseInt(formData.quantity_added) && (
                        <button
                          type="button"
                          onClick={addIMEIField}
                          className="w-full px-3 py-2.5 border rounded-lg transition-colors border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          + Add IMEI
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="flex gap-4 mt-6">
                  <button
                    type="button"
                    onClick={() => onClose(false)}
                    className="flex-1 px-4 py-3 border-2 rounded transition-colors font-medium border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors disabled:opacity-50 font-medium"
                  >
                    {loading ? 'Restocking...' : 'Restock Product'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
