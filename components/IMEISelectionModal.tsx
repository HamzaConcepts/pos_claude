'use client'

import { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import type { ProductIMEI } from '@/lib/types'
import { getStoreId } from '@/lib/supabase'

interface IMEISelectionModalProps {
  product: any
  quantity: number
  onSelect: (imeis: string[]) => void
  onClose: () => void
}

export default function IMEISelectionModal({
  product,
  quantity,
  onSelect,
  onClose,
}: IMEISelectionModalProps) {
  const [availableIMEIs, setAvailableIMEIs] = useState<ProductIMEI[]>([])
  const [selectedIMEIs, setSelectedIMEIs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAvailableIMEIs()
  }, [product.id])

  const fetchAvailableIMEIs = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) {
        setError('Store ID not found')
        return
      }

      const response = await fetch(
        `/api/imeis?product_id=${product.id}&store_id=${storeId}&status=in_stock`
      )
      const result = await response.json()

      if (result.success) {
        setAvailableIMEIs(result.data)
        
        // Auto-select if quantity matches available
        if (result.data.length === quantity) {
          setSelectedIMEIs(result.data.map((imei: ProductIMEI) => imei.imei_number))
        }
      } else {
        setError(result.error || 'Failed to load IMEI numbers')
      }
    } catch (err) {
      console.error('Error fetching IMEIs:', err)
      setError('Failed to load IMEI numbers')
    } finally {
      setLoading(false)
    }
  }

  const toggleIMEI = (imeiNumber: string) => {
    if (selectedIMEIs.includes(imeiNumber)) {
      setSelectedIMEIs(selectedIMEIs.filter((i) => i !== imeiNumber))
    } else {
      if (selectedIMEIs.length < quantity) {
        setSelectedIMEIs([...selectedIMEIs, imeiNumber])
      }
    }
  }

  const handleConfirm = () => {
    if (selectedIMEIs.length !== quantity) {
      setError(`Please select exactly ${quantity} IMEI number${quantity > 1 ? 's' : ''}`)
      return
    }
    onSelect(selectedIMEIs)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded border-2 border-black w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b-2 border-black sticky top-0 bg-white">
          <div>
            <h2 className="text-2xl font-bold">Select IMEI Numbers</h2>
            <p className="text-sm text-text-secondary mt-1">
              {product.name} - Select {quantity} IMEI{quantity > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
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
          {loading ? (
            <div className="text-center py-8 text-text-secondary">
              Loading available IMEI numbers...
            </div>
          ) : availableIMEIs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-status-error font-medium mb-2">
                No IMEI numbers available in stock
              </p>
              <p className="text-sm text-text-secondary">
                Please restock this product with IMEI numbers before selling.
              </p>
            </div>
          ) : availableIMEIs.length < quantity ? (
            <div className="text-center py-8">
              <p className="text-status-warning font-medium mb-2">
                Insufficient IMEI numbers available
              </p>
              <p className="text-sm text-text-secondary">
                Available: {availableIMEIs.length} | Required: {quantity}
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-4 p-3 bg-bg-secondary rounded border border-gray-300">
                <p className="text-sm">
                  Selected: <span className="font-bold">{selectedIMEIs.length}</span> / {quantity}
                </p>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableIMEIs.map((imei) => {
                  const isSelected = selectedIMEIs.includes(imei.imei_number)
                  const isDisabled = !isSelected && selectedIMEIs.length >= quantity

                  return (
                    <button
                      key={imei.id}
                      onClick={() => !isDisabled && toggleIMEI(imei.imei_number)}
                      disabled={isDisabled}
                      className={`w-full p-4 rounded border-2 text-left transition-all ${
                        isSelected
                          ? 'border-black bg-green-50'
                          : isDisabled
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                          : 'border-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-mono font-bold text-lg">{imei.imei_number}</p>
                          {imei.batch_id && (
                            <p className="text-xs text-text-secondary mt-1">
                              Batch: {(imei as any).batch_number || `#${imei.batch_id}`}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="ml-4 w-8 h-8 rounded-full bg-black flex items-center justify-center">
                            <Check size={20} className="text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-4 mt-6 sticky bottom-0 bg-white pt-4 border-t-2 border-gray-200">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-white text-black border-2 border-black rounded hover:bg-bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={selectedIMEIs.length !== quantity}
                  className="flex-1 px-4 py-3 bg-black text-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Selection ({selectedIMEIs.length}/{quantity})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
