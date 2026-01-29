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
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Dark mode detection
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('dark_mode')
    if (savedDarkMode) {
      setIsDarkMode(savedDarkMode === 'true')
    }
    
    const handleDarkModeChange = (event: any) => {
      setIsDarkMode(event.detail.isDarkMode)
    }
    
    window.addEventListener('darkModeChange', handleDarkModeChange)
    return () => window.removeEventListener('darkModeChange', handleDarkModeChange)
  }, [])

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
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`rounded-lg border w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl ${
        isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300'
      }`}>
        <div className={`flex justify-between items-center p-5 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className="text-xl font-semibold">Edit Product</h2>
            {product ? 'Edit Product' : 'Add New Product'}
          <button
            onClick={() => onClose(false)}
            className={`p-1 rounded transition-colors ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
            }`}
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
              <label htmlFor="name" className={`block mb-2 font-medium ${
                isDarkMode ? 'text-gray-300' : ''
              }`}>
                Product Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoFocus
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-3 py-2 border-2 rounded focus:outline-none ${
                  isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-black'
                }`}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="low_stock_threshold" className={`block mb-2 font-medium ${
                isDarkMode ? 'text-gray-300' : ''
              }`}>
                Low Stock Alert Threshold *
              </label>
              <input
                id="low_stock_threshold"
                name="low_stock_threshold"
                type="number"
                min="0"
                value={formData.low_stock_threshold}
                onChange={handleChange}
                className={`w-full px-3 py-2 border-2 rounded focus:outline-none ${
                  isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-black'
                }`}
                required
                disabled={loading}
              />
              <p className={`text-xs mt-1 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Alert when stock falls below this number
              </p>
            </div>

            <div>
              <label htmlFor="description" className={`block mb-2 font-medium ${
                isDarkMode ? 'text-gray-300' : ''
              }`}>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className={`w-full px-3 py-2 border-2 rounded focus:outline-none ${
                  isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-black'
                }`}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => onClose(false)}
              className={`px-6 py-2 border-2 rounded transition-colors ${
                isDarkMode ? 'border-gray-600 hover:bg-gray-700' : 'border-gray-300 hover:bg-gray-100'
              }`}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 font-medium transition-colors disabled:bg-gray-400"
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
