'use client'

import { useState, useEffect } from 'react'
import { MagnifyingGlass, X, Plus, Trash } from '@phosphor-icons/react'
import { getStoreId, isManager } from '@/lib/supabase'
import { useCurrency } from '@/lib/currency-context'
import { printPDFReceipt, printThermalReceipt } from '@/lib/receipt-generator'

export default function CustomerReturnsTab() {
  const { currency, formatCurrency } = useCurrency()
  const [view, setView] = useState<'list' | 'create'>('list')
  const [isManagerUser, setIsManagerUser] = useState(false)

  // -- HISTORY STATE --
  const [returns, setReturns] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historySearch, setHistorySearch] = useState('')
  const [historyError, setHistoryError] = useState('')

  // -- CREATE RETURN STATE --
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [allSales, setAllSales] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [selectedSale, setSelectedSale] = useState<any | null>(null)
  const [error, setError] = useState('')
  const [returnItems, setReturnItems] = useState<{ [key: number]: number }>({})
  const [refundMethod, setRefundMethod] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    checkRole()
    fetchHistory()
    fetchAllSales()
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

      const res = await fetch(`/api/returns?store_id=${storeId}&type=customer`)
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

  const fetchAllSales = async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return
      const res = await fetch(`/api/sales?store_id=${storeId}`)
      const result = await res.json()
      if (result.success) {
        setAllSales(result.data)
      }
    } catch (err) {
      console.error('Error fetching sales:', err)
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

  // Filter sales locally as user types
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSales([])
      setError('')
      return
    }

    setError('')
    const query = searchQuery.toLowerCase()
    const filtered = allSales.filter((s: any) => 
      s.sale_number?.toLowerCase().includes(query) ||
      s.id.toString() === query ||
      s.sale_description?.toLowerCase().includes(query)
    )
    
    setSales(filtered)
    if (filtered.length === 0) {
      setError('No sales found matching your search.')
    }
  }

  useEffect(() => {
    handleSearch()
  }, [searchQuery, allSales])

  const handleSelectSale = async (saleId: number) => {
    try {
      setSearching(true)
      const res = await fetch(`/api/sales/${saleId}`)
      const result = await res.json()
      if (result.success) {
        setSelectedSale(result.data)
        setReturnItems({})
      }
    } catch (err) {
      setError('Failed to load sale details')
    } finally {
      setSearching(false)
    }
  }

  const handleQtyChange = (itemId: number, qty: number, maxQty: number) => {
    if (qty < 0) qty = 0
    if (qty > maxQty) qty = maxQty
    
    setReturnItems(prev => ({
      ...prev,
      [itemId]: qty
    }))
  }

  const calculateTotalRefund = () => {
    if (!selectedSale) return 0
    let total = 0
    selectedSale.sale_items.forEach((item: any) => {
      const returnQty = returnItems[item.id] || 0
      total += returnQty * item.unit_price
    })
    return total
  }

  const handleSubmitReturn = async () => {
    const totalRefund = calculateTotalRefund()
    if (totalRefund <= 0) {
      setError('Please select at least one item to return.')
      return
    }

    setProcessing(true)
    setError('')

    try {
      const storeId = getStoreId()
      const cashierId = typeof window !== 'undefined' ? sessionStorage.getItem('user_id') : null

      const itemsToReturn = selectedSale.sale_items
        .filter((item: any) => returnItems[item.id] > 0)
        .map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name || item.products?.name,
          batch_id: item.stock_batch_id,
          quantity: returnItems[item.id],
          unit_price: item.unit_price,
          refund_amount: returnItems[item.id] * item.unit_price
        }))

      const payload = {
        store_id: storeId,
        return_type: 'customer',
        sale_id: selectedSale.id,
        customer_name: selectedSale.sale_description,
        total_refund_amount: totalRefund,
        refund_method: refundMethod,
        notes: notes,
        cashier_id: cashierId,
        items: itemsToReturn
      }

      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await res.json()

      if (result.success) {
        if (confirm('Return processed successfully! Stock has been restored. Do you want to print the updated receipt for this sale?')) {
          try {
            const receiptRes = await fetch(`/api/receipts/${selectedSale.id}`)
            const receiptData = await receiptRes.json()
            if (receiptData.success) {
              const format = receiptData.settings?.default_format || 'pdf'
              if (format === 'pdf') {
                await printPDFReceipt(receiptData.data)
              } else {
                printThermalReceipt(receiptData.data, {
                  paperWidth: receiptData.settings?.thermal_paper_width,
                })
              }
            } else {
              alert('Failed to load receipt data.')
            }
          } catch (err) {
            console.error('Print error:', err)
            alert('Failed to print receipt.')
          }
        }
        setSelectedSale(null)
        setReturnItems({})
        setSearchQuery('')
        setSales([])
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
      (r.customer_name && r.customer_name.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <div className="animate-fadeIn">
          <div className="flex justify-between items-center gap-4 flex-wrap mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Customer Returns</h3>
            
            <div className="flex items-center gap-4 flex-1 justify-end">
              <div className="relative max-w-sm w-full">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search returns..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm"
                />
              </div>
              <button
                onClick={() => setView('create')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 whitespace-nowrap font-medium"
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
              No customer return records found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-[#111] text-gray-600 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer</th>
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
                        {r.customer_name || 'Walk-in'}
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
        <div className="animate-fadeIn">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create Customer Return</h3>
            <button
              onClick={() => {
                setView('list')
                setSelectedSale(null)
                setReturnItems({})
              }}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium"
            >
              Back to History
            </button>
          </div>

          {/* Search Section */}
          {!selectedSale && (
            <div className="max-w-2xl mx-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by Sale # or Customer Name..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <MagnifyingGlass size={20} />
                </button>
              </div>
              
              {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}

              {sales.length > 0 && (
                <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {sales.map(s => (
                    <div key={s.id} className="p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{s.sale_number}</p>
                        <p className="text-sm text-gray-500">{s.sale_description || 'Walk-in Customer'}</p>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(s.total_amount, 2)}</p>
                          <p className="text-xs text-gray-500">{new Date(s.sale_date).toLocaleDateString()}</p>
                        </div>
                        <button
                          onClick={() => handleSelectSale(s.id)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-100 transition-colors text-sm font-medium"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Process Return Section */}
          {selectedSale && (
            <div className="animate-fadeIn">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Sale #{selectedSale.sale_number}</h3>
                  <p className="text-gray-500">{selectedSale.sale_description || 'Walk-in Customer'} • {new Date(selectedSale.sale_date).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="bg-gray-50 dark:bg-[#111] rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Items Sold</h4>
                <div className="space-y-3">
                  {selectedSale.sale_items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-white dark:bg-[#1a1a1a] rounded border border-gray-200 dark:border-gray-700">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{item.product_name || item.products?.name}</p>
                        <p className="text-sm text-gray-500">Qty Sold: {item.quantity} @ {formatCurrency(item.unit_price, 2)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Return Qty:</span>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={returnItems[item.id] || 0}
                          onChange={(e) => handleQtyChange(item.id, parseInt(e.target.value) || 0, item.quantity)}
                          className="w-20 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Refund Method</label>
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                    >
                      <option value="Cash">Cash Refund</option>
                      <option value="Ledger_Credit">Credit to Ledger Balance</option>
                      <option value="Digital">Digital Refund</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Return Reason / Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                      rows={3}
                      placeholder="Why is the customer returning this?"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-100 dark:border-blue-800 flex flex-col justify-center">
                  <p className="text-blue-800 dark:text-blue-300 text-lg mb-2">Total Refund Amount</p>
                  <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-6">
                    {formatCurrency(calculateTotalRefund(), 2)}
                  </p>

                  {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}

                  <button
                    onClick={handleSubmitReturn}
                    disabled={processing || calculateTotalRefund() <= 0}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {processing ? 'Processing...' : 'Process Return & Restore Stock'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
