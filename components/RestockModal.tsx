'use client'

import { useState, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import type { ProductWithBackwardCompatibility } from '@/lib/types'

interface RestockModalProps {
  onClose: (refresh: boolean) => void
}

export default function RestockModal({ onClose }: RestockModalProps) {
  const [allProducts, setAllProducts] = useState<ProductWithBackwardCompatibility[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductWithBackwardCompatibility | null>(null)
  const [formData, setFormData] = useState({
    cost_price: '',
    selling_price: '',
    quantity_added: '',
    low_stock_threshold: '10',
    batch_number: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(true)

  useEffect(() => {
    fetchAllProducts()
  }, [])

  const fetchAllProducts = async () => {
    try {
      const response = await fetch('/api/products?include_inactive=true')
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

  const filteredProducts = searchTerm
    ? allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : []

  const handleProductSelect = (product: ProductWithBackwardCompatibility) => {
    setSelectedProduct(product)
    setFormData({
      cost_price: product.cost_price?.toString() || '',
      selling_price: product.price?.toString() || '',
      quantity_added: '',
      low_stock_threshold: product.low_stock_threshold?.toString() || '10',
      batch_number: `BATCH-${Date.now()}`,
      notes: '',
    })
    setSearchTerm('')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = {
        cost_price: parseFloat(formData.cost_price),
        selling_price: parseFloat(formData.selling_price),
        quantity_added: parseInt(formData.quantity_added),
        low_stock_threshold: parseInt(formData.low_stock_threshold),
        batch_number: formData.batch_number || null,
        notes: formData.notes || null,
      }

      // Validation
      if (isNaN(payload.selling_price) || payload.selling_price < 0) {
        setError('Selling price must be a positive number')
        setLoading(false)
        return
      }

      if (isNaN(payload.cost_price) || payload.cost_price < 0) {
        setError('Cost price must be a positive number')
        setLoading(false)
        return
      }

      if (isNaN(payload.quantity_added) || payload.quantity_added <= 0) {
        setError('Quantity must be greater than 0')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/products/${selectedProduct!.id}/restock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (result.success) {
        onClose(true)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to restock product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded border-2 border-black w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b-2 border-black">
          <h2 className="text-2xl font-bold">Restock Product</h2>
          <button
            onClick={() => onClose(false)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <X size={24} />
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
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
                <input
                  type="text"
                  placeholder="Search by name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border-2 border-black rounded focus:outline-none"
                  autoFocus
                />
              </div>

              {searchTerm && filteredProducts.length > 0 && (
                <div className="border-2 border-black rounded max-h-64 overflow-y-auto">
                  {filteredProducts.slice(0, 10).map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleProductSelect(product)}
                      className="w-full p-3 text-left hover:bg-bg-secondary transition-colors border-b border-gray-300 last:border-b-0"
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
              <div className="mb-6 p-4 bg-bg-secondary rounded border-2 border-black">
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
                    className="text-sm text-text-secondary hover:text-black"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Restock Form */}
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="selling_price" className="block mb-2 font-medium">
                      Selling Price *
                    </label>
                    <input
                      id="selling_price"
                      name="selling_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.selling_price}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label htmlFor="cost_price" className="block mb-2 font-medium">
                      Cost Price *
                    </label>
                    <input
                      id="cost_price"
                      name="cost_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cost_price}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label htmlFor="quantity_added" className="block mb-2 font-medium">
                      Quantity to Add *
                    </label>
                    <input
                      id="quantity_added"
                      name="quantity_added"
                      type="number"
                      min="1"
                      value={formData.quantity_added}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label htmlFor="low_stock_threshold" className="block mb-2 font-medium">
                      Low Stock Threshold
                    </label>
                    <input
                      id="low_stock_threshold"
                      name="low_stock_threshold"
                      type="number"
                      min="0"
                      value={formData.low_stock_threshold}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                      disabled={loading}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="batch_number" className="block mb-2 font-medium">
                      Batch Number
                    </label>
                    <input
                      id="batch_number"
                      name="batch_number"
                      type="text"
                      value={formData.batch_number}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none font-mono"
                      disabled={loading}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="notes" className="block mb-2 font-medium">
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                      disabled={loading}
                      placeholder="Optional notes about this restock..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => onClose(false)}
                    className="px-6 py-2 border-2 border-black rounded hover:bg-gray-100 transition-colors"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors disabled:bg-gray-400"
                    disabled={loading}
                  >
                    {loading ? 'Restocking...' : 'Restock'}
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
