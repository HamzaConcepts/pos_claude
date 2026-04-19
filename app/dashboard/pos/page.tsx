'use client'

import { useEffect, useState, useRef } from 'react'
import { MagnifyingGlassIcon, PlusIcon, MinusIcon, TrashIcon, ShoppingCartIcon, PrinterIcon, CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react'
import type { ProductWithBackwardCompatibility } from '@/lib/types'
import { supabase, getStoreId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import IMEISelectionModal from '@/components/IMEISelectionModal'
import PrintReceiptButton from '@/components/PrintReceiptButton'
import { useCurrency } from '@/lib/currency-context'

interface CartItem {
  product: ProductWithBackwardCompatibility
  quantity: number
  imei_numbers?: string[]  // For phone products
}

export default function POSPage() {
  const router = useRouter()
  const { currency, formatCurrency } = useCurrency()
  const [products, setProducts] = useState<ProductWithBackwardCompatibility[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredProducts, setFilteredProducts] = useState<ProductWithBackwardCompatibility[]>([])
  const [quantityInputs, setQuantityInputs] = useState<Record<number, string>>({})
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Digital'>('Cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [saleDescription, setSaleDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastSale, setLastSale] = useState<any>(null)
  const [error, setError] = useState('')
  const [cashierId, setCashierId] = useState<string>('')
  const [selectedCashierFromSidebar, setSelectedCashierFromSidebar] = useState<any>(null)
  
  // IMEI selection states
  const [showIMEIModal, setShowIMEIModal] = useState(false)
  const [currentIMEIProduct, setCurrentIMEIProduct] = useState<CartItem | null>(null)
  
  // Partial payment states
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false)
  const [showPartialPaymentConfirm, setShowPartialPaymentConfirm] = useState(false)
  const [partialPaymentData, setPartialPaymentData] = useState({
    customerName: '',
    customerPhone: '',
    invoicePrice: ''
  })
  const [partialPaymentError, setPartialPaymentError] = useState('')
  const [existingCustomers, setExistingCustomers] = useState<any[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const customerNameInputRef = useRef<HTMLInputElement>(null)

  // Customer details states (for regular sales)
  const [customerDetails, setCustomerDetails] = useState({
    name: '',
    phone: '',
    cnic: ''
  })
  const [customerValidationErrors, setCustomerValidationErrors] = useState({
    phone: '',
    cnic: ''
  })
  const [allCustomers, setAllCustomers] = useState<any[]>([])
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([])
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const customerSearchRef = useRef<HTMLInputElement>(null)

  // Barcode scanning state
  const [barcodeBuffer, setBarcodeBuffer] = useState('')
  const [lastKeyTime, setLastKeyTime] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Arrow key navigation for product dropdown
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  // Collapsible customer details section
  const [isCustomerSectionExpanded, setIsCustomerSectionExpanded] = useState(false)

  // Receipt settings for preview
  const [receiptSettings, setReceiptSettings] = useState<any>(null)

  // Barcode scanner detection - scanners type fast and send Enter
  // Auto-select product when barcode is scanned (no confirmation needed)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // When Enter is pressed and we have a barcode buffer, search for product
      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        // Immediately search for the barcode
        const barcode = barcodeBuffer
        setBarcodeBuffer('')
        setLastKeyTime(0)
        handleBarcodeScanned(barcode)
        return
      }
    }

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in other inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (target !== searchInputRef.current) return
      }

      const currentTime = Date.now()
      const timeDiff = currentTime - lastKeyTime

      // Accumulate characters (scanner types fast)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (timeDiff < 100 || barcodeBuffer.length === 0) {
          setBarcodeBuffer(prev => prev + e.key)
          setLastKeyTime(currentTime)
        } else {
          // Slow typing - reset buffer
          setBarcodeBuffer(e.key)
          setLastKeyTime(currentTime)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true) // Use capture phase
    window.addEventListener('keypress', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keypress', handleKeyPress)
    }
  }, [barcodeBuffer, lastKeyTime])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerNameInputRef.current && !customerNameInputRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false)
      }
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
        setShowCustomerResults(false)
      }
    }

    if (showCustomerDropdown || showCustomerResults) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCustomerDropdown, showCustomerResults])

  useEffect(() => {
    fetchProducts()
    fetchCurrentUser()
    loadSelectedCashier()
    fetchAllCustomers()
    fetchReceiptSettings()
  }, [])

  const fetchAllCustomers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/partial-payment-customers?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        // Group by phone to get unique customers
        const uniqueCustomers = new Map()
        result.data.forEach((customer: any) => {
          if (!uniqueCustomers.has(customer.customer_phone)) {
            uniqueCustomers.set(customer.customer_phone, {
              name: customer.customer_name,
              phone: customer.customer_phone,
              id: customer.id
            })
          }
        })
        setAllCustomers(Array.from(uniqueCustomers.values()))
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    }
  }

  const fetchReceiptSettings = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      // Fetch receipt settings and store logo in parallel
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
          // Use store logo if receipt_settings doesn't have one
          logo_url: settingsResult.data.logo_url || storeLogo,
        })
      } else if (storeLogo) {
        // Even if no receipt settings, pass the store logo
        setReceiptSettings({ logo_url: storeLogo, show_logo: true })
      }
    } catch (err) {
      console.error('Failed to fetch receipt settings:', err)
    }
  }

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      // Search for product by barcode or IMEI
      const response = await fetch(`/api/products?store_id=${storeId}&barcode=${encodeURIComponent(barcode)}`)
      const result = await response.json()

      if (result.success && result.data.length > 0) {
        const product = result.data[0]
        
        // If it's a phone with IMEI match, we need to handle it specially
        if (product.is_phone && result.imei_match) {
          // Add to cart with specific IMEI
          const cartItem = { product, quantity: 1, imei_numbers: [barcode] }
          const existingIndex = cart.findIndex(item => item.product.id === product.id)
          
          if (existingIndex >= 0) {
            // Update existing cart item
            const newCart = [...cart]
            newCart[existingIndex] = {
              ...newCart[existingIndex],
              quantity: newCart[existingIndex].quantity + 1,
              imei_numbers: [...(newCart[existingIndex].imei_numbers || []), barcode]
            }
            setCart(newCart)
          } else {
            setCart([...cart, cartItem])
          }
          
          setError(`✓ Found by IMEI: ${product.name}`)
          setTimeout(() => setError(''), 2000)
        } else {
          // Regular product - add to cart
          addToCart(product)
          setError(`✓ Found by barcode: ${product.name}`)
          setTimeout(() => setError(''), 2000)
        }

        // Clear search
        setSearchTerm('')
      } else {
        setError(`Product not found for barcode: ${barcode}`)
        setTimeout(() => setError(''), 3000)
      }
    } catch (err) {
      setError('Failed to scan barcode')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleCustomerSearch = (searchValue: string) => {
    setCustomerDetails({ ...customerDetails, name: searchValue })
    
    if (searchValue.trim() === '') {
      setCustomerSearchResults([])
      setShowCustomerResults(false)
      return
    }

    // Search by name or phone
    const results = allCustomers.filter(customer => 
      customer.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      customer.phone.includes(searchValue)
    ).slice(0, 5) // Limit to 5 results

    setCustomerSearchResults(results)
    setShowCustomerResults(results.length > 0)
  }

  const normalizePhoneInput = (value: string): string => {
    const digitsOnly = value.replace(/\D/g, '')

    // Convert +92/92 prefixed numbers to local 03 format for consistency.
    if (digitsOnly.startsWith('92') && digitsOnly.length >= 12 && digitsOnly[2] === '3') {
      return `0${digitsOnly.slice(2, 12)}`
    }

    // Convert 3XXXXXXXXX to 03XXXXXXXXX.
    if (digitsOnly.startsWith('3') && digitsOnly.length >= 10) {
      return `0${digitsOnly.slice(0, 10)}`
    }

    return digitsOnly.slice(0, 11)
  }

  const formatCNICInput = (value: string): string => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 13)

    if (digitsOnly.length <= 5) {
      return digitsOnly
    }

    if (digitsOnly.length <= 12) {
      return `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5)}`
    }

    return `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5, 12)}-${digitsOnly.slice(12)}`
  }

  const validateCustomerPhone = (phone: string): string => {
    const trimmedPhone = phone.trim()
    if (!trimmedPhone) return ''

    const phonePattern = /^03\d{9}$/

    if (!phonePattern.test(trimmedPhone)) {
      return 'Phone number must be exactly 11 digits and start with 03.'
    }

    return ''
  }

  const validateCustomerCNIC = (cnic: string): string => {
    const trimmedCNIC = cnic.trim()
    if (!trimmedCNIC) return ''

    const dashedCNICPattern = /^\d{5}-\d{7}-\d$/

    if (!dashedCNICPattern.test(trimmedCNIC)) {
      return 'CNIC must be in XXXXX-XXXXXXX-X format.'
    }

    return ''
  }

  const getCustomerValidationErrors = (details: typeof customerDetails) => {
    return {
      phone: validateCustomerPhone(details.phone),
      cnic: validateCustomerCNIC(details.cnic),
    }
  }

  const selectCustomer = (customer: any) => {
    const selectedDetails = {
      name: customer.name,
      phone: normalizePhoneInput(customer.phone || ''),
      cnic: ''
    }

    setCustomerDetails(selectedDetails)
    setCustomerValidationErrors(getCustomerValidationErrors(selectedDetails))
    setShowCustomerResults(false)
  }

  const clearCustomer = () => {
    setCustomerDetails({ name: '', phone: '', cnic: '' })
    setCustomerValidationErrors({ phone: '', cnic: '' })
    setCustomerSearchResults([])
    setShowCustomerResults(false)
  }

  const loadSelectedCashier = () => {
    const savedCashier = localStorage.getItem('selected_cashier')
    if (savedCashier) {
      try {
        const cashier = JSON.parse(savedCashier)
        setSelectedCashierFromSidebar(cashier)
      } catch (err) {
        // Failed to parse saved cashier
      }
    }
  }

  // Listen for cashier selection changes from sidebar
  useEffect(() => {
    const handleCashierChange = () => {
      loadSelectedCashier()
    }

    // Listen for storage changes (when sidebar updates localStorage)
    window.addEventListener('storage', handleCashierChange)
    
    // Also listen for custom event (more reliable for same-window changes)
    window.addEventListener('cashierChanged', handleCashierChange)

    return () => {
      window.removeEventListener('storage', handleCashierChange)
      window.removeEventListener('cashierChanged', handleCashierChange)
    }
  }, [])

  useEffect(() => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const filtered = products.filter((p) => {
        const nameLower = p.name.toLowerCase()
        const skuLower = p.sku.toLowerCase()
        
        // Check if SKU starts with search term
        if (skuLower.startsWith(searchLower)) {
          return true
        }
        
        // Check if any word in the product name starts with the search term
        const words = nameLower.split(/\s+/)
        return words.some(word => word.startsWith(searchLower))
      })
      setFilteredProducts(filtered.slice(0, 10))
      setHighlightedIndex(-1) // Reset highlighted index when results change
    } else {
      setFilteredProducts([])
      setHighlightedIndex(-1)
    }
  }, [searchTerm, products])

  useEffect(() => {
    setQuantityInputs((prev) => {
      const next: Record<number, string> = {}
      cart.forEach((item) => {
        next[item.product.id] = String(item.quantity)
      })

      const sameLength = Object.keys(prev).length === Object.keys(next).length
      const sameValues = sameLength && Object.keys(next).every((key) => prev[Number(key)] === next[Number(key)])

      return sameValues ? prev : next
    })
  }, [cart])

  const fetchCurrentUser = async () => {
    // First check for Supabase Auth user (managers)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Manager is completing the sale - use their UUID
      setCashierId(user.id)
      return
    }
    
    // If no Supabase user, check for cashier session in localStorage
    const userSession = localStorage.getItem('user_session')
    if (userSession) {
      try {
        const session = JSON.parse(userSession)
        // Cashier session stores 'id', not 'user_id'
        // For cashier accounts, use the cashier account ID
        if (session.id) {
          setCashierId(session.id.toString())
        }
      } catch (err) {
        console.error('Failed to parse user session:', err)
      }
    }
  }

  const fetchProducts = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        router.push('/login')
        return
      }

      const response = await fetch(`/api/products?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setProducts(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch products')
    }
  }

  const addToCart = (product: ProductWithBackwardCompatibility) => {
    const existingItem = cart.find((item) => item.product.id === product.id)

    if (existingItem) {
      if (existingItem.quantity < product.stock_quantity) {
        const newQuantity = existingItem.quantity + 1
        
        // If it's a phone, prompt for IMEI selection
        if (product.is_phone) {
          const updatedItem = { ...existingItem, quantity: newQuantity }
          setCurrentIMEIProduct(updatedItem)
          setShowIMEIModal(true)
        } else {
          setCart(
            cart.map((item) =>
              item.product.id === product.id
                ? { ...item, quantity: newQuantity }
                : item
            )
          )
        }
      } else {
        alert(`Only ${product.stock_quantity} units available`)
      }
    } else {
      if (product.stock_quantity > 0) {
        const newItem = { product, quantity: 1 }
        
        // If it's a phone, prompt for IMEI selection
        if (product.is_phone) {
          setCurrentIMEIProduct(newItem)
          setShowIMEIModal(true)
        } else {
          setCart([...cart, newItem])
        }
      } else {
        alert('Product out of stock')
      }
    }

    setSearchTerm('')
    setFilteredProducts([])
  }

  const handleIMEISelection = (imeis: string[]) => {
    if (!currentIMEIProduct) return

    const existingIndex = cart.findIndex(
      (item) => item.product.id === currentIMEIProduct.product.id
    )

    const updatedItem = {
      ...currentIMEIProduct,
      imei_numbers: imeis,
    }

    if (existingIndex >= 0) {
      const newCart = [...cart]
      newCart[existingIndex] = updatedItem
      setCart(newCart)
    } else {
      setCart([...cart, updatedItem])
    }

    setShowIMEIModal(false)
    setCurrentIMEIProduct(null)
  }

  const updateQuantity = (productId: number, newQuantity: number) => {
    const item = cart.find((item) => item.product.id === productId)
    if (!item) return

    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }

    if (newQuantity > item.product.stock_quantity) {
      alert(`Only ${item.product.stock_quantity} units available`)
      return
    }

    // If it's a phone and quantity changed, require IMEI re-selection
    if (item.product.is_phone) {
      const updatedItem = { ...item, quantity: newQuantity }
      setCurrentIMEIProduct(updatedItem)
      setShowIMEIModal(true)
    } else {
      setCart(
        cart.map((cartItem) =>
          cartItem.product.id === productId
            ? { ...cartItem, quantity: newQuantity }
            : cartItem
        )
      )
    }
  }

  const handleQuantityInputChange = (productId: number, value: string) => {
    if (/^\d*$/.test(value)) {
      setQuantityInputs((prev) => ({
        ...prev,
        [productId]: value,
      }))
    }
  }

  const commitQuantityInput = (item: CartItem) => {
    const rawValue = (quantityInputs[item.product.id] ?? String(item.quantity)).trim()

    if (!rawValue) {
      setQuantityInputs((prev) => ({ ...prev, [item.product.id]: String(item.quantity) }))
      return
    }

    const parsedQuantity = Number.parseInt(rawValue, 10)
    if (Number.isNaN(parsedQuantity)) {
      setQuantityInputs((prev) => ({ ...prev, [item.product.id]: String(item.quantity) }))
      return
    }

    if (parsedQuantity !== item.quantity) {
      updateQuantity(item.product.id, parsedQuantity)
      // Keep showing current value until cart update (or validation) settles.
      setQuantityInputs((prev) => ({ ...prev, [item.product.id]: String(item.quantity) }))
      return
    }

    setQuantityInputs((prev) => ({ ...prev, [item.product.id]: String(item.quantity) }))
  }

  const removeFromCart = (productId: number) => {
    setCart(cart.filter((item) => item.product.id !== productId))
  }

  const clearCart = () => {
    if (confirm('Clear all items from cart?')) {
      setCart([])
      setAmountPaid('')
      setSaleDescription('')
      setError('')
    }
  }

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const price = item.product.aggregated_stock?.aggregated_selling_price || 0
      return sum + price * item.quantity
    }, 0)
  }

  const calculateLowestNegotiable = () => {
    return cart.reduce((sum, item) => {
      const price = item.product.aggregated_stock?.aggregated_lowest_negotiable || 0
      return sum + price * item.quantity
    }, 0)
  }

  const calculateChange = () => {
    const total = calculateTotal()
    const paid = parseFloat(amountPaid) || 0
    return paid - total
  }

  const handleProcessSale = async () => {
    if (cart.length === 0) {
      setError('Cart is empty')
      return
    }

    // Validate sale description
    let finalDescription = saleDescription.trim()
    if (cart.length > 1 && !finalDescription) {
      setError('Sale description is required for orders with multiple items')
      return
    }
    
    // If single item and no description, use product name
    if (cart.length === 1 && !finalDescription) {
      finalDescription = cart[0].product.name
    }

    const total = calculateTotal()
    const lowestNegotiable = calculateLowestNegotiable()
    const paid = parseFloat(amountPaid) || 0

    // If entered amount >= total: confirm payment
    if (paid >= total) {
      setError('')
      await processSaleTransaction(null, 0)
      return
    }

    // If entered amount < total but >= lowest negotiable: directly call appropriate handler
    if (paid >= lowestNegotiable && paid < total) {
      // This shouldn't be reached anymore as buttons call handlers directly
      setError('')
      return
    }

    // If entered amount < lowest negotiable: show Khaata modal
    if (paid < lowestNegotiable) {
      // Pre-fill with existing customer details if available
      if (customerDetails.name || customerDetails.phone) {
        setPartialPaymentData({
          customerName: customerDetails.name,
          customerPhone: customerDetails.phone,
          invoicePrice: '' // Only ask for invoice price
        })
      }
      setShowPartialPaymentModal(true)
      setError('')
      return
    }
  }

  const handleApplyDiscount = async () => {
    const total = calculateTotal()
    const paid = parseFloat(amountPaid) || 0
    const discountAmount = total - paid
    
    // Process sale with automatic discount
    await processSaleTransaction(null, discountAmount)
  }

  const handleGoToPartialPayment = () => {
    // Pre-fill with existing customer details if available
    if (customerDetails.name || customerDetails.phone) {
      setPartialPaymentData({
        customerName: customerDetails.name,
        customerPhone: customerDetails.phone,
        invoicePrice: '' // Only ask for invoice price
      })
    }
    setShowPartialPaymentModal(true)
    // Fetch existing customers when modal opens
    fetchExistingCustomers('')
  }

  const fetchExistingCustomers = async (searchQuery: string) => {
    try {
      const url = searchQuery
        ? `/api/partial-payment-customers?search=${encodeURIComponent(searchQuery)}`
        : '/api/partial-payment-customers'
      
      const response = await fetch(url)
      const result = await response.json()

      if (result.success) {
        setExistingCustomers(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch customers')
    }
  }

  const handleCustomerNameChange = (value: string) => {
    setPartialPaymentData({
      ...partialPaymentData,
      customerName: value
    })
    setPartialPaymentError('')
    
    // Show dropdown and fetch matching customers
    if (value.trim().length > 0) {
      setShowCustomerDropdown(true)
      fetchExistingCustomers(value)
    } else {
      setShowCustomerDropdown(false)
      setExistingCustomers([])
    }
  }

  const handleSelectCustomer = (customer: any) => {
    setPartialPaymentData({
      ...partialPaymentData,
      customerName: customer.customer_name,
      customerPhone: customer.customer_phone || ''
    })
    setShowCustomerDropdown(false)
    setPartialPaymentError('')
  }

  const handlePartialPaymentCancel = () => {
    setShowPartialPaymentConfirm(false)
    const total = calculateTotal()
    const paid = parseFloat(amountPaid) || 0
    setError(`Insufficient payment. Total: ${formatCurrency(total, 2)}, Paid: ${formatCurrency(paid, 2)}`)
  }

  const processSaleTransaction = async (
    partialPaymentCustomer: any,
    discountAmount: number = 0,
    invoiceTotal?: number
  ) => {
    setLoading(true)

    try {
      const paid = parseFloat(amountPaid) || 0
      let finalDescription = saleDescription.trim()
      const fallbackPartialCustomerName =
        typeof partialPaymentCustomer?.customer_name === 'string'
          ? partialPaymentCustomer.customer_name.trim()
          : ''
      const fallbackPartialCustomerPhone =
        typeof partialPaymentCustomer?.customer_phone === 'string'
          ? partialPaymentCustomer.customer_phone.trim()
          : ''
      const normalizedCustomerName = customerDetails.name.trim() || fallbackPartialCustomerName
      const normalizedCustomerPhone = customerDetails.phone.trim() || fallbackPartialCustomerPhone
      const validationErrors = getCustomerValidationErrors(customerDetails)
      
      if (cart.length === 1 && !finalDescription) {
        finalDescription = cart[0].product.name
      }

      if (validationErrors.phone || validationErrors.cnic) {
        setCustomerValidationErrors(validationErrors)
        setError(validationErrors.phone || validationErrors.cnic)
        setIsCustomerSectionExpanded(true)

        requestAnimationFrame(() => {
          const invalidInputId = validationErrors.phone ? 'customer-phone-input' : 'customer-cnic-input'
          const invalidInput = document.getElementById(invalidInputId) as HTMLInputElement | null
          invalidInput?.focus()
        })

        setLoading(false)
        return
      }

      if (paymentMethod === 'Digital' && !normalizedCustomerName) {
        setError('Customer name is required for Digital payment')
        setIsCustomerSectionExpanded(true)
        requestAnimationFrame(() => {
          const customerNameInput = document.getElementById('customer-name-input') as HTMLInputElement | null
          customerNameInput?.focus()
        })
        setLoading(false)
        return
      }

      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        router.push('/login')
        return
      }

      // Validate IMEI numbers for phone products
      for (const item of cart) {
        if (item.product.is_phone) {
          if (!item.imei_numbers || item.imei_numbers.length !== item.quantity) {
            setError(`Please select ${item.quantity} IMEI number${item.quantity > 1 ? 's' : ''} for ${item.product.name}`)
            setLoading(false)
            return
          }
        }
      }

      // Determine if this is a manager or cashier
      const { data: { user } } = await supabase.auth.getUser()
      const isManager = user !== null
      
      const saleData = {
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          imei_numbers: item.imei_numbers || [], // Include IMEI numbers
        })),
        sale_description: finalDescription,
        payment_method: paymentMethod,
        amount_paid: paid,
        // If manager is making sale, send their UUID. If cashier, send null and use cashier_ref_id
        cashier_id: isManager ? cashierId : null,
        // Manager: don't use sidebar selection, always null so manager's name shows
        // Cashier: use selected cashier from sidebar OR their own ID
        cashier_ref_id: isManager ? null : (selectedCashierFromSidebar?.id || cashierId),
        notes: null,
        partial_payment_customer: partialPaymentCustomer,
        store_id: storeId,
        discount_type: discountAmount > 0 ? 'amount' : 'none',
        discount_value: discountAmount,
        invoice_total: typeof invoiceTotal === 'number' ? invoiceTotal : null,
        // Add customer details if provided
        customer_name: normalizedCustomerName || null,
        customer_phone: normalizedCustomerPhone || null,
        customer_cnic: customerDetails.cnic.trim() || null,
      }

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saleData),
      })

      const result = await response.json()

      if (result.success) {
        setLastSale(result.data)
        setShowReceipt(true)
        setCart([])
        setAmountPaid('')
        setSaleDescription('')
        setShowPartialPaymentConfirm(false)
        setShowPartialPaymentModal(false)
        setPartialPaymentData({ customerName: '', customerPhone: '', invoicePrice: '' })
        setPartialPaymentError('')
        clearCustomer() // Clear customer details
        fetchProducts() // Refresh product stock
        fetchAllCustomers() // Refresh customer list
      } else {
        console.error('[POS] ❌ Sale failed:', result.error)
        console.error('[POS] Error code:', result.code)
        setError(result.error)
      }
    } catch (err) {
      console.error('[POS] ❌ Exception during sale:', err)
      setError('Failed to process sale')
    } finally {
      setLoading(false)
    }
  }

  const handlePartialPaymentSubmit = () => {
    const { customerName, customerPhone, invoicePrice } = partialPaymentData
    
    // Clear previous errors
    setPartialPaymentError('')
    
    // Validate all fields are filled
    if (!customerName.trim() || !customerPhone.trim() || !invoicePrice.trim()) {
      setPartialPaymentError('All fields are required. Please fill in customer name, phone number, and invoice price.')
      return
    }

    // Validate phone format (basic validation)
    if (customerPhone.length < 10) {
      setPartialPaymentError('Please enter a valid phone number (minimum 10 digits)')
      return
    }

    // Validate invoice price
    const invoicePriceNum = parseFloat(invoicePrice)
    if (isNaN(invoicePriceNum) || invoicePriceNum <= 0) {
      setPartialPaymentError('Please enter a valid invoice price')
      return
    }

    // Check against lowest negotiable
    const lowestNegotiable = calculateLowestNegotiable()
    if (invoicePriceNum < lowestNegotiable) {
      setPartialPaymentError(`Invoice price (Rs. ${invoicePriceNum.toFixed(2)}) cannot be below the minimum acceptable price (Rs. ${lowestNegotiable.toFixed(2)})`)
      return
    }

    const paidAmount = parseFloat(amountPaid) || 0
    if (invoicePriceNum < paidAmount) {
      setPartialPaymentError(`Invoice price (Rs. ${invoicePriceNum.toFixed(2)}) cannot be less than amount paid (Rs. ${paidAmount.toFixed(2)})`)
      return
    }

    processSaleTransaction({
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
    }, 0, invoicePriceNum)
  }

  const handlePrintReceipt = () => {
    window.print()
  }

  const handleNewSale = () => {
    setShowReceipt(false)
    setLastSale(null)
  }

  if (showReceipt && lastSale) {
    // Thermal Receipt - Compact format for 58mm/80mm thermal printers
    const ThermalReceipt = () => (
      <div className="thermal-receipt max-w-[300px] mx-auto font-mono text-xs" id="receipt">
        <div className="p-2 bg-white text-black">
          {/* Header with Logo */}
          <div className="text-center border-b border-dashed border-black pb-2 mb-2">
            {receiptSettings?.show_logo !== false && receiptSettings?.logo_url && (
              <div className="mb-1.5">
                <img
                  src={receiptSettings.logo_url}
                  alt="Store Logo"
                  className="mx-auto max-w-[100px] max-h-[50px] object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}
            <p className="font-bold text-base tracking-wide">{receiptSettings?.business_name || 'ATOM'}</p>
            {receiptSettings?.business_address && (
              <p className="text-xs mt-1">{receiptSettings.business_address}</p>
            )}
            {receiptSettings?.business_phone && (
              <p className="text-xs">Tel: {receiptSettings.business_phone}</p>
            )}
            {receiptSettings?.business_email && (
              <p className="text-[9px]">{receiptSettings.business_email}</p>
            )}
            {receiptSettings?.show_tax_id && receiptSettings?.tax_id && (
              <p className="text-[9px] mt-0.5">Tax ID: {receiptSettings.tax_id}</p>
            )}
          </div>

          {/* Receipt Title */}
          <div className="text-center font-bold text-xs tracking-[3px] mb-2">SALES RECEIPT</div>

          {/* Sale Info */}
          <div className="border-b border-dashed border-black pb-2 mb-2">
            <table className="w-full text-xs">
              <tbody>
                <tr>
                  <td className="py-0.5">Sale#:</td>
                  <td className="text-right font-bold py-0.5">{lastSale.sale_number}</td>
                </tr>
                <tr>
                  <td className="py-0.5">Date:</td>
                  <td className="text-right py-0.5">{new Date(lastSale.sale_date).toLocaleString('en-PK', { 
                    timeZone: 'Asia/Karachi',
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true 
                  })}</td>
                </tr>
                <tr>
                  <td className="py-0.5">Cashier:</td>
                  <td className="text-right py-0.5">{lastSale.cashier_name || '-'}</td>
                </tr>
                <tr>
                  <td className="py-0.5">Payment:</td>
                  <td className="text-right py-0.5">{lastSale.payment_method}</td>
                </tr>
                {lastSale.payment_status === 'Partial' && (
                  <tr className="font-bold">
                    <td className="py-0.5">Status:</td>
                    <td className="text-right py-0.5">PARTIAL ⚠</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Customer Info */}
          {(lastSale.customer_name || lastSale.customer_phone) && (
            <div className="border-b border-dashed border-black pb-2 mb-2">
              <p className="font-bold">Customer:</p>
              {lastSale.customer_name && <p>{lastSale.customer_name}</p>}
              {lastSale.customer_phone && <p>Ph: {lastSale.customer_phone}</p>}
            </div>
          )}

          {/* Partial Payment Customer */}
          {lastSale.partial_payment_customers?.[0] && (
            <div className="border-b border-dashed border-black pb-2 mb-2">
              <p className="font-bold">⚠ CREDIT SALE:</p>
              <p>{lastSale.partial_payment_customers[0].customer_name}</p>
              <p>Ph: {lastSale.partial_payment_customers[0].customer_phone}</p>
              <p className="font-bold">
                Due: {currency} {lastSale.partial_payment_customers[0].amount_remaining.toFixed(0)}
              </p>
            </div>
          )}

          {/* Items */}
          <div className="border-b border-dashed border-black pb-2 mb-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black">
                  <th className="text-left py-1">Item</th>
                  <th className="text-right py-1">Amt</th>
                </tr>
              </thead>
              <tbody>
                {lastSale.sale_items?.map((item: any, idx: number) => (
                  <tr key={item.id || idx}>
                    <td className="py-1">
                      <div className="truncate max-w-[200px]">
                        {item.product_name || item.products?.name || 'Item'}
                      </div>
                      <div className="text-[10px] text-gray-600">
                        {item.quantity} × {currency} {item.unit_price.toFixed(0)}
                      </div>
                    </td>
                    <td className="text-right py-1 font-bold align-top">
                      {item.subtotal.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <table className="w-full text-xs">
            <tbody>
              {lastSale.discount_value > 0 && lastSale.discount_type !== 'none' && (
                <>
                  <tr>
                    <td className="py-0.5">Subtotal:</td>
                    <td className="text-right py-0.5">
                      {currency} {(
                        lastSale.discount_type === 'percentage'
                          ? lastSale.total_amount / (1 - lastSale.discount_value / 100)
                          : lastSale.total_amount + lastSale.discount_value
                      ).toFixed(0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5">Discount:</td>
                    <td className="text-right py-0.5">
                      -{(
                        lastSale.discount_type === 'percentage'
                          ? (lastSale.total_amount / (1 - lastSale.discount_value / 100)) * (lastSale.discount_value / 100)
                          : lastSale.discount_value
                      ).toFixed(0)}
                    </td>
                  </tr>
                </>
              )}
              <tr className="font-bold text-sm border-t border-black">
                <td className="py-1">TOTAL:</td>
                <td className="text-right py-1">{currency} {lastSale.total_amount.toFixed(0)}</td>
              </tr>
              <tr>
                <td className="py-0.5">Paid:</td>
                <td className="text-right py-0.5">{currency} {lastSale.amount_paid.toFixed(0)}</td>
              </tr>
              {lastSale.payment_status === 'Partial' ? (
                <tr className="font-bold">
                  <td className="py-0.5">DUE:</td>
                  <td className="text-right py-0.5">{currency} {lastSale.amount_due.toFixed(0)}</td>
                </tr>
              ) : (
                <tr>
                  <td className="py-0.5">Change:</td>
                  <td className="text-right py-0.5">{currency} {(lastSale.amount_paid - lastSale.total_amount).toFixed(0)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Partial Warning */}
          {lastSale.payment_status === 'Partial' && (
            <div className="mt-2 p-1 bg-black text-white text-center font-bold text-xs">
              ⚠ AMOUNT DUE ⚠
            </div>
          )}

          {/* Footer */}
          <div className="text-center mt-3 pt-2 border-t border-dashed border-black">
            <p className="font-bold">{receiptSettings?.thank_you_message || 'Thank you!'}</p>
            {receiptSettings?.return_policy && (
              <p className="text-[9px] mt-1 text-gray-600">{receiptSettings.return_policy}</p>
            )}
            <p className="text-[10px] mt-1">
              {new Date().toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
            </p>
          </div>
        </div>
      </div>
    )

    // PDF Receipt - Professional A4 layout preview
    const PDFReceipt = () => (
      <div className="max-w-2xl mx-auto" id="receipt">
        <div className="p-6 bg-white text-black">
          {/* Two-column header: Logo+Name left, Contact right */}
          <div className="flex justify-between items-start mb-3 pb-3 border-b-2 border-gray-300">
            <div className="flex items-center gap-3">
              {receiptSettings?.show_logo !== false && receiptSettings?.logo_url && (
                <img
                  src={receiptSettings.logo_url}
                  alt="Store Logo"
                  className="max-w-[60px] max-h-[40px] object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <h1 className="text-xl font-bold">{receiptSettings?.business_name || 'Atom'}</h1>
            </div>
            <div className="text-right text-xs text-gray-600">
              {receiptSettings?.business_address && (
                <p>{receiptSettings.business_address}</p>
              )}
              {receiptSettings?.business_phone && (
                <p>Tel: {receiptSettings.business_phone}</p>
              )}
              {receiptSettings?.business_email && (
                <p>{receiptSettings.business_email}</p>
              )}
              {receiptSettings?.show_tax_id && receiptSettings?.tax_id && (
                <p>Tax ID: {receiptSettings.tax_id}</p>
              )}
            </div>
          </div>

          {/* Dark title bar */}
          <div className="bg-black text-white text-center py-2 mb-4">
            <h2 className="text-sm font-bold tracking-widest">SALES RECEIPT</h2>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-3 gap-3 text-sm mb-4">
            <div>
              <p className="text-xs text-gray-500">Receipt #</p>
              <p className="font-mono font-bold">{lastSale.sale_number}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Date</p>
              <p className="font-medium">{new Date(lastSale.sale_date).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cashier</p>
              <p className="font-medium">{lastSale.cashier_name || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Payment Method</p>
              <p className="font-medium">{lastSale.payment_method}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Payment Status</p>
              <p className={`font-bold ${lastSale.payment_status === 'Partial' ? 'text-red-600' : ''}`}>
                {lastSale.payment_status}
              </p>
            </div>
          </div>

          {/* Customer Info */}
          {(lastSale.customer_name || lastSale.customer_phone || lastSale.customer_cnic) && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
              <p className="font-bold mb-2 text-xs text-gray-500 uppercase">Customer</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {lastSale.customer_name && (
                  <div>
                    <p className="text-gray-500 text-xs">Name</p>
                    <p>{lastSale.customer_name}</p>
                  </div>
                )}
                {lastSale.customer_phone && (
                  <div>
                    <p className="text-gray-500 text-xs">Phone</p>
                    <p>{lastSale.customer_phone}</p>
                  </div>
                )}
                {lastSale.customer_cnic && (
                  <div>
                    <p className="text-gray-500 text-xs">CNIC</p>
                    <p>{lastSale.customer_cnic}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Partial Payment Customer */}
          {lastSale.partial_payment_customers?.[0] && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 rounded">
              <p className="font-bold mb-2 text-sm text-red-700">PARTIAL PAYMENT - CREDIT SALE</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-red-600 text-xs">Name</p>
                  <p>{lastSale.partial_payment_customers[0].customer_name}</p>
                </div>
                <div>
                  <p className="text-red-600 text-xs">Phone</p>
                  <p>{lastSale.partial_payment_customers[0].customer_phone}</p>
                </div>
                <div>
                  <p className="text-red-600 text-xs">Amount Due</p>
                  <p className="font-bold text-red-700">{currency} {lastSale.partial_payment_customers[0].amount_remaining.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Items Table - 5 columns */}
          <table className="w-full text-sm mb-4 border-collapse">
            <thead>
              <tr className="bg-black text-white">
                <th className="text-center py-2 px-2 w-10">#</th>
                <th className="text-left py-2 px-2">Item Description</th>
                <th className="text-center py-2 px-2 w-14">Qty</th>
                <th className="text-right py-2 px-2 w-24">Unit Price</th>
                <th className="text-right py-2 px-2 w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lastSale.sale_items?.map((item: any, idx: number) => (
                <tr key={item.id} className={`border-b border-gray-200 ${idx % 2 === 1 ? 'bg-gray-50' : ''}`}>
                  <td className="text-center py-2 px-2 text-gray-500">{idx + 1}</td>
                  <td className="py-2 px-2">{item.product_name || item.products?.name || 'Unknown'}</td>
                  <td className="text-center py-2 px-2">{item.quantity}</td>
                  <td className="text-right py-2 px-2">{currency} {item.unit_price.toFixed(2)}</td>
                  <td className="text-right py-2 px-2 font-medium">{currency} {item.subtotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals - right-aligned box */}
          <div className="flex justify-end">
            <div className="w-64 bg-gray-50 border border-gray-200 rounded p-3">
              {lastSale.discount_value > 0 && lastSale.discount_type !== 'none' && (
                <>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Subtotal:</span>
                    <span>
                      {currency} {(
                        lastSale.discount_type === 'percentage'
                          ? lastSale.total_amount / (1 - lastSale.discount_value / 100)
                          : lastSale.total_amount + lastSale.discount_value
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-red-600 mb-1">
                    <span>
                      Discount ({lastSale.discount_type === 'percentage' ? `${lastSale.discount_value}%` : 'Amt'}):
                    </span>
                    <span>
                      -{currency} {(
                        lastSale.discount_type === 'percentage'
                          ? (lastSale.total_amount / (1 - lastSale.discount_value / 100)) * (lastSale.discount_value / 100)
                          : lastSale.discount_value
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t border-gray-300 my-1"></div>
                </>
              )}
              <div className="flex justify-between text-base font-bold mb-1">
                <span>TOTAL:</span>
                <span>{currency} {lastSale.total_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>Amount Paid:</span>
                <span>{currency} {lastSale.amount_paid.toFixed(2)}</span>
              </div>
              {lastSale.payment_status === 'Partial' ? (
                <div className="flex justify-between text-sm font-bold text-red-600">
                  <span>Amount Due:</span>
                  <span>{currency} {lastSale.amount_due.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span>Change:</span>
                  <span>{currency} {(lastSale.amount_paid - lastSale.total_amount).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Partial Warning */}
          {lastSale.payment_status === 'Partial' && (
            <div className="mt-4 p-2 bg-red-600 text-white text-center font-bold text-sm rounded">
              OUTSTANDING BALANCE DUE
            </div>
          )}

          {/* Footer */}
          <div className="text-center mt-4 pt-4 border-t border-gray-300">
            <p className="font-medium">{receiptSettings?.thank_you_message || 'Thank you for your business!'}</p>
            {receiptSettings?.return_policy && (
              <p className="text-xs mt-2 text-gray-500">{receiptSettings.return_policy}</p>
            )}
          </div>
        </div>
      </div>
    )

    return (
      <div className="dark:bg-[#0f0f0f]">
        {/* Render receipt based on store default_format setting */}
        {receiptSettings?.default_format === 'thermal' ? <ThermalReceipt /> : <PDFReceipt />}

        {/* Action Buttons */}
        <div className={`flex gap-3 mt-5 print:hidden ${receiptSettings?.default_format === 'thermal' ? 'max-w-[280px] mx-auto' : 'max-w-2xl mx-auto px-4'}`}>
          <PrintReceiptButton
            sale={lastSale}
            className="flex-1"
          />
          <button
            onClick={handleNewSale}
            className="flex-1 px-4 py-2.5 rounded text-sm transition-colors bg-white dark:bg-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            New Sale
          </button>
        </div>
      </div>
    )
  }

  const total = calculateTotal()
  const change = calculateChange()

  return (
    <div className="animate-fadeIn">
      <div className={`flex flex-col gap-4 dark:text-white`}>
        <h1 className={`text-xl md:text-2xl font-bold mb-5 text-gray-900 dark:text-white`}>New Sale</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Search and Cart */}
        <div className="lg:col-span-2 space-y-5">
          {/* Search */}
          <div className={`p-5 rounded-lg bg-white dark:bg-[#0f0f0f] shadow-sm dark:dark-shadow`}>
            <div className="relative">
              <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500`} size={16} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by name, SKU, barcode, or IMEI number..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    if (filteredProducts.length > 0) {
                      setHighlightedIndex(prev => 
                        prev < filteredProducts.length - 1 ? prev + 1 : prev
                      )
                    }
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    if (filteredProducts.length > 0) {
                      setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0)
                    }
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    if (highlightedIndex >= 0 && filteredProducts[highlightedIndex]) {
                      // Select highlighted product
                      addToCart(filteredProducts[highlightedIndex])
                      setHighlightedIndex(-1)
                    } else if (searchTerm.trim().length > 0) {
                      // User pressed Enter - process as barcode/IMEI
                      handleBarcodeScanned(searchTerm.trim())
                    }
                  } else if (e.key === 'Escape') {
                    setFilteredProducts([])
                    setHighlightedIndex(-1)
                  }
                }}
                autoFocus
                autoComplete="off"
                className="w-full pl-9 pr-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-600 border-gray-300 dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
              />
            </div>
            
            <p className={`text-xs mt-2 text-gray-500 dark:text-gray-400`}>
              💡 Scan barcode or type to search. Use ↑↓ arrows to navigate, Enter to select.
            </p>

            {filteredProducts.length > 0 && (
              <div className={`mt-3 border rounded-lg max-h-64 overflow-y-auto border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a]`}>
                {filteredProducts.map((product, index) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      addToCart(product)
                      setHighlightedIndex(-1)
                    }}
                    className={`w-full p-3 text-left transition-colors border-b last:border-b-0 ${
                      index === highlightedIndex
                        ? 'bg-cyan-50 dark:bg-cyan-900/50 border-gray-200 dark:border-gray-700'
                        : 'hover:bg-gray-50 dark:hover:bg-[#2a2a2a] border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className={`font-medium text-gray-900 dark:text-white`}>{product.name}</p>
                        <p className={`text-xs text-gray-600 dark:text-gray-400`}>
                          {product.sku} • Stock: {product.stock_quantity}
                        </p>
                      </div>
                      <p className={`font-semibold dark:text-gray-200`}>Rs. {(product.aggregated_stock?.aggregated_selling_price || 0).toFixed(2)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Customer Details Section - Collapsible */}
          <div className={`rounded-lg bg-white dark:bg-[#0f0f0f] shadow-sm dark:dark-shadow`}>
            <button
              onClick={() => setIsCustomerSectionExpanded(!isCustomerSectionExpanded)}
              className="w-full flex items-center justify-between p-4"
            >
              <div className="text-left">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Customer Details {paymentMethod === 'Digital' ? '(Required for Digital Payment)' : '(Optional)'}
                  {(customerDetails.name || customerDetails.phone) && (
                    <span className="ml-2 text-cyan-600 text-sm font-normal">
                      • {customerDetails.name || customerDetails.phone}
                    </span>
                  )}
                </h2>
                <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                  {isCustomerSectionExpanded ? 'Click to collapse' : 'Click to add customer details'}
                </p>
              </div>
              <svg
                className={`w-5 h-5 transition-transform ${isCustomerSectionExpanded ? 'rotate-180' : ''} text-gray-600 dark:text-gray-400`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isCustomerSectionExpanded && (
              <div className="p-5 space-y-4 border-t border-gray-200 dark:border-gray-700">
                {/* Customer Search/Name */}
                <div className="relative" ref={customerSearchRef}>
                  <label className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    Customer Name {paymentMethod === 'Digital' && <span className="text-red-600">*</span>}
                  </label>
                  <input
                    id="customer-name-input"
                    type="text"
                    value={customerDetails.name}
                    onChange={(e) => handleCustomerSearch(e.target.value)}
                    onFocus={() => {
                      if (customerSearchResults.length > 0) {
                        setShowCustomerResults(true)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const phoneInput = document.getElementById('customer-phone-input')
                        phoneInput?.focus()
                      }
                    }}
                    className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:border-cyan-600 border-gray-300 dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
                    placeholder="Search or enter new customer name"
                  />
                  
                  {/* Customer Search Results Dropdown */}
                  {showCustomerResults && customerSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 border rounded-lg shadow-lg max-h-48 overflow-y-auto bg-white border-gray-300 dark:bg-[#1a1a1a] dark:border-gray-600">
                      {customerSearchResults.map((customer, index) => (
                        <button
                          key={index}
                          onClick={() => selectCustomer(customer)}
                          className="w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-cyan-50 border-gray-200 dark:hover:bg-[#2a2a2a] dark:border-gray-700"
                        >
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{customer.name}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{customer.phone}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Customer Phone */}
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    Phone Number
                  </label>
                  <input
                    id="customer-phone-input"
                    type="text"
                    inputMode="numeric"
                    pattern="03\d{9}"
                    title="Use 11 digits starting with 03"
                    maxLength={11}
                    value={customerDetails.phone}
                    onChange={(e) => {
                      const nextPhone = normalizePhoneInput(e.target.value)
                      const nextDetails = { ...customerDetails, phone: nextPhone }
                      setCustomerDetails(nextDetails)
                      setCustomerValidationErrors((prev) => ({
                        ...prev,
                        phone: validateCustomerPhone(nextDetails.phone),
                      }))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const cnicInput = document.getElementById('customer-cnic-input')
                        cnicInput?.focus()
                      }
                    }}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:border-cyan-600 dark:bg-[#1a1a1a] dark:text-white dark:placeholder-gray-500 ${
                      customerValidationErrors.phone
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="e.g., 03001234567"
                  />
                  {customerValidationErrors.phone && (
                    <p className="mt-1 text-xs text-red-600">{customerValidationErrors.phone}</p>
                  )}
                </div>

                {/* Customer CNIC */}
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    CNIC (Optional)
                  </label>
                  <input
                    id="customer-cnic-input"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{5}-\d{7}-\d"
                    title="Use XXXXX-XXXXXXX-X format"
                    maxLength={15}
                    value={customerDetails.cnic}
                    onChange={(e) => {
                      const nextCNIC = formatCNICInput(e.target.value)
                      const nextDetails = { ...customerDetails, cnic: nextCNIC }
                      setCustomerDetails(nextDetails)
                      setCustomerValidationErrors((prev) => ({
                        ...prev,
                        cnic: validateCustomerCNIC(nextDetails.cnic),
                      }))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        // Collapse the section when done
                        setIsCustomerSectionExpanded(false)
                      }
                    }}
                    className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:border-cyan-600 dark:bg-[#1a1a1a] dark:text-white dark:placeholder-gray-500 ${
                      customerValidationErrors.cnic
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="e.g., 12345-1234567-1"
                  />
                  {customerValidationErrors.cnic && (
                    <p className="mt-1 text-xs text-red-600">{customerValidationErrors.cnic}</p>
                  )}
                </div>

                {/* Clear Customer Button */}
                {(customerDetails.name || customerDetails.phone || customerDetails.cnic) && (
                  <button
                    onClick={clearCustomer}
                    className="w-full px-3 py-2 text-xs border rounded-lg transition-colors text-gray-600 hover:bg-gray-100 border-gray-300 dark:text-gray-300 dark:hover:bg-[#2a2a2a] dark:border-gray-600"
                  >
                    Clear Customer Details
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="rounded-lg bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
            <div className="p-5 flex justify-between items-center bg-cyan-50/50 dark:bg-transparent">
              <div className="flex items-center gap-2">
                <ShoppingCartIcon size={18} className="text-cyan-600" />
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Cart</h2>
                <span className="bg-cyan-600 text-white px-2 py-0.5 rounded text-xs font-medium">
                  {cart.length}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors font-medium text-gray-600 hover:bg-cyan-100 dark:text-gray-300 dark:hover:bg-[#2a2a2a]"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="p-5">
              {cart.length === 0 ? (
                <p className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
                  Cart is empty. Search and add products.
                </p>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/20"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{item.product.name}</p>
                          <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                            Rs. {(item.product.aggregated_stock?.aggregated_selling_price || 0).toFixed(2)} each
                          </p>
                          {item.product.is_phone && (
                            <div className="mt-2">
                              {item.imei_numbers && item.imei_numbers.length > 0 ? (
                                <div className="text-xs">
                                  <span className="text-green-600 font-medium">✓ IMEI selected ({item.imei_numbers.length})</span>
                                  <button
                                    onClick={() => {
                                      setCurrentIMEIProduct(item)
                                      setShowIMEIModal(true)
                                    }}
                                    className="ml-2 text-cyan-600 hover:underline"
                                  >
                                    Change
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setCurrentIMEIProduct(item)
                                    setShowIMEIModal(true)
                                  }}
                                  className="text-xs text-red-600 font-medium hover:underline"
                                >
                                  ⚠ Select IMEI numbers
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 border rounded-lg border-gray-300 dark:border-gray-600">
                            <button
                              onClick={() =>
                                updateQuantity(item.product.id, item.quantity - 1)
                              }
                              title={`Decrease quantity for ${item.product.name}`}
                              aria-label={`Decrease quantity for ${item.product.name}`}
                              className="p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-[#2a2a2a] dark:text-gray-300"
                            >
                              <MinusIcon size={14} />
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={item.product.stock_quantity}
                              value={quantityInputs[item.product.id] ?? String(item.quantity)}
                              onChange={(e) => handleQuantityInputChange(item.product.id, e.target.value)}
                              onBlur={() => commitQuantityInput(item)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  e.currentTarget.blur()
                                }

                                if (e.key === 'Escape') {
                                  e.preventDefault()
                                  setQuantityInputs((prev) => ({
                                    ...prev,
                                    [item.product.id]: String(item.quantity),
                                  }))
                                  e.currentTarget.blur()
                                }
                              }}
                              className="w-12 bg-transparent text-center font-medium outline-none [appearance:textfield] dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              aria-label={`Quantity for ${item.product.name}`}
                            />
                            <button
                              onClick={() =>
                                updateQuantity(item.product.id, item.quantity + 1)
                              }
                              title={`Increase quantity for ${item.product.name}`}
                              aria-label={`Increase quantity for ${item.product.name}`}
                              className="p-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-[#2a2a2a] dark:text-gray-300"
                            >
                              <PlusIcon size={14} />
                            </button>
                          </div>

                          <p className="font-semibold w-20 text-right dark:text-gray-200">
                            {formatCurrency((item.product.aggregated_stock?.aggregated_selling_price || 0) * item.quantity, 2)}
                          </p>

                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            title={`Remove ${item.product.name} from cart`}
                            aria-label={`Remove ${item.product.name} from cart`}
                            className="p-1.5 rounded-lg transition-colors hover:bg-red-50 text-red-600 dark:hover:bg-red-900/30 dark:text-red-400"
                          >
                            <TrashIcon size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Section */}
        <div className="lg:col-span-1">
          <div className="p-6 rounded-lg sticky top-4 bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
            <h2 className="text-base font-bold mb-5 text-gray-900 dark:text-white">Payment</h2>

            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="mb-5">
              <p className="text-xs mb-2 font-medium text-gray-600 dark:text-gray-400">Total Amount</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(total, 2)}</p>
            </div>

            <div className="mb-4">
              <label className="block mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod('Cash')}
                  className={`px-4 py-2.5 rounded-lg border transition-colors font-medium ${
                    paymentMethod === 'Cash'
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 dark:bg-[#1a1a1a] dark:border-gray-600 dark:hover:bg-[#2a2a2a] dark:text-gray-300'
                  }`}
                >
                  Cash
                </button>
                <button
                  onClick={() => {
                    setPaymentMethod('Digital')
                    setIsCustomerSectionExpanded(true)
                    requestAnimationFrame(() => {
                      const customerNameInput = document.getElementById('customer-name-input') as HTMLInputElement | null
                      customerNameInput?.focus()
                    })
                  }}
                  className={`px-4 py-2.5 rounded-lg border transition-colors font-medium ${
                    paymentMethod === 'Digital'
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700 dark:bg-[#1a1a1a] dark:border-gray-600 dark:hover:bg-[#2a2a2a] dark:text-gray-300'
                  }`}
                >
                  Digital
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="amountPaid" className="block mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                Amount Paid
              </label>
              <input
                id="amountPaid"
                type="number"
                step="0.01"
                min="0"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:border-cyan-600 border-gray-300 dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
                placeholder="0.00"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="saleDescription" className="block mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                Sale Description {cart.length > 1 && <span className="text-red-600">*</span>}
              </label>
              <input
                id="saleDescription"
                type="text"
                value={saleDescription}
                onChange={(e) => setSaleDescription(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:border-cyan-600 border-gray-300 dark:bg-[#1a1a1a] dark:border-gray-600 dark:text-white dark:placeholder-gray-500"
                placeholder={cart.length === 1 ? "Optional (will use product name)" : "Required for multiple items"}
              />
              {cart.length === 1 && !saleDescription && (
                <p className="text-xs mt-1.5 text-gray-500 dark:text-gray-400">
                  Will default to: {cart[0].product.name}
                </p>
              )}
            </div>

            {amountPaid && parseFloat(amountPaid) >= total && (
              <div className="mb-4 p-4 border rounded-lg bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <p className="text-xs mb-1 font-medium text-gray-600 dark:text-gray-300">Change</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(change, 2)}</p>
              </div>
            )}

            {/* Dynamic buttons based on payment amount */}
            {(() => {
              const paid = parseFloat(amountPaid) || 0
              const lowestNegotiable = calculateLowestNegotiable()

              // If no amount entered or cart is empty, show default button
              if (!amountPaid || cart.length === 0) {
                return (
                  <button
                    onClick={handleProcessSale}
                    disabled={cart.length === 0 || loading}
                    className="w-full bg-cyan-600 text-white px-3 py-3 rounded text-sm font-medium hover:bg-cyan-700 disabled:bg-gray-400 transition-colors"
                  >
                    {loading ? 'Processing...' : 'Confirm Payment'}
                  </button>
                )
              }

              // If entered amount >= total: Show confirm button
              if (paid >= total) {
                return (
                  <button
                    onClick={handleProcessSale}
                    disabled={loading}
                    className="w-full bg-cyan-600 text-white px-3 py-3 rounded text-sm font-medium hover:bg-cyan-700 disabled:bg-gray-400 transition-colors"
                  >
                    {loading ? 'Processing...' : 'Confirm Payment'}
                  </button>
                )
              }

              // If entered amount < total but >= lowest negotiable: Show both buttons
              if (paid >= lowestNegotiable && paid < total) {
                return (
                  <div className="space-y-2">
                    <button
                      onClick={handleApplyDiscount}
                      disabled={loading}
                      className="w-full bg-green-600 text-white px-3 py-3 rounded text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>✓</span> Apply as Discount (Default)
                    </button>
                    <button
                      onClick={handleGoToPartialPayment}
                      disabled={loading}
                      className="w-full bg-cyan-600 text-white px-3 py-3 rounded text-sm font-medium hover:bg-cyan-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>📋</span> Khaata (Customer Credit)
                    </button>
                  </div>
                )
              }

              // If entered amount < lowest negotiable: Only show Khaata button
              if (paid < lowestNegotiable) {
                return (
                  <div>
                    <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                      <p className="text-orange-800 font-medium">
                        ⚠️ Amount is below minimum price ({formatCurrency(lowestNegotiable, 2)})
                      </p>
                      <p className="text-orange-700 text-xs mt-1">
                        Only Khaata (customer credit) option is available
                      </p>
                    </div>
                    <button
                      onClick={handleProcessSale}
                      disabled={loading}
                      className="w-full bg-cyan-600 text-white px-3 py-3 rounded text-sm font-medium hover:bg-cyan-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>📋</span> Khaata (Customer Credit)
                    </button>
                  </div>
                )
              }

              return null
            })()}
          </div>
        </div>
      </div>

      {/* Discount or Partial Payment Choice Modal */}
      {showPartialPaymentConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-300 max-w-sm w-full p-4 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Insufficient Payment</h2>
              <p className="text-gray-600 text-xs">The entered amount is less than the total. How would you like to proceed?</p>
            </div>
            
            <div className="mb-5 p-4 border border-gray-200 rounded bg-gray-50">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(calculateTotal(), 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Lowest Negotiable:</span>
                  <span className="font-medium text-orange-600">{formatCurrency(calculateLowestNegotiable(), 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(parseFloat(amountPaid) || 0, 2)}</span>
                </div>
                <div className="border-t border-gray-300 pt-2 mt-2"></div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900">Remaining Amount:</span>
                  <span className="font-bold text-lg text-orange-600">
                    {formatCurrency(calculateTotal() - (parseFloat(amountPaid) || 0), 2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-5 space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm font-medium text-green-900 mb-1">✓ Apply as Discount (Default)</p>
                <p className="text-xs text-green-700">The remaining amount will be applied as a discount and the sale will be completed immediately.</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm font-medium text-blue-900 mb-1">📋 Khaata (Customer Credit)</p>
                <p className="text-xs text-blue-700">Record customer information and track the remaining amount for future payment.</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePartialPaymentCancel}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyDiscount}
                disabled={loading}
                className="flex-1 px-3 py-2.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors font-medium disabled:bg-gray-400 text-sm"
              >
                Apply Discount
              </button>
              <button
                onClick={handleGoToPartialPayment}
                className="flex-1 px-3 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                Khaata
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partial Payment Customer Information Modal */}
      {showPartialPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-300 max-w-sm w-full p-4 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Khaata - Customer Information</h2>
              <p className="text-red-600 text-xs">Please enter customer details and invoice price for credit tracking.</p>
            </div>

            {/* Validation Error */}
            {partialPaymentError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-700 font-medium">{partialPaymentError}</p>
              </div>
            )}
            
            <div className="mb-5 p-4 border border-gray-200 rounded bg-gray-50">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">List Total:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(calculateTotal(), 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(parseFloat(amountPaid) || 0, 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Invoice Price:</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(parseFloat(partialPaymentData.invoicePrice) || 0, 2)}
                  </span>
                </div>
                <div className="border-t border-gray-300 pt-2 mt-2"></div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900">Amount Due:</span>
                  <span className="font-bold text-lg text-gray-900">
                    {formatCurrency((parseFloat(partialPaymentData.invoicePrice) || calculateTotal()) - (parseFloat(amountPaid) || 0), 2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-5">
              <div className="relative" ref={customerNameInputRef}>
                <label className="block mb-2 font-medium text-sm text-gray-700">
                  Customer Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={partialPaymentData.customerName}
                  onChange={(e) => handleCustomerNameChange(e.target.value)}
                  onFocus={() => {
                    if (partialPaymentData.customerName.trim().length > 0) {
                      setShowCustomerDropdown(true)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      document.getElementById('khaata-phone-input')?.focus()
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="Enter or search customer name"
                  autoComplete="off"
                  autoFocus
                />
                
                {/* Customer Search Dropdown */}
                {showCustomerDropdown && existingCustomers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded max-h-48 overflow-y-auto shadow-lg">
                    {existingCustomers.map((customer, index) => (
                      <div
                        key={index}
                        onClick={() => handleSelectCustomer(customer)}
                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-200 last:border-b-0"
                      >
                        <div className="font-medium text-sm text-gray-900">{customer.customer_name}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {customer.customer_phone}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm text-gray-700">
                  Customer Phone <span className="text-red-600">*</span>
                </label>
                <input
                  id="khaata-phone-input"
                  type="tel"
                  value={partialPaymentData.customerPhone}
                  onChange={(e) => {
                    setPartialPaymentData({
                      ...partialPaymentData,
                      customerPhone: e.target.value
                    })
                    setPartialPaymentError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      document.getElementById('khaata-price-input')?.focus()
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="03xx-xxxxxxx"
                  maxLength={12}
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm text-gray-700">
                  Invoice Price <span className="text-red-600">*</span>
                </label>
                <input
                  id="khaata-price-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={partialPaymentData.invoicePrice}
                  onChange={(e) => {
                    setPartialPaymentData({
                      ...partialPaymentData,
                      invoicePrice: e.target.value
                    })
                    setPartialPaymentError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      // Submit the form
                      handlePartialPaymentSubmit()
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="Enter invoice price"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This amount will be used as the total amount for this sale. Minimum: {formatCurrency(calculateLowestNegotiable(), 2)} (Lowest Negotiable)
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPartialPaymentModal(false)
                  setShowPartialPaymentConfirm(false)
                  setPartialPaymentData({ customerName: '', customerPhone: '', invoicePrice: '' })
                  setPartialPaymentError('')
                  setShowCustomerDropdown(false)
                  setExistingCustomers([])
                }}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded hover:bg-gray-50 transition-colors font-medium text-sm"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handlePartialPaymentSubmit}
                disabled={loading || !partialPaymentData.customerName.trim() || !partialPaymentData.customerPhone.trim() || !partialPaymentData.invoicePrice.trim()}
                className="flex-1 px-3 py-2.5 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm"
              >
                {loading ? 'Processing...' : 'Confirm Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMEI Selection Modal */}
      {showIMEIModal && currentIMEIProduct && (
        <IMEISelectionModal
          product={currentIMEIProduct.product}
          quantity={currentIMEIProduct.quantity}
          onSelect={handleIMEISelection}
          onClose={() => {
            setShowIMEIModal(false)
            setCurrentIMEIProduct(null)
          }}
        />
      )}
      </div>
    </div>
  )
}
