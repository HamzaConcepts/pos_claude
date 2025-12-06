'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface Batch {
  id: number
  batch_number: string | null
  purchase_date: string
  cost_price: number
  selling_price: number | null
  lowest_negotiable_price: number | null
  quantity_purchased: number
  quantity_remaining: number
}

interface BatchEditModalProps {
  batch: Batch
  onClose: (refresh: boolean) => void
}

export default function BatchEditModal({ batch, onClose }: BatchEditModalProps) {
  const [formData, setFormData] = useState({
    cost_price: '',
    selling_price: '',
    lowest_negotiable_price: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (batch) {
      setFormData({
        cost_price: batch.cost_price.toString(),
        selling_price: (batch.selling_price || 0).toString(),
        lowest_negotiable_price: (batch.lowest_negotiable_price || batch.selling_price || 0).toString(),
      })
    }
  }, [batch])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const payload = {
        cost_price: parseFloat(formData.cost_price),
        selling_price: parseFloat(formData.selling_price),
        lowest_negotiable_price: parseFloat(formData.lowest_negotiable_price),
      }

      // Validation
      if (isNaN(payload.cost_price) || payload.cost_price < 0) {
        setError('Cost price must be a positive number')
        setLoading(false)
        return
      }

      if (isNaN(payload.selling_price) || payload.selling_price < 0) {
        setError('Selling price must be a positive number')
        setLoading(false)
        return
      }

      if (isNaN(payload.lowest_negotiable_price) || payload.lowest_negotiable_price < 0) {
        setError('Lowest negotiable price must be a positive number')
        setLoading(false)
        return
      }

      if (payload.lowest_negotiable_price > payload.selling_price) {
        setError('Lowest negotiable price cannot be higher than selling price')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/stock-batches/${batch.id}`, {
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
      setError('Failed to update batch prices')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded border-2 border-black w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b-2 border-black">
          <h2 className="text-2xl font-bold">
            Edit Batch Prices
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
          <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
            <div className="text-sm text-gray-600 space-y-1">
              <div>
                <span className="font-medium">Batch:</span> {batch.batch_number || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Purchase Date:</span> {new Date(batch.purchase_date).toLocaleDateString()}
              </div>
              <div>
                <span className="font-medium">Quantity:</span> {batch.quantity_remaining} / {batch.quantity_purchased} units
              </div>
            </div>
          </div>

          <div className="space-y-4">
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
              <p className="text-xs text-gray-500 mt-1">
                What you paid for this batch
              </p>
            </div>

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
              <p className="text-xs text-gray-500 mt-1">
                Your target selling price for this batch
              </p>
            </div>

            <div>
              <label htmlFor="lowest_negotiable_price" className="block mb-2 font-medium">
                Lowest Negotiable Price *
              </label>
              <input
                id="lowest_negotiable_price"
                name="lowest_negotiable_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.lowest_negotiable_price}
                onChange={handleChange}
                className="w-full px-3 py-2 border-2 border-black rounded focus:outline-none"
                required
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum price you'll accept for this batch
              </p>
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
