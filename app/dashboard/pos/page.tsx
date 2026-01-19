'use client'

import { useEffect, useState, useRef } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, Printer } from 'lucide-react'
import type { ProductWithBackwardCompatibility } from '@/lib/types'
import { supabase, getStoreId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import IMEISelectionModal from '@/components/IMEISelectionModal'
import { useDarkMode } from '@/hooks/useDarkMode'

interface CartItem {
  product: ProductWithBackwardCompatibility
  quantity: number
  imei_numbers?: string[]  // For phone products
}

export default function POSPage() {
  const router = useRouter()
  const isDarkMode = useDarkMode()
  const [products, setProducts] = useState<ProductWithBackwardCompatibility[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredProducts, setFilteredProducts] = useState<ProductWithBackwardCompatibility[]>([])
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
    salePrice: ''
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
  const [allCustomers, setAllCustomers] = useState<any[]>([])
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([])
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const customerSearchRef = useRef<HTMLInputElement>(null)

  // Barcode scanning state
  const [barcodeBuffer, setBarcodeBuffer] = useState('')
  const [lastKeyTime, setLastKeyTime] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Barcode scanner detection - scanners type fast and send Enter
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in other inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (target !== searchInputRef.current) return
      }

      const currentTime = Date.now()
      const timeDiff = currentTime - lastKeyTime

      // Enter key - process accumulated barcode
      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        e.preventDefault()
        handleBarcodeScanned(barcodeBuffer)
        setBarcodeBuffer('')
        setLastKeyTime(0)
        return
      }

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

    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
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

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      console.log('[POS] Barcode scanned:', barcode)

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
          
          console.log('[POS] ✓ Phone added with IMEI:', barcode)
          setError(`✓ Found by IMEI: ${product.name}`)
          setTimeout(() => setError(''), 2000)
        } else {
          // Regular product - add to cart
          addToCart(product)
          console.log('[POS] ✓ Product added:', product.name)
          setError(`✓ Found by barcode: ${product.name}`)
          setTimeout(() => setError(''), 2000)
        }

        // Clear search
        setSearchTerm('')
      } else {
        console.log('[POS] ✗ Product not found for barcode/IMEI:', barcode)
        setError(`Product not found for barcode: ${barcode}`)
        setTimeout(() => setError(''), 3000)
      }
    } catch (err) {
      console.error('[POS] Barcode scan error:', err)
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

  const selectCustomer = (customer: any) => {
    setCustomerDetails({
      name: customer.name,
      phone: customer.phone,
      cnic: ''
    })
    setShowCustomerResults(false)
  }

  const clearCustomer = () => {
    setCustomerDetails({ name: '', phone: '', cnic: '' })
    setCustomerSearchResults([])
    setShowCustomerResults(false)
  }

  const loadSelectedCashier = () => {
    const savedCashier = localStorage.getItem('selected_cashier')
    if (savedCashier) {
      try {
        const cashier = JSON.parse(savedCashier)
        setSelectedCashierFromSidebar(cashier)
        console.log('[POS] Loaded selected cashier:', cashier)
      } catch (err) {
        console.error('Failed to parse saved cashier:', err)
      }
    }
  }

  // Listen for cashier selection changes from sidebar
  useEffect(() => {
    const handleCashierChange = () => {
      console.log('[POS] Cashier selection changed, reloading...')
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
      const filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredProducts(filtered.slice(0, 10))
    } else {
      setFilteredProducts([])
    }
  }, [searchTerm, products])

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
    console.log('[POS] === CONFIRM SALE BUTTON PRESSED ===')
    console.log('[POS] Cart:', JSON.stringify(cart.map(item => ({
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity
    })), null, 2))
    
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
    
    console.log('[POS] Payment details:', { total, lowestNegotiable, paid })

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
          salePrice: '' // Only ask for sale price
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
        salePrice: '' // Only ask for sale price
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
    setError(`Insufficient payment. Total: Rs. ${total.toFixed(2)}, Paid: Rs. ${paid.toFixed(2)}`)
  }

  const processSaleTransaction = async (partialPaymentCustomer: any, discountAmount: number = 0) => {
    setLoading(true)

    try {
      const total = calculateTotal()
      const paid = parseFloat(amountPaid) || 0
      let finalDescription = saleDescription.trim()
      
      if (cart.length === 1 && !finalDescription) {
        finalDescription = cart[0].product.name
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
        // Add customer details if provided
        customer_name: customerDetails.name.trim() || null,
        customer_phone: customerDetails.phone.trim() || null,
        customer_cnic: customerDetails.cnic.trim() || null,
      }
      
      console.log('[POS] Sending sale data to API:', JSON.stringify(saleData, null, 2))

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saleData),
      })

      const result = await response.json()
      
      console.log('[POS] API Response:', JSON.stringify(result, null, 2))

      if (result.success) {
        console.log('[POS] Sale successful!')
        setLastSale(result.data)
        setShowReceipt(true)
        setCart([])
        setAmountPaid('')
        setSaleDescription('')
        setShowPartialPaymentConfirm(false)
        setShowPartialPaymentModal(false)
        setPartialPaymentData({ customerName: '', customerPhone: '', salePrice: '' })
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
    const { customerName, customerPhone, salePrice } = partialPaymentData
    
    // Clear previous errors
    setPartialPaymentError('')
    
    // Validate all fields are filled
    if (!customerName.trim() || !customerPhone.trim() || !salePrice.trim()) {
      setPartialPaymentError('All fields are required. Please fill in customer name, phone number, and sale price.')
      return
    }

    // Validate phone format (basic validation)
    if (customerPhone.length < 10) {
      setPartialPaymentError('Please enter a valid phone number (minimum 10 digits)')
      return
    }

    // Validate sale price
    const salePriceNum = parseFloat(salePrice)
    if (isNaN(salePriceNum) || salePriceNum <= 0) {
      setPartialPaymentError('Please enter a valid sale price')
      return
    }

    // Check against lowest negotiable
    const lowestNegotiable = calculateLowestNegotiable()
    if (salePriceNum < lowestNegotiable) {
      setPartialPaymentError(`Sale price (Rs. ${salePriceNum.toFixed(2)}) cannot be below the minimum acceptable price (Rs. ${lowestNegotiable.toFixed(2)})`)
      return
    }

    // Update amountPaid to the sale price for processing
    setAmountPaid(salePrice)

    processSaleTransaction({
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
    }, 0)
  }

  const handlePrintReceipt = () => {
    window.print()
  }

  const handleNewSale = () => {
    setShowReceipt(false)
    setLastSale(null)
  }

  if (showReceipt && lastSale) {
    return (
      <div className={`max-w-2xl mx-auto p-4 ${isDarkMode ? 'bg-gray-900' : ''}`}>
        <div className={`p-6 rounded border ${isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'}`} id="receipt">
          <div className="text-center mb-5">
            <h1 className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>POS System</h1>
            <h2 className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Sales Receipt</h2>
          </div>

          <div className="mb-5 border-t border-b border-gray-200 py-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-600">Sale Number</p>
                <p className="font-mono font-semibold text-gray-900">{lastSale.sale_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Date</p>
                <p className="font-medium text-gray-900">
                  {new Date(lastSale.sale_date).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Cashier</p>
                <p className="font-medium text-gray-900">{lastSale.cashier_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Payment Method</p>
                <p className="font-medium text-gray-900">{lastSale.payment_method}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Payment Status</p>
                <p className={`font-medium ${lastSale.payment_status === 'Partial' ? 'text-red-600' : 'text-gray-900'}`}>
                  {lastSale.payment_status}
                  {lastSale.payment_status === 'Partial' && ' ⚠️'}
                </p>
              </div>
            </div>

            {/* Show customer info for partial payments */}
            {lastSale.partial_payment_customers && lastSale.partial_payment_customers.length > 0 && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="font-semibold text-red-900 mb-2 flex items-center gap-2 text-sm">
                  <span>⚠️</span> PARTIAL PAYMENT CUSTOMER
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-red-700">Name</p>
                    <p className="font-medium text-red-900">{lastSale.partial_payment_customers[0].customer_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-red-700">Phone</p>
                    <p className="font-medium text-red-900">{lastSale.partial_payment_customers[0].customer_phone}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-red-700">Amount Remaining</p>
                    <p className="font-bold text-red-900 text-base">
                      ${lastSale.partial_payment_customers[0].amount_remaining.toFixed(2)}
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
              {lastSale.sale_items?.map((item: any) => (
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
            {lastSale.discount_value > 0 && lastSale.discount_type !== 'none' && (
              <>
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="text-gray-900">
                    ${(
                      lastSale.discount_type === 'percentage'
                        ? lastSale.total_amount / (1 - lastSale.discount_value / 100)
                        : lastSale.total_amount + lastSale.discount_value
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between mb-2 text-green-600 text-sm">
                  <span>
                    Discount ({lastSale.discount_type === 'percentage' ? `${lastSale.discount_value}%` : 'Amount'}):
                  </span>
                  <span>
                    -${(
                      lastSale.discount_type === 'percentage'
                        ? (lastSale.total_amount / (1 - lastSale.discount_value / 100)) * (lastSale.discount_value / 100)
                        : lastSale.discount_value
                    ).toFixed(2)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between text-lg font-bold mb-2 text-gray-900">
              <span>Total:</span>
              <span>Rs. {lastSale.total_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-2 text-sm">
              <span className="text-gray-600">Amount Paid:</span>
              <span className="text-gray-900">Rs. {lastSale.amount_paid.toFixed(2)}</span>
            </div>
            {lastSale.payment_status === 'Partial' ? (
              <div className="flex justify-between text-base font-medium text-red-600">
                <span>Amount Due:</span>
                <span>${lastSale.amount_due.toFixed(2)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-base font-medium text-gray-900">
                <span>Change:</span>
                <span>${(lastSale.amount_paid - lastSale.total_amount).toFixed(2)}</span>
              </div>
            )}
            
            {/* Additional warning for partial payment */}
            {lastSale.payment_status === 'Partial' && (
              <div className="mt-4 p-3 bg-red-600 text-white rounded font-semibold text-center text-sm">
                ⚠️ OUTSTANDING BALANCE DUE ⚠️
              </div>
            )}
          </div>

          <div className="mt-5 text-center text-sm text-gray-600">
            <p>Thank you for your business!</p>
          </div>
        </div>

        <div className="flex gap-3 mt-5 print:hidden">
          <button
            onClick={handlePrintReceipt}
            className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 text-white px-4 py-2.5 rounded text-sm hover:bg-cyan-700 transition-colors"
          >
            <Printer size={18} />
            Print Receipt
          </button>
          <button
            onClick={handleNewSale}
            className="flex-1 bg-white border border-gray-300 px-4 py-2.5 rounded text-sm hover:bg-gray-50 transition-colors"
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
      <div className={`flex flex-col gap-4 ${isDarkMode ? 'text-white' : ''}`}>
        <h1 className={`text-xl md:text-2xl font-bold mb-5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>New Sale</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Product Search and Cart */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search */}
          <div className="bg-white p-3 rounded border border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by name, SKU, barcode, or IMEI number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchTerm.trim().length > 0) {
                    e.preventDefault()
                    // Try as barcode/IMEI first
                    handleBarcodeScanned(searchTerm.trim())
                  }
                }}
                autoFocus
                autoComplete="off"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
              />
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              💡 Press Enter to search by barcode or IMEI. Product search is automatic as you type.
            </p>

            {filteredProducts.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded max-h-64 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="w-full p-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-200 last:border-b-0 text-sm"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-600">
                          {product.sku} • Stock: {product.stock_quantity}
                        </p>
                      </div>
                      <p className="font-medium text-sm">Rs. {(product.aggregated_stock?.aggregated_selling_price || 0).toFixed(2)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Customer Details Section */}
          <div className="bg-white rounded border border-gray-200 mt-4">
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">Customer Details (Optional)</h2>
              <p className="text-xs text-gray-600 mt-1">Link this sale to a customer for tracking</p>
            </div>

            <div className="p-3 space-y-3">
              {/* Customer Search/Name */}
              <div className="relative" ref={customerSearchRef}>
                <label className="block mb-1 text-xs font-medium text-gray-700">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerDetails.name}
                  onChange={(e) => handleCustomerSearch(e.target.value)}
                  onFocus={() => {
                    if (customerSearchResults.length > 0) {
                      setShowCustomerResults(true)
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="Search or enter new customer name"
                />
                
                {/* Customer Search Results Dropdown */}
                {showCustomerResults && customerSearchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                    {customerSearchResults.map((customer, index) => (
                      <button
                        key={index}
                        onClick={() => selectCustomer(customer)}
                        className="w-full text-left px-3 py-2 hover:bg-cyan-50 border-b border-gray-200 last:border-b-0"
                      >
                        <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                        <div className="text-xs text-gray-600">{customer.phone}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Phone */}
              <div>
                <label className="block mb-1 text-xs font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={customerDetails.phone}
                  onChange={(e) => setCustomerDetails({ ...customerDetails, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="e.g., 03001234567"
                />
              </div>

              {/* Customer CNIC */}
              <div>
                <label className="block mb-1 text-xs font-medium text-gray-700">
                  CNIC (Optional)
                </label>
                <input
                  type="text"
                  value={customerDetails.cnic}
                  onChange={(e) => setCustomerDetails({ ...customerDetails, cnic: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="e.g., 12345-1234567-1"
                />
              </div>

              {/* Clear Customer Button */}
              {(customerDetails.name || customerDetails.phone || customerDetails.cnic) && (
                <button
                  onClick={clearCustomer}
                  className="w-full px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
                >
                  Clear Customer Details
                </button>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="bg-white rounded border border-gray-200 mt-4">
            <div className="p-3 bg-cyan-50 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-cyan-600" />
                <h2 className="text-base font-bold text-gray-900">Cart</h2>
                <span className="bg-cyan-600 text-white px-2 py-0.5 rounded text-xs">
                  {cart.length}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-gray-600 hover:bg-cyan-100 px-2 py-1 rounded transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="p-3">
              {cart.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-500">
                  Cart is empty. Search and add products.
                </p>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-2 border border-gray-200 rounded"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{item.product.name}</p>
                          <p className="text-xs text-gray-600">
                            Rs. {(item.product.aggregated_stock?.aggregated_selling_price || 0).toFixed(2)} each
                          </p>
                          {item.product.is_phone && (
                            <div className="mt-1">
                              {item.imei_numbers && item.imei_numbers.length > 0 ? (
                                <div className="text-xs">
                                  <span className="text-green-600 font-medium">✓ IMEI selected ({item.imei_numbers.length})</span>
                                  <button
                                    onClick={() => {
                                      setCurrentIMEIProduct(item)
                                      setShowIMEIModal(true)
                                    }}
                                    className="ml-2 text-blue-600 hover:underline"
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
                                  className="text-xs text-status-error font-medium hover:underline"
                                >
                                  ⚠ Select IMEI numbers
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 border border-gray-300 rounded">
                            <button
                              onClick={() =>
                                updateQuantity(item.product.id, item.quantity - 1)
                              }
                              className="p-1 hover:bg-gray-100 transition-colors"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="font-medium w-8 text-center text-sm">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(item.product.id, item.quantity + 1)
                              }
                              className="p-1 hover:bg-gray-100 transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          <p className="font-medium w-20 text-right text-sm">
                            Rs. {((item.product.aggregated_stock?.aggregated_selling_price || 0) * item.quantity).toFixed(2)}
                          </p>

                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors"
                          >
                            <Trash2 size={16} />
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
          <div className="bg-white p-4 rounded border border-gray-200 sticky top-4">
            <h2 className="text-base font-bold text-gray-900 mb-4">Payment</h2>

            {error && (
              <div className="mb-3 p-2 bg-red-50 text-red-600 rounded text-xs border border-red-200">
                {error}
              </div>
            )}

            <div className="mb-4">
              <p className="text-xs text-gray-600 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">Rs. {total.toFixed(2)}</p>
              <p className="text-xs text-orange-600 mt-1">
                Min. Acceptable: Rs. {calculateLowestNegotiable().toFixed(2)}
              </p>
            </div>

            <div className="mb-3">
              <label className="block mb-2 text-xs font-medium text-gray-700">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod('Cash')}
                  className={`px-3 py-2 text-sm rounded border transition-colors ${
                    paymentMethod === 'Cash'
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  Cash
                </button>
                <button
                  onClick={() => setPaymentMethod('Digital')}
                  className={`px-3 py-2 text-sm rounded border transition-colors ${
                    paymentMethod === 'Digital'
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  Digital
                </button>
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="amountPaid" className="block mb-2 text-xs font-medium text-gray-700">
                Amount Paid
              </label>
              <input
                id="amountPaid"
                type="number"
                step="0.01"
                min="0"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                placeholder="0.00"
              />
            </div>

            <div className="mb-3">
              <label htmlFor="saleDescription" className="block mb-2 text-xs font-medium text-gray-700">
                Sale Description {cart.length > 1 && <span className="text-red-600">*</span>}
              </label>
              <input
                id="saleDescription"
                type="text"
                value={saleDescription}
                onChange={(e) => setSaleDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                placeholder={cart.length === 1 ? "Optional (will use product name)" : "Required for multiple items"}
              />
              {cart.length === 1 && !saleDescription && (
                <p className="text-xs text-gray-500 mt-1">
                  Will default to: {cart[0].product.name}
                </p>
              )}
            </div>

            {amountPaid && parseFloat(amountPaid) >= total && (
              <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-xs text-gray-600 mb-1">Change</p>
                <p className="text-xl font-bold text-gray-900">Rs. {change.toFixed(2)}</p>
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
                        ⚠️ Amount is below minimum price (Rs. {lowestNegotiable.toFixed(2)})
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
                  <span className="font-semibold text-gray-900">Rs. {calculateTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Lowest Negotiable:</span>
                  <span className="font-medium text-orange-600">Rs. {calculateLowestNegotiable().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-semibold text-gray-900">Rs. {(parseFloat(amountPaid) || 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-300 pt-2 mt-2"></div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900">Remaining Amount:</span>
                  <span className="font-bold text-lg text-orange-600">
                    Rs. {(calculateTotal() - (parseFloat(amountPaid) || 0)).toFixed(2)}
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
              <p className="text-red-600 text-xs">Please enter customer details and sale price for credit tracking.</p>
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
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-semibold text-gray-900">Rs. {calculateTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Paid:</span>
                  <span className="font-semibold text-gray-900">Rs. {(parseFloat(amountPaid) || 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-300 pt-2 mt-2"></div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900">Amount Due:</span>
                  <span className="font-bold text-lg text-gray-900">
                    Rs. {(calculateTotal() - (parseFloat(amountPaid) || 0)).toFixed(2)}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="Enter or search customer name"
                  autoComplete="off"
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
                  type="tel"
                  value={partialPaymentData.customerPhone}
                  onChange={(e) => {
                    setPartialPaymentData({
                      ...partialPaymentData,
                      customerPhone: e.target.value
                    })
                    setPartialPaymentError('')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="03xx-xxxxxxx"
                  maxLength={12}
                />
              </div>

              <div>
                <label className="block mb-2 font-medium text-sm text-gray-700">
                  Sale Price <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={partialPaymentData.salePrice}
                  onChange={(e) => {
                    setPartialPaymentData({
                      ...partialPaymentData,
                      salePrice: e.target.value
                    })
                    setPartialPaymentError('')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
                  placeholder="Enter sale price"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum: Rs. {calculateLowestNegotiable().toFixed(2)} (Lowest Negotiable)
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPartialPaymentModal(false)
                  setShowPartialPaymentConfirm(false)
                  setPartialPaymentData({ customerName: '', customerPhone: '', salePrice: '' })
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
                disabled={loading || !partialPaymentData.customerName.trim() || !partialPaymentData.customerPhone.trim() || !partialPaymentData.salePrice.trim()}
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
