'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  FloppyDiskIcon,
  XIcon,
  PackageIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { getStoreId, getManagerId, getCashierId } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useCurrency } from '@/lib/currency-context'
import type { QuotationFormItem, ProductWithBackwardCompatibility } from '@/lib/types'

export default function CreateQuotationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const isDarkMode = useDarkMode()
  const { formatCurrency } = useCurrency()
  const searchRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Customer info
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')

  // Quotation details
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [termsAndConditions, setTermsAndConditions] = useState('')

  // Discount
  const [discountType, setDiscountType] = useState<'none' | 'fixed' | 'percentage'>('none')
  const [discountValue, setDiscountValue] = useState(0)

  // Items
  const [items, setItems] = useState<QuotationFormItem[]>([])

  // Product search
  const [products, setProducts] = useState<ProductWithBackwardCompatibility[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredProducts, setFilteredProducts] = useState<ProductWithBackwardCompatibility[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  // Manual item form
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualDescription, setManualDescription] = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [manualQty, setManualQty] = useState('1')

  // Finalize confirmation
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false)

  // Set default valid_until to 30 days from now
  useEffect(() => {
    if (!editId) {
      const defaultDate = new Date()
      defaultDate.setDate(defaultDate.getDate() + 30)
      setValidUntil(defaultDate.toISOString().split('T')[0])
    }
  }, [editId])

  // Fetch products for search
  useEffect(() => {
    fetchProducts()
  }, [])

  // Load existing quotation for editing
  useEffect(() => {
    if (editId) {
      loadQuotation(parseInt(editId))
    }
  }, [editId])

  const fetchProducts = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/products?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setProducts(result.data || [])
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    }
  }

  const loadQuotation = async (id: number) => {
    try {
      setLoading(true)
      const storeId = getStoreId()
      const response = await fetch(`/api/quotations/${id}?store_id=${storeId}`)
      const result = await response.json()

      if (result.success && result.data) {
        const q = result.data
        setCustomerName(q.customer_name || '')
        setCustomerPhone(q.customer_phone || '')
        setCustomerEmail(q.customer_email || '')
        setCustomerAddress(q.customer_address || '')
        setValidUntil(q.valid_until || '')
        setNotes(q.notes || '')
        setTermsAndConditions(q.terms_and_conditions || '')
        setDiscountType(q.discount_type || 'none')
        setDiscountValue(q.discount_value || 0)

        if (q.quotation_items) {
          setItems(
            q.quotation_items.map((item: QuotationFormItem) => ({
              ...item,
              temp_id: `existing-${item.id}`,
            }))
          )
        }
      } else {
        setError('Failed to load quotation')
      }
    } catch (err) {
      setError('Failed to load quotation')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Product search filtering
  useEffect(() => {
    if (searchTerm.length > 0) {
      const searchLower = searchTerm.toLowerCase()
      const filtered = products.filter((p) => {
        const nameLower = p.name.toLowerCase()
        const skuLower = p.sku.toLowerCase()
        if (skuLower.startsWith(searchLower)) return true
        const words = nameLower.split(/\s+/)
        return words.some(word => word.startsWith(searchLower))
      })
      setFilteredProducts(filtered.slice(0, 10))
      setShowDropdown(true)
      setHighlightedIndex(-1)
    } else {
      setFilteredProducts([])
      setShowDropdown(false)
    }
  }, [searchTerm, products])

  // Add product from inventory
  const addProduct = (product: ProductWithBackwardCompatibility) => {
    const sellingPrice = product.aggregated_stock?.aggregated_selling_price || 0
    const newItem: QuotationFormItem = {
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku,
      product_description: product.description || '',
      product_category: '',
      quantity: 1,
      unit_price: sellingPrice,
      line_total: sellingPrice,
      is_manual_item: false,
      notes: '',
      sort_order: items.length,
      temp_id: `item-${Date.now()}-${Math.random()}`,
      stock_available: product.stock_quantity || 0,
    }
    setItems(prev => [...prev, newItem])
    setSearchTerm('')
    setShowDropdown(false)
    searchRef.current?.focus()
  }

  // Add manual item
  const addManualItem = () => {
    if (!manualName.trim()) {
      setError('Product name is required for manual items')
      return
    }
    const price = parseFloat(manualPrice) || 0
    const qty = parseInt(manualQty) || 1

    const newItem: QuotationFormItem = {
      product_id: null,
      product_name: manualName.trim(),
      product_sku: '',
      product_description: manualDescription.trim(),
      product_category: '',
      quantity: qty,
      unit_price: price,
      line_total: Math.round(qty * price * 100) / 100,
      is_manual_item: true,
      notes: '',
      sort_order: items.length,
      temp_id: `manual-${Date.now()}-${Math.random()}`,
    }
    setItems(prev => [...prev, newItem])
    setManualName('')
    setManualDescription('')
    setManualPrice('')
    setManualQty('1')
    setShowManualForm(false)
  }

  // Remove item
  const removeItem = (tempId: string) => {
    setItems(prev => prev.filter(item => item.temp_id !== tempId))
  }

  // Update item quantity (integer only)
  const updateItemQuantity = (tempId: string, qty: number) => {
    const intQty = Math.max(1, Math.round(qty))
    setItems(prev =>
      prev.map(item =>
        item.temp_id === tempId
          ? { ...item, quantity: intQty, line_total: Math.round(intQty * item.unit_price * 100) / 100 }
          : item
      )
    )
  }

  // Update item price
  const updateItemPrice = (tempId: string, price: number) => {
    setItems(prev =>
      prev.map(item =>
        item.temp_id === tempId
          ? { ...item, unit_price: price, line_total: Math.round(item.quantity * price * 100) / 100 }
          : item
      )
    )
  }

  // Financial calculations
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0)
  const roundedSubtotal = Math.round(subtotal * 100) / 100

  let discountAmount = 0
  if (discountValue > 0) {
    if (discountType === 'percentage') {
      discountAmount = Math.round((roundedSubtotal * discountValue) / 100 * 100) / 100
    } else if (discountType === 'fixed') {
      discountAmount = Math.min(discountValue, roundedSubtotal)
    }
  }
  discountAmount = Math.round(discountAmount * 100) / 100
  const total = Math.round((roundedSubtotal - discountAmount) * 100) / 100

  // Save quotation
  const saveQuotation = async (finalize: boolean = false) => {
    try {
      if (items.length === 0) {
        setError('Add at least one item to the quotation')
        return
      }

      setSaving(true)
      setError('')
      const storeId = getStoreId()
      const managerId = await getManagerId()
      const cashierId = getCashierId()

      const payload = {
        store_id: storeId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_address: customerAddress,
        valid_until: validUntil || null,
        notes,
        terms_and_conditions: termsAndConditions,
        discount_type: discountType,
        discount_value: discountValue,
        items: items.map((item, idx) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          product_description: item.product_description,
          product_category: item.product_category,
          quantity: item.quantity,
          unit_price: item.unit_price,
          is_manual_item: item.is_manual_item,
          notes: item.notes,
          sort_order: idx,
        })),
        created_by: managerId,
        created_by_cashier_id: cashierId,
        updated_by: managerId,
        updated_by_cashier_id: cashierId,
      }

      let response: Response
      if (editId) {
        response = await fetch(`/api/quotations/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        response = await fetch('/api/quotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const result = await response.json()

      if (result.success) {
        if (finalize && result.data?.id) {
          // Finalize immediately after saving
          const finalizeResponse = await fetch(`/api/quotations/${result.data.id}/finalize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              store_id: storeId,
              finalized_by: managerId,
              finalized_by_cashier_id: cashierId,
            }),
          })
          const finalizeResult = await finalizeResponse.json()
          if (!finalizeResult.success) {
            setError(finalizeResult.error || 'Saved but failed to finalize')
            return
          }
        }
        router.push('/dashboard/quotations')
      } else {
        setError(result.error || 'Failed to save quotation')
      }
    } catch (err) {
      setError('Failed to save quotation')
      console.error(err)
    } finally {
      setSaving(false)
      setShowFinalizeConfirm(false)
    }
  }

  // Keyboard navigation for search dropdown
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || filteredProducts.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => Math.min(prev + 1, filteredProducts.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault()
      addProduct(filteredProducts[highlightedIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
      </div>
    )
  }

  const inputClasses = `w-full px-3 py-2.5 rounded-lg border text-sm ${
    isDarkMode
      ? 'bg-[#2a2a2a] border-gray-600 text-white placeholder-gray-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
  } focus:outline-none focus:ring-1 focus:ring-gray-400`

  const labelClasses = `block text-sm font-medium mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`

  return (
    <div className={`p-4 md:p-6 max-w-5xl mx-auto ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/dashboard/quotations')}
          className={`p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
        >
          <ArrowLeftIcon size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">
            {editId ? 'Edit Quotation' : 'New Quotation'}
          </h1>
          <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {editId ? 'Update quotation details' : 'Create a price estimate for your customer'}
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
          <WarningCircleIcon size={18} />
          <span className="text-sm flex-1">{error}</span>
          <button onClick={() => setError('')}>
            <XIcon size={16} />
          </button>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {successMessage}
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1: Customer Information */}
        <div className={`rounded-lg border p-5 ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-200'}`}>
          <h2 className="text-lg font-semibold mb-4">Customer Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Phone Number</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Enter phone number"
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Email Address</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="Enter email address"
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Address</label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Enter address"
                className={inputClasses}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Quotation Details */}
        <div className={`rounded-lg border p-5 ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-200'}`}>
          <h2 className="text-lg font-semibold mb-4">Quotation Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Valid Until</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className={inputClasses}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClasses}>Internal Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes (not printed on quotation)"
                rows={2}
                className={inputClasses}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClasses}>Terms & Conditions</label>
              <textarea
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                placeholder="Terms and conditions (printed on quotation)"
                rows={2}
                className={inputClasses}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Add Products */}
        <div className={`rounded-lg border p-5 ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Products</h2>
            <button
              onClick={() => setShowManualForm(!showManualForm)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${
                isDarkMode
                  ? 'border-gray-600 text-gray-300 hover:bg-[#2a2a2a]'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <PlusIcon size={16} />
              Add Manual Item
            </button>
          </div>

          {/* Product Search */}
          <div className="relative mb-4">
            <MagnifyingGlassIcon
              size={18}
              className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}
            />
            <input
              ref={searchRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Search products by name or SKU..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm ${
                isDarkMode
                  ? 'bg-[#2a2a2a] border-gray-600 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } focus:outline-none focus:ring-1 focus:ring-gray-400`}
            />

            {/* Product Search Dropdown */}
            {showDropdown && filteredProducts.length > 0 && (
              <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-xl z-30 max-h-60 overflow-y-auto ${
                isDarkMode ? 'bg-[#2a2a2a] border-gray-600' : 'bg-white border-gray-200'
              }`}>
                {filteredProducts.map((product, idx) => (
                  <button
                    key={product.id}
                    onMouseDown={() => addProduct(product)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm border-b last:border-b-0 ${
                      isDarkMode
                        ? `border-gray-700 ${idx === highlightedIndex ? 'bg-[#333]' : 'hover:bg-[#333]'}`
                        : `border-gray-100 ${idx === highlightedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <PackageIcon size={18} className={isDarkMode ? 'text-gray-500' : 'text-gray-400'} />
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          SKU: {product.sku} · Stock: {product.stock_quantity || 0}
                        </div>
                      </div>
                    </div>
                    <div className="font-medium">
                      {formatCurrency(product.aggregated_stock?.aggregated_selling_price || 0)}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showDropdown && searchTerm.length > 0 && filteredProducts.length === 0 && (
              <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg border p-4 text-center text-sm ${
                isDarkMode ? 'bg-[#2a2a2a] border-gray-600 text-gray-400' : 'bg-white border-gray-200 text-gray-500'
              }`}>
                No products found for &ldquo;{searchTerm}&rdquo;
              </div>
            )}
          </div>

          {/* Manual Item Form */}
          {showManualForm && (
            <div className={`mb-4 p-4 rounded-lg border ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
              <h4 className="text-sm font-medium mb-3">Add Manual Item</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Item name *"
                    className={inputClasses}
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={manualQty}
                    onChange={(e) => setManualQty(e.target.value)}
                    placeholder="Qty"
                    min="1"
                    step="1"
                    className={inputClasses}
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="Unit price"
                    min="0"
                    step="0.01"
                    className={`${inputClasses} no-spinners`}
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className={`flex-1 ${inputClasses}`}
                />
                <button
                  onClick={addManualItem}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm font-medium"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowManualForm(false)}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    isDarkMode ? 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Items Table */}
          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={isDarkMode ? 'bg-[#2a2a2a]' : 'bg-gray-50'}>
                  <tr>
                    <th className={`text-left text-xs font-medium uppercase tracking-wider px-3 py-2.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>#</th>
                    <th className={`text-left text-xs font-medium uppercase tracking-wider px-3 py-2.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Item</th>
                    <th className={`text-center text-xs font-medium uppercase tracking-wider px-3 py-2.5 w-24 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Qty</th>
                    <th className={`text-right text-xs font-medium uppercase tracking-wider px-3 py-2.5 w-32 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Unit Price</th>
                    <th className={`text-right text-xs font-medium uppercase tracking-wider px-3 py-2.5 w-32 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total</th>
                    <th className={`text-center text-xs font-medium uppercase tracking-wider px-3 py-2.5 w-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}></th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
                  {items.map((item, idx) => (
                    <tr key={item.temp_id}>
                      <td className={`px-3 py-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <div className="font-medium">{item.product_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.product_sku && (
                            <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              SKU: {item.product_sku}
                            </span>
                          )}
                          {item.is_manual_item && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Manual</span>
                          )}
                          {!item.is_manual_item && item.stock_available !== undefined && (
                            <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              Stock: {item.stock_available}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(item.temp_id!, parseInt(e.target.value) || 1)}
                          min="1"
                          step="1"
                          className={`w-20 text-center px-2 py-1.5 rounded border text-sm ${
                            isDarkMode
                              ? 'bg-[#2a2a2a] border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItemPrice(item.temp_id!, parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className={`w-28 text-right px-2 py-1.5 rounded border text-sm no-spinners ${
                            isDarkMode
                              ? 'bg-[#2a2a2a] border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                      </td>
                      <td className="px-3 py-3 text-sm text-right font-medium">
                        {formatCurrency(item.line_total)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => removeItem(item.temp_id!)}
                          className="p-1 text-red-500 hover:text-red-700 transition-colors"
                        >
                          <TrashIcon size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`text-center py-10 text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              <PackageIcon size={40} className="mx-auto mb-3 opacity-50" />
              <p>No items added yet</p>
              <p className="mt-1">Search for products above or add a manual item</p>
            </div>
          )}
        </div>

        {/* Section 5: Summary */}
        <div className={`rounded-lg border p-5 ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-200'}`}>
          <h2 className="text-lg font-semibold mb-4">Summary</h2>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Discount Controls */}
            <div className="flex-1">
              <label className={labelClasses}>Discount</label>
              <div className="flex gap-2">
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'none' | 'fixed' | 'percentage')}
                  className={`px-3 py-2.5 rounded-lg border text-sm ${
                    isDarkMode
                      ? 'bg-[#2a2a2a] border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="none">No Discount</option>
                  <option value="fixed">Fixed Amount</option>
                  <option value="percentage">Percentage</option>
                </select>
                {discountType !== 'none' && (
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    min="0"
                    max={discountType === 'percentage' ? 100 : undefined}
                    step={discountType === 'percentage' ? 1 : 0.01}
                    placeholder={discountType === 'percentage' ? '%' : 'Amount'}
                    className={`w-32 ${inputClasses}`}
                  />
                )}
              </div>
            </div>

            {/* Totals */}
            <div className="w-full md:w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Subtotal</span>
                <span className="font-medium">{formatCurrency(roundedSubtotal)}</span>
              </div>
              {discountType !== 'none' && discountAmount > 0 && (
                <div className="flex justify-between text-sm text-red-500">
                  <span>
                    Discount
                    {discountType === 'percentage' && ` (${discountValue}%)`}
                  </span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className={`flex justify-between pt-2 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <span className="text-lg font-bold">Grand Total</span>
                <span className="text-lg font-bold">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`flex flex-col sm:flex-row justify-end gap-3 pb-8`}>
          <button
            onClick={() => router.push('/dashboard/quotations')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium ${
              isDarkMode
                ? 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333] border border-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={() => saveQuotation(false)}
            disabled={saving || items.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FloppyDiskIcon size={18} />
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            onClick={() => setShowFinalizeConfirm(true)}
            disabled={saving || items.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircleIcon size={18} />
            Save & Finalize
          </button>
        </div>
      </div>

      {/* Finalize Confirmation Modal */}
      {showFinalizeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg border w-full max-w-md shadow-2xl ${isDarkMode ? 'bg-[#1a1a1a] border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-2">Finalize Quotation</h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Once finalized, this quotation cannot be edited unless reopened by a manager.
                Are you sure you want to finalize?
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowFinalizeConfirm(false)}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    isDarkMode
                      ? 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveQuotation(true)}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                >
                  {saving ? 'Processing...' : 'Yes, Finalize'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
