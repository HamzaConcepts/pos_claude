'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { ProductWithBackwardCompatibility } from '@/lib/types'
import { getStoreId } from '@/lib/supabase'

interface Category {
  id: number
  name: string
  subcategories?: Subcategory[]
}

interface Subcategory {
  id: number
  name: string
}

interface ProductModalProps {
  product: ProductWithBackwardCompatibility | null
  onClose: (refresh: boolean) => void
}

export default function ProductModal({ product, onClose }: ProductModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    low_stock_threshold: '10',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || '',
        low_stock_threshold: product.low_stock_threshold.toString(),
      })
    }
  }, [product])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!product) {
        setError('This modal is only for editing products')
        setLoading(false)
        return
      }

      const payload = {
        name: formData.name,
        description: formData.description || null,
        low_stock_threshold: parseInt(formData.low_stock_threshold),
      }

      // Validation
      if (!formData.name.trim()) {
        setError('Product name is required')
        setLoading(false)
        return
      }

      if (isNaN(payload.low_stock_threshold) || payload.low_stock_threshold < 0) {
        setError('Low stock threshold must be a positive number')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
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
      setError('Failed to update product')
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
          <div className="space-y-4">
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
              <label htmlFor="low_stock_threshold" className="block mb-2 font-medium">
                Low Stock Alert Threshold *
              </label>
              <input
                id="low_stock_threshold"
                name="low_stock_threshold"
                type="number"
                min="0"
                value={formData.low_stock_threshold}
                onChange={handleChange}
                className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                required
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Alert when stock falls below this number
              </p>
            </div>

            <div>
              <label htmlFor="description" className="block mb-2 font-medium">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
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
              {loading ? 'Updating...' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
