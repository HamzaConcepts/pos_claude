'use client'

import { useState, useEffect } from 'react'
import { getStoreId, isManager } from '@/lib/supabase'
import { useCurrency } from '@/lib/currency-context'
import { MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react'

export default function SupplierReturnsTab() {
  const { currency, formatCurrency } = useCurrency()
  const [view, setView] = useState<'list' | 'create'>('list')
  const [isManagerUser, setIsManagerUser] = useState(false)

  // -- HISTORY STATE --
  const [returns, setReturns] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historySearch, setHistorySearch] = useState('')
  const [historyError, setHistoryError] = useState('')

  // -- CREATE RETURN STATE --
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [stockBatches, setStockBatches] = useState<any[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)
  
  const [returnItems, setReturnItems] = useState<any[]>([]) // [{batch_id, product_id, product_name, max_qty, qty, unit_price, return_price, supplier_id}]
  const [refundMethod, setRefundMethod] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null)

  useEffect(() => {
    checkRole()
    fetchHistory()
    fetchSuppliers()
    fetchStockBatches()
  }, [])

  const checkRole = async () => {
    const role = await isManager()
    setIsManagerUser(role)
  }

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true)
      const storeId = getStoreId()
      if (!storeId) return

      const res = await fetch(`/api/returns?store_id=${storeId}&type=supplier`)
      const data = await res.json()

      if (data.success) {
        setReturns(data.data)
      } else {
        setHistoryError(data.error || 'Failed to load returns')
      }
    } catch (err) {
      setHistoryError('An error occurred while fetching returns')
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleDeleteHistory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this return record? This will NOT reverse the stock/financial changes made during the return.')) return

    try {
      const res = await fetch(`/api/returns?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()

      if (data.success) {
        setReturns(prev => prev.filter(r => r.id !== id))
      } else {
        alert(data.error || 'Failed to delete')
      }
    } catch (err) {
      alert('Error deleting return')
    }
  }

  const fetchSuppliers = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return
      const res = await fetch(`/api/suppliers?store_id=${storeId}`)
      const result = await res.json()
      if (result.success) {
        setSuppliers(result.data)
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err)
    }
  }

  const fetchStockBatches = async () => {
    try {
      setLoadingBatches(true)
      const storeId = getStoreId()
      if (!storeId) return
      const res = await fetch(`/api/stock-batches?store_id=${storeId}`)
      const result = await res.json()
      if (result.success) {
        // Only show batches with remaining stock
        setStockBatches(result.data.filter((b: any) => b.quantity_remaining > 0))
      }
    } catch (err) {
      console.error('Error fetching stock batches:', err)
    } finally {
      setLoadingBatches(false)
    }
  }

  const handleAddBatchToReturn = (batch: any) => {
    if (returnItems.find(i => i.batch_id === batch.id)) return // Already added

    if (returnItems.length === 0 && batch.supplier_id) {
      setSelectedSupplier(batch.supplier_id)
      setSearchQuery('') 
    } else if (returnItems.length > 0 && batch.supplier_id !== selectedSupplier) {
      setError('You can only return items to one supplier at a time. This item belongs to a different supplier.')
      return
    }

    setReturnItems(prev => [...prev, {
      batch_id: batch.id,
      product_id: batch.product_id,
      product_name: batch.products?.name,
      supplier_id: batch.supplier_id,
      max_qty: batch.quantity_remaining,
      qty: 1,
      unit_price: batch.cost_price,
      return_price: batch.cost_price // Default to cost price
    }])
    setError('')
  }

  const handleRemoveItem = (batchId: number) => {
    setReturnItems(prev => {
      const newItems = prev.filter(i => i.batch_id !== batchId)
      if (newItems.length === 0) {
        setSelectedSupplier(null)
      }
      return newItems
    })
  }

  const handleUpdateItem = (batchId: number, field: string, value: number) => {
    setReturnItems(prev => prev.map(item => {
      if (item.batch_id === batchId) {
        let finalValue = value
        if (field === 'qty') {
          if (value < 1) finalValue = 1
          if (value > item.max_qty) finalValue = item.max_qty
        } else if (field === 'return_price') {
          if (value < 0) finalValue = 0
          if (value > item.unit_price) finalValue = item.unit_price
        }
        return { ...item, [field]: finalValue }
      }
      return item
    }))
  }

  const calculateTotalRefund = () => {
    return returnItems.reduce((total, item) => total + (item.qty * item.return_price), 0)
  }

  const handleSubmitReturn = async () => {
    if (returnItems.length === 0) {
      setError('Please add at least one item to return.')
      return
    }

    if (!selectedSupplier) {
      setError('A supplier must be associated with the items being returned.')
      return
    }

    setProcessing(true)
    setError('')

    try {
      const storeId = getStoreId()
      const cashierId = typeof window !== 'undefined' ? sessionStorage.getItem('user_id') : null
      const supplierName = suppliers.find(s => s.id === selectedSupplier)?.supplier_name || 'Unknown Supplier'

      const payload = {
        store_id: storeId,
        return_type: 'supplier',
        supplier_id: selectedSupplier,
        supplier_name: supplierName,
        total_refund_amount: calculateTotalRefund(),
        refund_method: refundMethod,
        notes: notes,
        cashier_id: cashierId,
        items: returnItems.map(item => ({
          ...item,
          quantity: item.qty
        }))
      }

      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await res.json()

      if (result.success) {
        alert('Supplier return processed successfully! Stock has been reduced.')
        setReturnItems([])
        setSelectedSupplier(null)
        setSearchQuery('')
        fetchStockBatches() // refresh stock
        fetchHistory()
        setView('list')
      } else {
        setError(result.error || 'Failed to process return')
      }
    } catch (err) {
      setError('An error occurred while processing the return.')
    } finally {
      setProcessing(false)
    }
  }

  const filteredHistory = returns.filter(r => {
    if (!historySearch.trim()) return true
    const q = historySearch.toLowerCase()
    return (
      r.id.toString().includes(q) ||
      (r.supplier_name && r.supplier_name.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <div className="animate-fadeIn">
          <div className="flex justify-between items-center gap-4 flex-wrap mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Supplier Returns</h3>
            
            <div className="flex items-center gap-4 flex-1 justify-end">
              <div className="relative max-w-sm w-full">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search supplier returns..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                />
              </div>
              <button
                onClick={() => setView('create')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 whitespace-nowrap font-medium"
              >
                <Plus size={20} />
                Create Return
              </button>
            </div>
          </div>

          {historyError && <p className="text-red-500 text-sm mb-4">{historyError}</p>}

          {loadingHistory ? (
            <div className="text-center p-8 text-gray-500">Loading history...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-500">
              No supplier return records found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-[#111] text-gray-600 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3 text-right">Refund Amount</th>
                    <th className="px-4 py-3">Items</th>
                    {isManagerUser && <th className="px-4 py-3 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-[#1a1a1a]">
                  {filteredHistory.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">RET-{r.id.toString().padStart(4, '0')}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {new Date(r.created_at).toLocaleString('en-PK')}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {r.supplier_name}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency(r.total_refund_amount, 2)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">
                        {r.return_items?.length || 0} item(s)
                      </td>
                      {isManagerUser && (
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteHistory(r.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete Record"
                          >
                            <Trash size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'create' && (
        <div className="animate-fadeIn flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-[350px] flex-shrink-0 flex flex-col gap-4">
            <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex-1">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {selectedSupplier 
                    ? `Products from: ${suppliers.find(s => s.id === selectedSupplier)?.supplier_name || 'Selected'}`
                    : 'Search Stock'
                  }
                </h3>
              </div>
              
              {!selectedSupplier && (
                <input
                  type="text"
                  placeholder="Search products by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 mb-4 text-sm"
                />
              )}

              {loadingBatches ? (
                <p className="text-sm text-gray-500">Loading stock...</p>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                  {stockBatches
                    .filter(b => {
                      if (selectedSupplier) {
                        return b.supplier_id === selectedSupplier
                      }
                      if (!searchQuery.trim()) return true
                      return b.products?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                    })
                    .map(batch => (
                    <div key={batch.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-[#111] flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{batch.products?.name}</p>
                        <p className="text-xs text-gray-500">Batch #{batch.batch_number} • Qty Available: {batch.quantity_remaining}</p>
                      </div>
                      <button
                        onClick={() => handleAddBatchToReturn(batch)}
                        disabled={returnItems.some(i => i.batch_id === batch.id)}
                        className="px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs font-medium rounded hover:bg-purple-200 disabled:opacity-50"
                      >
                        {returnItems.some(i => i.batch_id === batch.id) ? 'Added' : 'Add'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 bg-gray-50 dark:bg-[#1a1a1a] p-6 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Return Details</h3>
              <button
                onClick={() => {
                  setView('list')
                  setReturnItems([])
                  setSelectedSupplier(null)
                  setSearchQuery('')
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium"
              >
                Back to History
              </button>
            </div>
            
            {returnItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex-1 flex items-center justify-center">
                Add items from the left to start a supplier return.
              </div>
            ) : (
              <div className="space-y-6 flex-1">
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {returnItems.map(item => (
                    <div key={item.batch_id} className="p-4 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 relative">
                      <button 
                        onClick={() => handleRemoveItem(item.batch_id)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xs font-bold"
                      >
                        ✕
                      </button>
                      <p className="font-medium text-gray-900 dark:text-white mb-2 pr-4">{item.product_name}</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-gray-500">Qty to Return (Max {item.max_qty})</label>
                          <input
                            type="number"
                            min="1"
                            max={item.max_qty}
                            value={item.qty ?? ''}
                            onChange={(e) => handleUpdateItem(item.batch_id, 'qty', parseInt(e.target.value) || 1)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded mt-1 text-sm bg-white dark:bg-[#111]"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Return Price (Max {item.unit_price})</label>
                          <input
                            type="number"
                            min="0"
                            max={item.unit_price}
                            step="0.01"
                            value={item.return_price ?? ''}
                            onChange={(e) => handleUpdateItem(item.batch_id, 'return_price', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded mt-1 text-sm bg-white dark:bg-[#111]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Financial Handling</label>
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#111] text-sm"
                    >
                      <option value="Cash">Cash Return (Supplier gave cash)</option>
                      <option value="Ledger_Credit">Adjust Ledger / Khata</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#111] text-sm"
                      placeholder="Optional details"
                    />
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-6 border border-purple-100 dark:border-purple-800 mt-auto">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-purple-800 dark:text-purple-300 font-medium">Total Return Value</p>
                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {formatCurrency(calculateTotalRefund(), 2)}
                    </p>
                  </div>

                  {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}

                  <button
                    onClick={handleSubmitReturn}
                    disabled={processing || calculateTotalRefund() <= 0}
                    className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {processing ? 'Processing...' : 'Confirm Supplier Return'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
