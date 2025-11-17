'use client'

import { useState, useEffect } from 'react'
import { X, Clock, Package } from 'lucide-react'

interface RestockHistoryModalProps {
  productId: number
  productName: string
  onClose: () => void
}

interface InventoryRecord {
  id: number
  cost_price: number
  selling_price: number
  quantity_added: number
  quantity_remaining: number
  low_stock_threshold: number
  batch_number: string | null
  restock_date: string
  notes: string | null
  created_at: string
}

export default function RestockHistoryModal({ productId, productName, onClose }: RestockHistoryModalProps) {
  const [history, setHistory] = useState<InventoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchRestockHistory()
  }, [productId])

  const fetchRestockHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/products/${productId}/restock-history`)
      const result = await response.json()

      if (result.success) {
        setHistory(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to fetch restock history')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded border-2 border-black w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b-2 border-black sticky top-0 bg-white">
          <div>
            <h2 className="text-2xl font-bold">Restock History</h2>
            <p className="text-sm text-text-secondary mt-1">{productName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-lg text-text-secondary">Loading history...</div>
            </div>
          ) : error ? (
            <div className="p-4 bg-status-error text-white rounded">
              {error}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <Package size={48} className="mx-auto mb-4 opacity-50" />
              <p>No restock history found for this product</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((record, index) => {
                const quantitySold = record.quantity_added - record.quantity_remaining
                const isLatest = index === 0

                return (
                  <div
                    key={record.id}
                    className={`border-2 rounded p-4 ${
                      isLatest ? 'border-black bg-gray-50' : 'border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded ${isLatest ? 'bg-black text-white' : 'bg-gray-200'}`}>
                          <Package size={20} />
                        </div>
                        <div>
                          <div className="font-mono text-sm font-bold">
                            {record.batch_number || 'No Batch Number'}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-text-secondary mt-1">
                            <Clock size={12} />
                            {new Date(record.restock_date).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                      {isLatest && (
                        <span className="px-2 py-1 bg-black text-white text-xs rounded font-medium">
                          Latest
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div>
                        <div className="text-xs text-text-secondary mb-1">Quantity Added</div>
                        <div className="font-bold text-lg">{record.quantity_added}</div>
                      </div>
                      <div>
                        <div className="text-xs text-text-secondary mb-1">Remaining</div>
                        <div className={`font-bold text-lg ${
                          record.quantity_remaining === 0 ? 'text-status-error' : ''
                        }`}>
                          {record.quantity_remaining}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-text-secondary mb-1">Sold</div>
                        <div className="font-bold text-lg text-status-success">{quantitySold}</div>
                      </div>
                      <div>
                        <div className="text-xs text-text-secondary mb-1">Usage</div>
                        <div className="font-bold text-lg">
                          {((quantitySold / record.quantity_added) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-3 border-t border-gray-300">
                      <div>
                        <div className="text-xs text-text-secondary mb-1">Cost Price</div>
                        <div className="font-medium">${record.cost_price.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-text-secondary mb-1">Selling Price</div>
                        <div className="font-medium">${record.selling_price.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-text-secondary mb-1">Profit/Unit</div>
                        <div className="font-medium text-status-success">
                          ${(record.selling_price - record.cost_price).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {record.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <div className="text-xs text-text-secondary mb-1">Notes</div>
                        <div className="text-sm italic">{record.notes}</div>
                      </div>
                    )}

                    {record.quantity_remaining === 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-status-error text-white text-xs rounded">
                          <span>●</span>
                          <span>Batch Depleted</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Summary */}
              <div className="border-2 border-black rounded p-4 bg-black text-white mt-6">
                <h3 className="font-bold mb-3">Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs opacity-80 mb-1">Total Restocks</div>
                    <div className="text-2xl font-bold">{history.length}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-80 mb-1">Total Added</div>
                    <div className="text-2xl font-bold">
                      {history.reduce((sum, r) => sum + r.quantity_added, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs opacity-80 mb-1">Total Sold</div>
                    <div className="text-2xl font-bold">
                      {history.reduce((sum, r) => sum + (r.quantity_added - r.quantity_remaining), 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs opacity-80 mb-1">Current Stock</div>
                    <div className="text-2xl font-bold">
                      {history.reduce((sum, r) => sum + r.quantity_remaining, 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t-2 border-black bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-black text-white rounded hover:bg-gray-800 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
