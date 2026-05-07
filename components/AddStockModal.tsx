'use client'

import { useState, useEffect } from 'react'
import { XIcon, PlusIcon, MagnifyingGlassIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { getCashierId, getManagerId, getStoreId } from '@/lib/supabase'

interface Category {
  id: number
  name: string
  subcategories?: Subcategory[]
}

interface Subcategory {
  id: number
  name: string
}

interface Supplier {
  id: number
  supplier_name: string
  phone_number: string
  email?: string
  address?: string
}

interface BankAccount {
  id: number
  store_id: number
  account_name: string
}

interface AddStockModalProps {
  onClose: (refresh: boolean) => void
  isInitialStock?: boolean // Flag to mark stock as initial (not counted as expense)
}

export default function AddStockModal({ onClose, isInitialStock = false }: AddStockModalProps) {
  const [step, setStep] = useState(1) // Multi-step form
  const [formData, setFormData] = useState({
    // Step 1: Product Info
    category_id: '',
    subcategory_id: '',
    name: '',
    description: '',
    barcode: '', // Barcode for non-phone products
    
    // Step 2: Pricing
    cost_price: '',
    selling_price: '',
    lowest_negotiable_price: '',
    
    // Step 3: Stock & Supplier
    quantity: '',
    low_stock_threshold: '10',
    supplier_id: '',
    supplier_name: '',
    supplier_phone: '',
    
    // Payment to supplier
    amount_paid: '',
    payment_method: 'Cash', // Payment method: Cash or Digital
    
    // Step 4: IMEI (conditional)
    imei_numbers: [''],
  })

  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([])
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [isPhoneCategory, setIsPhoneCategory] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedSKU, setGeneratedSKU] = useState('')
  const [imeiErrors, setImeiErrors] = useState<string[]>([])
  const [isSplitPayment, setIsSplitPayment] = useState(false)
  const [cashPaid, setCashPaid] = useState('')
  const [digitalPaid, setDigitalPaid] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false)
  const [selectedBankAccount, setSelectedBankAccount] = useState('')

  useEffect(() => {
    fetchCategories()
    fetchSuppliers()
    fetchNextSKU()
    fetchBankAccounts()
  }, [])

  const fetchCategories = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/categories?store_id=${storeId}`)
      const result = await response.json()
      
      if (result.success) {
        setCategories(result.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/suppliers?store_id=${storeId}`)
      const result = await response.json()
      
      if (result.success) {
        setSuppliers(result.data || [])
        setFilteredSuppliers(result.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch suppliers:', err)
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

  const fetchNextSKU = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found')
        return
      }
      
      const response = await fetch(`/api/products/next-sku?store_id=${storeId}`)
      const result = await response.json()
      if (result.success) {
        setGeneratedSKU(result.sku)
      }
    } catch (err) {
      console.error('Failed to generate SKU')
    }
  }

  const loadSubcategories = (categoryId: number | string) => {
    const category = categories.find(c => c.id === Number(categoryId))
    setSubcategories(category?.subcategories || [])
    
    // Check if this category requires IMEI tracking based on database flag
    const requiresImei = (category as any)?.requires_imei || false
    setIsPhoneCategory(requiresImei)
    
    // Reset IMEI if not a phone category
    if (!requiresImei) {
      setFormData(prev => ({ ...prev, imei_numbers: [''] }))
    }
  }

  const handleCategoryChange = (value: string) => {
    setFormData({
      ...formData,
      category_id: value,
      subcategory_id: '', // Reset subcategory
    })
    
    if (value) {
      loadSubcategories(value)
    } else {
      setSubcategories([])
      setIsPhoneCategory(false)
    }
  }

  const handleSupplierSearch = (value: string) => {
    setFormData({ ...formData, supplier_phone: value, supplier_id: '', supplier_name: '' })
    
    if (value.length > 0) {
      const filtered = suppliers.filter(s =>
        s.phone_number.includes(value) ||
        s.supplier_name.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredSuppliers(filtered)
      setShowSupplierDropdown(true)
    } else {
      setFilteredSuppliers(suppliers)
      setShowSupplierDropdown(false)
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
  }

  const addIMEIField = () => {
    setFormData({
      ...formData,
      imei_numbers: [...formData.imei_numbers, ''],
    })
  }

  const removeIMEIField = (index: number) => {
    const newImeis = formData.imei_numbers.filter((_, i) => i !== index)
    setFormData({
      ...formData,
      imei_numbers: newImeis.length > 0 ? newImeis : [''],
    })
  }

  const updateIMEI = (index: number, value: string) => {
    const newImeis = [...formData.imei_numbers]
    newImeis[index] = value
    setFormData({
      ...formData,
      imei_numbers: newImeis,
    })
    
    // Validate IMEI format in real-time
    const newErrors = [...imeiErrors]
    if (value.trim().length > 0) {
      if (!/^\d{15}$/.test(value.trim())) {
        newErrors[index] = 'IMEI must be exactly 15 digits'
      } else {
        newErrors[index] = ''
      }
    } else {
      newErrors[index] = ''
    }
    setImeiErrors(newErrors)
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

  const validateStep = (currentStep: number): boolean => {
    setError('')
    
    switch (currentStep) {
      case 1:
        if (!formData.category_id) {
          setError('Please select a category')
          return false
        }
        if (!formData.name.trim()) {
          setError('Please enter product name')
          return false
        }
        return true
        
      case 2:
        if (!formData.cost_price || parseFloat(formData.cost_price) <= 0) {
          setError('Please enter a valid cost price')
          return false
        }
        if (!formData.selling_price || parseFloat(formData.selling_price) <= 0) {
          setError('Please enter a valid selling price')
          return false
        }
        if (!formData.lowest_negotiable_price || parseFloat(formData.lowest_negotiable_price) <= 0) {
          setError('Please enter a valid lowest negotiable price')
          return false
        }
        if (parseFloat(formData.lowest_negotiable_price) > parseFloat(formData.selling_price)) {
          setError('Lowest negotiable price cannot be higher than selling price')
          return false
        }
        return true
        
      case 3:
        if (!formData.quantity || parseInt(formData.quantity) <= 0) {
          setError('Please enter a valid quantity')
          return false
        }
        if (!formData.supplier_phone.trim()) {
          setError('Please enter supplier phone number')
          return false
        }
        if (!isSplitPayment && formData.amount_paid.trim().length === 0) {
          setError('Please enter amount paid to supplier')
          return false
        }

        const totalAmount = parseFloat(formData.cost_price) * parseInt(formData.quantity)
        const paidTotal = getPaidTotal()

        if (isSplitPayment && paidTotal === 0) {
          setError('Please enter cash or digital payment amount')
          return false
        }

        if (paidTotal < 0) {
          setError('Amount paid must be a positive number')
          return false
        }

        if (paidTotal > totalAmount) {
          setError('Amount paid cannot exceed total amount')
          return false
        }

        if (hasDigitalPayment() && bankAccounts.length === 0) {
          setError('No bank account found. Please add one in Store Settings before taking digital payments.')
          return false
        }

        if (hasDigitalPayment() && !selectedBankAccount) {
          setError('Please select a bank account for Digital payment')
          return false
        }
        return true
        
      case 4:
        if (isPhoneCategory) {
          const validImeis = formData.imei_numbers.filter(i => i.trim().length > 0)
          const quantity = parseInt(formData.quantity)
          if (validImeis.length !== quantity) {
            setError(`Please enter exactly ${quantity} IMEI number(s) to match the quantity`)
            return false
          }
          // Validate IMEI format (must be exactly 15 digits)
          for (let i = 0; i < validImeis.length; i++) {
            const imei = validImeis[i].trim()
            if (!/^\d{15}$/.test(imei)) {
              setError(`IMEI #${i + 1} must be exactly 15 digits (current: ${imei.length} characters)`)
              return false
            }
          }
          // Check for duplicates
          const uniqueImeis = new Set(validImeis)
          if (uniqueImeis.size !== validImeis.length) {
            setError('Duplicate IMEI numbers detected')
            return false
          }
        }
        return true
        
      default:
        return true
    }
  }

  const nextStep = () => {
    if (validateStep(step)) {
      // Skip IMEI step if not a phone category
      if (step === 3 && !isPhoneCategory) {
        handleSubmit()
      } else {
        setStep(step + 1)
      }
    }
  }

  const prevStep = () => {
    setError('')
    setStep(step - 1)
  }

  const handleSubmit = async () => {
    if (!validateStep(step)) return
    
    setLoading(true)
    setError('')

    try {
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        setLoading(false)
        return
      }

      // Step 1: Create or get supplier
      let supplierId = formData.supplier_id ? parseInt(formData.supplier_id) : null

      if (!supplierId && formData.supplier_phone) {
        // Create new supplier
        const supplierResponse = await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: storeId,
            supplier_name: formData.supplier_name || 'Unknown Supplier',
            phone_number: formData.supplier_phone,
          }),
        })

        const supplierResult = await supplierResponse.json()
        if (supplierResult.success) {
          supplierId = supplierResult.data.id
        } else if (supplierResponse.status === 409) {
          // Supplier exists, fetch it
          const existingSupplier = suppliers.find(s => s.phone_number === formData.supplier_phone)
          if (existingSupplier) {
            supplierId = existingSupplier.id
          }
        }
      }

      // Step 2: Create product with new price fields
      const productPayload = {
        store_id: storeId,
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        category_id: parseInt(formData.category_id),
        subcategory_id: formData.subcategory_id ? parseInt(formData.subcategory_id) : null,
        is_phone: isPhoneCategory,
        barcode: !isPhoneCategory && formData.barcode ? formData.barcode.trim() : null, // Only for non-phone products
        
        // Stock information - allow 0 as valid value
        low_stock_threshold: formData.low_stock_threshold !== '' ? parseInt(formData.low_stock_threshold) : 10,
      }

      const productResponse = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productPayload),
      })

      const productResult = await productResponse.json()
      if (!productResult.success) {
        throw new Error(productResult.error || 'Failed to create product')
      }

      const productId = productResult.data.id

      // Step 3: Validate supplier info if partial payment
      const totalAmount = parseFloat(formData.cost_price) * parseInt(formData.quantity)
      const amountPaid = getPaidTotal()
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
      
      // Supplier info is required when partial payment
      if (amountPaid < totalAmount && !formData.supplier_phone) {
        setError('Supplier information is required when making partial payment')
        setLoading(false)
        return
      }
      
      const batchPayload = {
        product_id: productId,
        store_id: storeId,
        supplier_id: supplierId,
        cost_price: parseFloat(formData.cost_price),
        quantity_purchased: parseInt(formData.quantity),
        selling_price: parseFloat(formData.selling_price),
        lowest_negotiable_price: parseFloat(formData.lowest_negotiable_price),
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
        throw new Error(batchResult.error || 'Failed to create stock batch')
      }

      const batchId = batchResult.data.batch.id

      // Step 4: Add IMEIs if phone category
      if (isPhoneCategory) {
        const validImeis = formData.imei_numbers.filter(i => i.trim().length > 0)
        
        if (validImeis.length > 0) {
          const imeiPayload = {
            product_id: productId,
            store_id: storeId,
            batch_id: batchId,
            imei_numbers: validImeis,
          }

          const imeiResponse = await fetch('/api/imeis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(imeiPayload),
          })

          const imeiResult = await imeiResponse.json()
          if (!imeiResult.success) {
            console.error('Failed to add IMEIs:', imeiResult.error)
            // Don't fail the whole operation, just warn
          }
        }
      }

      // Success!
      onClose(true)
    } catch (err: any) {
      setError(err.message || 'Failed to add stock')
    } finally {
      setLoading(false)
    }
  }

  const totalAmountValue = formData.cost_price && formData.quantity
    ? parseFloat(formData.cost_price) * parseInt(formData.quantity)
    : 0
  const paidTotalValue = getPaidTotal()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-lg border w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold">Add Stock</h2>
            <p className="text-xs text-text-secondary mt-1">
              Step {step} of {isPhoneCategory ? 4 : 3}
            </p>
          </div>
          <button
            onClick={() => onClose(false)}
            title="Close add stock"
            aria-label="Close add stock"
            className="p-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
            disabled={loading}
          >
            <XIcon size={24} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-3 bg-status-error text-white rounded">
            {error}
          </div>
        )}

        <form className="p-6" onSubmit={(e) => e.preventDefault()}>
          {/* Step 1: Product Information */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold mb-4">Product Information</h3>
              
              <div>
                <label className="block mb-2 font-medium">
                  SKU (Auto-generated)
                </label>
                <div className="w-full px-3 py-2 border-2 rounded font-mono border-gray-300 bg-gray-100 text-text-secondary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400">
                  {generatedSKU || 'Loading...'}
                </div>
              </div>

              <div>
                <label htmlFor="category_id" className="block mb-2 font-medium">
                  Category *
                </label>
                <select
                  id="category_id"
                  autoFocus
                  value={formData.category_id}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (formData.category_id) {
                        // Wait for subcategory to render before trying to focus it
                        setTimeout(() => {
                          const subcategoryEl = document.getElementById('subcategory_id')
                          if (subcategoryEl) {
                            subcategoryEl.focus()
                          } else if (!isPhoneCategory) {
                            // No subcategory, go to barcode for non-phone categories
                            document.getElementById('barcode')?.focus()
                          } else {
                            document.getElementById('name')?.focus()
                          }
                        }, 50)
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={loading}
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.category_id && (
                <div>
                  <label htmlFor="subcategory_id" className="block mb-2 font-medium">
                    Subcategory
                  </label>
                  <select
                    id="subcategory_id"
                    value={formData.subcategory_id}
                    onChange={(e) => setFormData({ ...formData, subcategory_id: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        // Move to barcode field for non-phone, otherwise to name
                        if (!isPhoneCategory) {
                          document.getElementById('barcode')?.focus()
                        } else {
                          document.getElementById('name')?.focus()
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    disabled={loading || subcategories.length === 0}
                  >
                    <option value="">Select a subcategory (optional)</option>
                    {subcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Barcode field - moved to top after category/subcategory for non-phone products */}
              {!isPhoneCategory && (
                <div>
                  <label htmlFor="barcode" className="block mb-2 font-medium">
                    Barcode <span className="text-text-secondary font-normal">(Optional - Scan or leave empty to auto-generate)</span>
                  </label>
                  <input
                    id="barcode"
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        document.getElementById('name')?.focus()
                      }
                    }}
                    className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    disabled={loading}
                    placeholder="Scan barcode or leave empty to auto-generate"
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    Scan barcode here first, then continue with product details. If left empty, a unique barcode will be auto-generated.
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="name" className="block mb-2 font-medium">
                  Product Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      document.getElementById('description')?.focus()
                    }
                  }}
                  className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={loading}
                  placeholder="Enter product name"
                />
              </div>

              <div>
                <label htmlFor="description" className="block mb-2 font-medium">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      const nextBtn = document.querySelector('[data-step-action="next"]') as HTMLButtonElement
                      nextBtn?.click()
                    }
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={loading}
                  placeholder="Optional product description"
                />
              </div>
            </div>
          )}

          {/* Step 2: Pricing */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold mb-4">Pricing Information</h3>

              <div>
                <label htmlFor="cost_price" className="block mb-2 font-medium">
                  Cost Price (C.P) *
                </label>
                <input
                  id="cost_price"
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      document.getElementById('selling_price')?.focus()
                    }
                  }}
                  className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={loading}
                  placeholder="Purchase price"
                />
                <p className="text-xs text-text-secondary mt-1">
                  This will be hidden from public inventory view
                </p>
              </div>

              <div>
                <label htmlFor="selling_price" className="block mb-2 font-medium">
                  Selling Price *
                </label>
                <input
                  id="selling_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      document.getElementById('lowest_negotiable_price')?.focus()
                    }
                  }}
                  className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={loading}
                  placeholder="Regular selling price"
                />
              </div>

              <div>
                <label htmlFor="lowest_negotiable_price" className="block mb-2 font-medium">
                  Lowest Negotiable Price *
                </label>
                <input
                  id="lowest_negotiable_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.lowest_negotiable_price}
                  onChange={(e) => setFormData({ ...formData, lowest_negotiable_price: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const nextBtn = document.querySelector('[data-step-action="next"]') as HTMLButtonElement
                      nextBtn?.click()
                    }
                  }}
                  className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={loading}
                  placeholder="Lowest negotiable price"
                />
              </div>

              {formData.cost_price && formData.selling_price && (
                <div className="p-3 bg-gray-100 rounded border border-gray-300 dark:bg-gray-800 dark:border-gray-600">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Price Summary:</p>
                  <p className="text-xs text-text-secondary mt-1 dark:text-gray-300">
                    Profit Margin: {((parseFloat(formData.selling_price) - parseFloat(formData.cost_price)) / parseFloat(formData.cost_price) * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Stock & Supplier */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold mb-4">Stock & Supplier Information</h3>

              <div>
                <label htmlFor="quantity" className="block mb-2 font-medium">
                  Quantity *
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  autoFocus
                  value={formData.quantity}
                  onChange={(e) => {
                    setFormData({ ...formData, quantity: e.target.value })
                    // Adjust IMEI fields to match quantity for phones
                    if (isPhoneCategory) {
                      const qty = parseInt(e.target.value) || 0
                      const newImeis = Array(qty).fill('').map((_, i) => formData.imei_numbers[i] || '')
                      setFormData(prev => ({ ...prev, imei_numbers: newImeis.length > 0 ? newImeis : [''] }))
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (isPhoneCategory) {
                        const nextBtn = document.querySelector('[data-step-action="next"]') as HTMLButtonElement
                        nextBtn?.click()
                      } else {
                        document.getElementById('supplier_name')?.focus()
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={loading}
                  placeholder="Number of items"
                />
              </div>

              <div>
                <label htmlFor="low_stock_threshold" className="block mb-2 font-medium">
                  Low Stock Alert Threshold
                </label>
                <input
                  id="low_stock_threshold"
                  type="number"
                  min="0"
                  value={formData.low_stock_threshold}
                  onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      document.getElementById('supplier_phone')?.focus()
                    }
                  }}
                  className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={loading}
                  placeholder="Alert when stock falls below this number"
                />
                <p className="text-xs text-text-secondary mt-1">
                  You'll be notified when stock reaches this level (default: 10)
                </p>
              </div>

              <div className="relative">
                <label htmlFor="supplier_phone" className="block mb-2 font-medium">
                  Supplier Phone Number *
                </label>
                <div className="relative">
                  <input
                    id="supplier_phone"
                    type="text"
                    value={formData.supplier_phone}
                    onChange={(e) => handleSupplierSearch(e.target.value)}
                    onFocus={() => formData.supplier_phone && setShowSupplierDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const paymentInputId = isSplitPayment ? 'cash_paid' : 'amount_paid'
                        if (formData.supplier_id) {
                          document.getElementById(paymentInputId)?.focus()
                        } else {
                          document.getElementById('supplier_name')?.focus()
                        }
                      }
                    }}
                    className="w-full px-3 py-2 pr-10 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    disabled={loading}
                    placeholder="Enter phone number"
                  />
                  <MagnifyingGlassIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                </div>
                
                {showSupplierDropdown && filteredSuppliers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border-2 border-black rounded max-h-48 overflow-y-auto dark:bg-gray-800 dark:border-gray-600">
                    {filteredSuppliers.map((supplier) => (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => selectSupplier(supplier)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b border-gray-200 last:border-b-0 dark:hover:bg-gray-700 dark:border-gray-700"
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">{supplier.supplier_name}</div>
                        <div className="text-sm text-text-secondary dark:text-gray-400">{supplier.phone_number}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {formData.supplier_phone && !formData.supplier_id && (
                <div>
                  <label htmlFor="supplier_name" className="block mb-2 font-medium">
                    Supplier Name
                  </label>
                  <input
                    id="supplier_name"
                    type="text"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const paymentInputId = isSplitPayment ? 'cash_paid' : 'amount_paid'
                        document.getElementById(paymentInputId)?.focus()
                      }
                    }}
                    className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    disabled={loading}
                    placeholder="New supplier name (optional)"
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    This phone number will be saved for future use
                  </p>
                </div>
              )}

              {formData.supplier_id && (
                <div className="p-3 bg-green-50 rounded border border-green-300">
                  <p className="text-sm font-medium text-green-800">
                    Selected Supplier: {formData.supplier_name}
                  </p>
                </div>
              )}

              {/* Payment Information */}
              <div className="border-t-2 border-gray-200 pt-4 mt-4">
                <h4 className="font-bold mb-3">Payment to Supplier</h4>
                
                <div className="p-3 bg-blue-50 rounded border border-blue-300 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>Total Amount:</strong> PKR {formData.cost_price && formData.quantity ? 
                      (parseFloat(formData.cost_price) * parseInt(formData.quantity)).toLocaleString() : '0'}
                  </p>
                </div>

                <div className="mb-3 flex items-center justify-between">
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
                    <div>
                      <label htmlFor="amount_paid" className="block mb-2 font-medium">
                        Amount Paid to Supplier *
                      </label>
                      <input
                        id="amount_paid"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.amount_paid}
                        onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            document.getElementById('payment_method')?.focus()
                          }
                        }}
                        className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        disabled={loading}
                        placeholder="Enter amount paid"
                      />
                      <p className="text-xs text-text-secondary mt-1">
                        If amount paid is less than total, it will be added to Supplier Khaata
                      </p>
                    </div>

                    <div>
                      <label htmlFor="payment_method" className="block mb-2 font-medium">
                        Payment Method *
                      </label>
                      <select
                        id="payment_method"
                        value={formData.payment_method}
                        onChange={(e) => {
                          const nextMethod = e.target.value
                          setFormData({ ...formData, payment_method: nextMethod })
                          if (nextMethod !== 'Digital') {
                            setSelectedBankAccount('')
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            const nextBtn = document.querySelector('[data-step-action="next"]') as HTMLButtonElement
                            const submitBtn = document.querySelector('[data-step-action="submit"]') as HTMLButtonElement
                            if (nextBtn) {
                              nextBtn.click()
                            } else if (submitBtn) {
                              submitBtn.click()
                            }
                          }
                        }}
                        className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        disabled={loading}
                      >
                        <option value="Cash">Cash</option>
                        <option value="Digital">Digital (Bank Transfer)</option>
                      </select>
                      <p className="text-xs text-text-secondary mt-1">
                        How are you paying the supplier?
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="cash_paid" className="block mb-2 font-medium">
                        Cash Paid *
                      </label>
                      <input
                        id="cash_paid"
                        type="number"
                        min="0"
                        step="0.01"
                        value={cashPaid}
                        onChange={(e) => setCashPaid(e.target.value)}
                        className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        disabled={loading}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label htmlFor="digital_paid" className="block mb-2 font-medium">
                        Digital Paid *
                      </label>
                      <input
                        id="digital_paid"
                        type="number"
                        min="0"
                        step="0.01"
                        value={digitalPaid}
                        onChange={(e) => setDigitalPaid(e.target.value)}
                        className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        disabled={loading}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}

                {hasDigitalPayment() && (
                  <div>
                    <label htmlFor="bank_account" className="block mb-2 font-medium">
                      Bank Account *
                    </label>
                    <select
                      id="bank_account"
                      value={selectedBankAccount}
                      onChange={(e) => setSelectedBankAccount(e.target.value)}
                      className="w-full px-3 py-2 border-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      disabled={loading}
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
                      <p className="mt-1 text-xs text-amber-600">
                        No bank account found. Add one in Store Settings.
                      </p>
                    )}
                  </div>
                )}

                {formData.cost_price && formData.quantity && (
                  <div className="mt-3">
                    {paidTotalValue < totalAmountValue ? (
                      <div className="p-3 bg-yellow-50 rounded border border-yellow-300">
                        <p className="text-sm text-yellow-800">
                          <strong>Remaining:</strong> PKR {(
                            totalAmountValue - paidTotalValue
                          ).toLocaleString()}
                        </p>
                        <p className="text-xs text-yellow-700 mt-1">
                          This will be tracked in Supplier Khaata
                        </p>
                      </div>
                    ) : paidTotalValue === totalAmountValue ? (
                      <div className="p-3 bg-green-50 rounded border border-green-300">
                        <p className="text-sm text-green-800">
                          ✓ Full payment received
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
              </div>
            </div>
          )}

          {/* Step 4: IMEI Numbers (only for phones) */}
          {step === 4 && isPhoneCategory && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-cyan-50 border-cyan-200 dark:bg-gray-700/50 dark:border-gray-600">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">IMEI Numbers</h3>
                <p className="text-sm mt-1 text-gray-600 dark:text-gray-300">
                  Enter {formData.quantity} IMEI number(s) for this phone stock
                </p>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {formData.imei_numbers.map((imei, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-1">
                      <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                        IMEI {index + 1}
                      </label>
                      <input
                        id={index === 0 ? 'first-imei-input' : undefined}
                        autoFocus={index === 0}
                        type="text"
                        value={imei}
                        onChange={(e) => updateIMEI(index, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            // If not the last IMEI field, move to next
                            if (index < formData.imei_numbers.length - 1) {
                              const nextInput = e.currentTarget.parentElement?.parentElement?.nextElementSibling?.querySelector('input')
                              nextInput?.focus()
                            } else {
                              // Last field - trigger submit
                              const submitBtn = document.querySelector('[data-step-action="submit"]') as HTMLButtonElement
                              submitBtn?.click()
                            }
                          }
                        }}
                        className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 font-mono text-lg ${
                          imeiErrors[index] && imei.trim().length > 0
                            ? 'border-red-500'
                            : 'bg-white border-gray-300 dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-white'
                        }`}
                        disabled={loading}
                        placeholder="Enter 15-digit IMEI number"
                        maxLength={15}
                      />
                      {imeiErrors[index] && imei.trim().length > 0 && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                          <WarningCircleIcon size={12} />
                          {imeiErrors[index]}
                        </p>
                      )}
                      {imei.trim().length > 0 && imei.trim().length < 15 && !imeiErrors[index] && (
                        <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                          {imei.trim().length}/15 digits
                        </p>
                      )}
                      {imei.trim().length === 15 && /^\d{15}$/.test(imei.trim()) && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          ✓ Valid IMEI format
                        </p>
                      )}
                    </div>
                    {formData.imei_numbers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeIMEIField(index)}
                        title={`Remove IMEI #${index + 1}`}
                        aria-label={`Remove IMEI #${index + 1}`}
                        className="mt-7 px-3 py-2 border rounded-lg transition-colors border-red-300 text-red-500 hover:bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-900/30"
                        disabled={loading}
                      >
                        <XIcon size={20} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {formData.imei_numbers.length < parseInt(formData.quantity) && (
                <button
                  type="button"
                  onClick={addIMEIField}
                  className="flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  disabled={loading}
                >
                  <PlusIcon size={20} />
                  Add IMEI Field
                </button>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between gap-3 mt-6 pt-6 border-t-2 border-gray-200">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-6 py-2 border-2 rounded transition-colors font-medium border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                  disabled={loading}
                >
                  Back
                </button>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="px-6 py-2 border-2 rounded transition-colors font-medium border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                disabled={loading}
              >
                Cancel
              </button>
              
              {step < (isPhoneCategory ? 4 : 3) ? (
                <button
                  type="button"
                  onClick={nextStep}
                  data-step-action="next"
                  className="px-6 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors font-medium"
                  disabled={loading}
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  data-step-action="submit"
                  className="px-6 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors disabled:bg-gray-400 font-medium"
                  disabled={loading}
                >
                  {loading ? 'Adding Stock...' : 'Add Stock'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
