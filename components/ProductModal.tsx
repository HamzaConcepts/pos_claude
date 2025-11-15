'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Product } from '@/lib/types'

interface ProductModalProps {
  product: Product | null
  onClose: (refresh: boolean) => void
}

export default function ProductModal({ product, onClose }: ProductModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    price: '',
    cost_price: '',
    stock_quantity: '',
    low_stock_threshold: '10',
    category: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku,
        description: product.description || '',
        price: product.price.toString(),
        cost_price: product.cost_price.toString(),
        stock_quantity: product.stock_quantity.toString(),
        low_stock_threshold: product.low_stock_threshold.toString(),
        category: product.category || '',
      })
    }
  }, [product])

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
        name: formData.name,
        sku: formData.sku,
        description: formData.description || null,
        price: parseFloat(formData.price),
        cost_price: parseFloat(formData.cost_price),
        stock_quantity: parseInt(formData.stock_quantity),
        low_stock_threshold: parseInt(formData.low_stock_threshold),
        category: formData.category || null,
      }

      // Validation
      if (isNaN(payload.price) || payload.price < 0) {
        setError('Price must be a positive number')
        setLoading(false)
        return
      }

      if (isNaN(payload.cost_price) || payload.cost_price < 0) {
        setError('Cost price must be a positive number')
        setLoading(false)
        return
      }

      if (isNaN(payload.stock_quantity) || payload.stock_quantity < 0) {
        setError('Stock quantity must be a positive number')
        setLoading(false)
        return
      }

      const url = product ? `/api/products/${product.id}` : '/api/products'
      const method = product ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
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
      setError('Failed to save product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded border-2 border-black w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b-2 border-black">
          <h2 className="text-2xl font-bold">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
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

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block mb-2 font-medium">
                Product Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="sku" className="block mb-2 font-medium">
                SKU *
              </label>
              <input
                id="sku"
                name="sku"
                type="text"
                value={formData.sku}
                onChange={handleChange}
                className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none font-mono"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="price" className="block mb-2 font-medium">
                Price *
              </label>
              <input
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
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
              <label htmlFor="stock_quantity" className="block mb-2 font-medium">
                Stock Quantity *
              </label>
              <input
                id="stock_quantity"
                name="stock_quantity"
                type="number"
                min="0"
                value={formData.stock_quantity}
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
              <label htmlFor="category" className="block mb-2 font-medium">
                Category
              </label>
              <input
                id="category"
                name="category"
                type="text"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                disabled={loading}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="description" className="block mb-2 font-medium">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                disabled={loading}
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
              {loading ? 'Saving...' : product ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
