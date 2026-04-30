'use client'

import { useEffect, useMemo, useState } from 'react'
import { XIcon } from '@phosphor-icons/react'
import type { ProductWithBackwardCompatibility, StockBatch } from '@/lib/types'

interface InventoryPurchaseEditModalProps {
  product: ProductWithBackwardCompatibility
  onClose: (refresh: boolean) => void
}

type BatchFormRow = {
  id: number
  batch_number: string | null
  purchase_date: string
  cost_price: string
  selling_price: string
  quantity_remaining: string
}

export default function InventoryPurchaseEditModal({ product, onClose }: InventoryPurchaseEditModalProps) {
  const initialBatches = useMemo(() => {
    return (product.batches || []).map((batch: StockBatch): BatchFormRow => ({
      id: batch.id,
      batch_number: batch.batch_number,
      purchase_date: batch.purchase_date,
      cost_price: batch.cost_price.toString(),
      selling_price: (batch.selling_price ?? 0).toString(),
      quantity_remaining: batch.quantity_remaining.toString(),
    }))
  }, [product.batches])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    low_stock_threshold: '10',
    lowest_negotiable_price: '',
    batches: [] as BatchFormRow[],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fallbackLowest = product.batches?.[0]?.lowest_negotiable_price ?? 0
    setFormData({
      name: product.name || '',
      description: product.description || '',
      low_stock_threshold: (product.low_stock_threshold ?? 10).toString(),
      lowest_negotiable_price: (product.aggregated_stock?.aggregated_lowest_negotiable ?? fallbackLowest).toString(),
      batches: initialBatches,
    })
  }, [product, initialBatches])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleBatchChange = (index: number, field: keyof BatchFormRow, value: string) => {
    setFormData(prev => {
      const nextBatches = [...prev.batches]
      nextBatches[index] = {
        ...nextBatches[index],
        [field]: value,
      }
      return {
        ...prev,
        batches: nextBatches,
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const productPayload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        low_stock_threshold: parseInt(formData.low_stock_threshold, 10),
      }

      const lowestNegotiable = parseFloat(formData.lowest_negotiable_price)

      if (!productPayload.name) {
        setError('Product name is required')
        setLoading(false)
        return
      }

      if (isNaN(productPayload.low_stock_threshold) || productPayload.low_stock_threshold < 0) {
        setError('Low stock threshold must be a positive number')
        setLoading(false)
        return
      }

      if (isNaN(lowestNegotiable) || lowestNegotiable < 0) {
        setError('Lowest negotiable price must be a positive number')
        setLoading(false)
        return
      }

      const normalizedBatches = formData.batches.map((batch, index) => {
        const costPrice = parseFloat(batch.cost_price)
        const sellingPrice = parseFloat(batch.selling_price)
        const remaining = parseInt(batch.quantity_remaining, 10)

        if (isNaN(costPrice) || costPrice < 0) {
          throw new Error(`Batch ${index + 1}: Cost price must be a positive number`)
        }

        if (isNaN(sellingPrice) || sellingPrice < 0) {
          throw new Error(`Batch ${index + 1}: Selling price must be a positive number`)
        }

        if (lowestNegotiable > sellingPrice) {
          throw new Error(`Batch ${index + 1}: Lowest negotiable price cannot be higher than selling price`)
        }

        if (isNaN(remaining) || remaining < 0) {
          throw new Error(`Batch ${index + 1}: Stock remaining must be zero or a positive number`)
        }

        return {
          id: batch.id,
          cost_price: costPrice,
          selling_price: sellingPrice,
          lowest_negotiable_price: lowestNegotiable,
          quantity_remaining: remaining,
        }
      })

      const productResponse = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productPayload),
      })

      const productResult = await productResponse.json()

      if (!productResult.success) {
        setError(productResult.error || 'Failed to update product details')
        setLoading(false)
        return
      }

      const batchResponses = await Promise.all(
        normalizedBatches.map(batch =>
          fetch(`/api/stock-batches/${batch.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batch),
          })
        )
      )

      const batchResults = await Promise.all(batchResponses.map(response => response.json()))
      const failedBatch = batchResults.find(result => !result.success)

      if (failedBatch) {
        setError(failedBatch.error || 'Failed to update batch details')
        setLoading(false)
        return
      }

      onClose(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update inventory purchase'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-lg border w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">Edit Inventory Record</h2>
          <button
            onClick={() => onClose(false)}
            className="p-1 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <XIcon size={24} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-3 bg-status-error text-white rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Product Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block mb-2 font-medium dark:text-gray-300">
                  Product Name *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border-2 rounded focus:outline-none border-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="low_stock_threshold" className="block mb-2 font-medium dark:text-gray-300">
                  Low Stock Threshold *
                </label>
                <input
                  id="low_stock_threshold"
                  name="low_stock_threshold"
                  type="number"
                  min="0"
                  value={formData.low_stock_threshold}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border-2 rounded focus:outline-none border-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="description" className="block mb-2 font-medium dark:text-gray-300">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border-2 rounded focus:outline-none border-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                disabled={loading}
              />
            </div>

            <div className="mt-4">
              <label htmlFor="lowest_negotiable_price" className="block mb-2 font-medium dark:text-gray-300">
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
                className="w-full px-3 py-2 border-2 rounded focus:outline-none border-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Batch Details</h3>
            {formData.batches.length === 0 ? (
              <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                No batches found for this product.
              </div>
            ) : (
              <div className="space-y-4">
                {formData.batches.map((batch, index) => (
                  <div key={batch.id} className="rounded border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Batch {index + 1} {batch.batch_number ? `• ${batch.batch_number}` : ''}
                      </span>
                      <span>{new Date(batch.purchase_date).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                          Cost Price *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={batch.cost_price}
                          onChange={(e) => handleBatchChange(index, 'cost_price', e.target.value)}
                          className="w-full px-3 py-2 border-2 rounded focus:outline-none border-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                          required
                          disabled={loading}
                        />
                      </div>

                      <div>
                        <label className="block mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                          Selling Price *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={batch.selling_price}
                          onChange={(e) => handleBatchChange(index, 'selling_price', e.target.value)}
                          className="w-full px-3 py-2 border-2 rounded focus:outline-none border-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                          required
                          disabled={loading}
                        />
                      </div>

                      <div>
                        <label className="block mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                          Stock Remaining *
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={batch.quantity_remaining}
                          onChange={(e) => handleBatchChange(index, 'quantity_remaining', e.target.value)}
                          className="w-full px-3 py-2 border-2 rounded focus:outline-none border-black dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-6 py-2 border-2 rounded transition-colors border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
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
