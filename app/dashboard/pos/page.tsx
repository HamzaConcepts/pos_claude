'use client'

import { useEffect, useState } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, Printer } from 'lucide-react'
import type { Product } from '@/lib/types'
import { supabase } from '@/lib/supabase'

interface CartItem {
  product: Product
  quantity: number
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Digital'>('Cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastSale, setLastSale] = useState<any>(null)
  const [error, setError] = useState('')
  const [cashierId, setCashierId] = useState<string>('')

  useEffect(() => {
    fetchProducts()
    fetchCurrentUser()
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
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCashierId(user.id)
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

  const addToCart = (product: Product) => {
    const existingItem = cart.find((item) => item.product.id === product.id)

    if (existingItem) {
      if (existingItem.quantity < product.stock_quantity) {
        setCart(
          cart.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        )
      } else {
        alert(`Only ${product.stock_quantity} units available`)
      }
    } else {
      if (product.stock_quantity > 0) {
        setCart([...cart, { product, quantity: 1 }])
      } else {
        alert('Product out of stock')
      }
    }

    setSearchTerm('')
    setFilteredProducts([])
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

    setCart(
      cart.map((item) =>
        item.product.id === productId ? { ...item, quantity: newQuantity } : item
      )
    )
  }

  const removeFromCart = (productId: number) => {
    setCart(cart.filter((item) => item.product.id !== productId))
  }

  const clearCart = () => {
    if (confirm('Clear all items from cart?')) {
      setCart([])
      setAmountPaid('')
      setError('')
    }
  }

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
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

    const total = calculateTotal()
    const paid = parseFloat(amountPaid) || 0

    if (paid < total) {
      setError(`Insufficient payment. Total: $${total.toFixed(2)}, Paid: $${paid.toFixed(2)}`)
      return
    }

    setError('')
    setLoading(true)

    try {
      const saleData = {
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        payment_method: paymentMethod,
        amount_paid: paid,
        cashier_id: cashierId,
        notes: null,
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
        fetchProducts() // Refresh product stock
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to process sale')
    } finally {
      setLoading(false)
    }
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
      <div className="max-w-2xl mx-auto">
        <div className="bg-white p-8 rounded border-2 border-black" id="receipt">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">POS System</h1>
            <h2 className="text-xl">Sales Receipt</h2>
          </div>

          <div className="mb-6 border-t-2 border-b-2 border-black py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-text-secondary">Sale Number</p>
                <p className="font-mono font-bold">{lastSale.sale_number}</p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Date</p>
                <p className="font-medium">
                  {new Date(lastSale.sale_date).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Cashier</p>
                <p className="font-medium">{lastSale.users?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Payment Method</p>
                <p className="font-medium">{lastSale.payment_method}</p>
              </div>
            </div>
          </div>

          <table className="w-full mb-6">
            <thead className="border-b-2 border-black">
              <tr>
                <th className="text-left py-2">Item</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Price</th>
                <th className="text-right py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {lastSale.sale_items?.map((item: any) => (
                <tr key={item.id} className="border-b border-gray-300">
                  <td className="py-2">{item.products?.name}</td>
                  <td className="text-right">{item.quantity}</td>
                  <td className="text-right">${item.unit_price.toFixed(2)}</td>
                  <td className="text-right font-medium">
                    ${item.subtotal.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t-2 border-black pt-4">
            <div className="flex justify-between text-xl font-bold mb-2">
              <span>Total:</span>
              <span>${lastSale.total_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Amount Paid:</span>
              <span>${lastSale.amount_paid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-medium">
              <span>Change:</span>
              <span>${(lastSale.amount_paid - lastSale.total_amount).toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-text-secondary">
            <p>Thank you for your business!</p>
          </div>
        </div>

        <div className="flex gap-4 mt-6 print:hidden">
          <button
            onClick={handlePrintReceipt}
            className="flex-1 flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors"
          >
            <Printer size={20} />
            Print Receipt
          </button>
          <button
            onClick={handleNewSale}
            className="flex-1 bg-white border-2 border-black px-6 py-3 rounded hover:bg-gray-100 transition-colors"
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
    <div>
      <h1 className="text-3xl font-bold mb-6">Point of Sale</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Search and Cart */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="bg-white p-4 rounded border-2 border-black">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border-2 border-black rounded focus:outline-none text-lg"
              />
            </div>

            {filteredProducts.length > 0 && (
              <div className="mt-2 border-2 border-black rounded max-h-64 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="w-full p-3 text-left hover:bg-bg-secondary transition-colors border-b border-gray-300 last:border-b-0"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-text-secondary">
                          {product.sku} • Stock: {product.stock_quantity}
                        </p>
                      </div>
                      <p className="font-bold">${product.price.toFixed(2)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="bg-white rounded border-2 border-black">
            <div className="p-4 bg-black text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingCart size={24} />
                <h2 className="text-xl font-bold">Cart</h2>
                <span className="bg-white text-black px-2 py-1 rounded text-sm">
                  {cart.length}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-sm hover:bg-gray-800 px-3 py-1 rounded transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="p-4">
              {cart.length === 0 ? (
                <p className="text-center py-8 text-text-secondary">
                  Cart is empty. Search and add products.
                </p>
              ) : (
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between p-3 border-2 border-black rounded"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-sm text-text-secondary">
                          ${item.product.price.toFixed(2)} each
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 border-2 border-black rounded">
                          <button
                            onClick={() =>
                              updateQuantity(item.product.id, item.quantity - 1)
                            }
                            className="p-2 hover:bg-gray-200 transition-colors"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="font-bold w-8 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.product.id, item.quantity + 1)
                            }
                            className="p-2 hover:bg-gray-200 transition-colors"
                          >
                            <Plus size={16} />
                          </button>
                        </div>

                        <p className="font-bold w-20 text-right">
                          ${(item.product.price * item.quantity).toFixed(2)}
                        </p>

                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-2 hover:bg-red-100 text-status-error rounded transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
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
          <div className="bg-white p-6 rounded border-2 border-black sticky top-4">
            <h2 className="text-2xl font-bold mb-6">Payment</h2>

            {error && (
              <div className="mb-4 p-3 bg-status-error text-white rounded text-sm">
                {error}
              </div>
            )}

            <div className="mb-6">
              <p className="text-sm text-text-secondary mb-2">Total Amount</p>
              <p className="text-4xl font-bold">${total.toFixed(2)}</p>
            </div>

            <div className="mb-4">
              <label className="block mb-2 font-medium">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod('Cash')}
                  className={`p-3 rounded border-2 transition-colors ${
                    paymentMethod === 'Cash'
                      ? 'bg-black text-white border-black'
                      : 'bg-white border-black hover:bg-gray-100'
                  }`}
                >
                  Cash
                </button>
                <button
                  onClick={() => setPaymentMethod('Digital')}
                  className={`p-3 rounded border-2 transition-colors ${
                    paymentMethod === 'Digital'
                      ? 'bg-black text-white border-black'
                      : 'bg-white border-black hover:bg-gray-100'
                  }`}
                >
                  Digital
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="amountPaid" className="block mb-2 font-medium">
                Amount Paid
              </label>
              <input
                id="amountPaid"
                type="number"
                step="0.01"
                min="0"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full px-3 py-3 border-2 border-black rounded focus:outline-none text-lg"
                placeholder="0.00"
              />
            </div>

            {amountPaid && parseFloat(amountPaid) >= total && (
              <div className="mb-4 p-3 bg-bg-secondary rounded">
                <p className="text-sm text-text-secondary mb-1">Change</p>
                <p className="text-2xl font-bold">${change.toFixed(2)}</p>
              </div>
            )}

            <button
              onClick={handleProcessSale}
              disabled={cart.length === 0 || loading}
              className="w-full bg-black text-white py-4 rounded text-lg font-bold hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
            >
              {loading ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
