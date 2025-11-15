'use client'

import { useEffect, useState } from 'react'
import { Calendar, User, DollarSign, CreditCard, ChevronDown, ChevronUp, Package } from 'lucide-react'


export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null)

  useEffect(() => {
    fetchSales()
  }, [])

  const fetchSales = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sales')
      const result = await response.json()

      if (result.success) {
        setSales(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to fetch sales')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Loading sales...</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Sales History</h1>

      {error && (
        <div className="mb-4 p-4 bg-status-error text-white rounded">
          {error}
        </div>
      )}

      {sales.length === 0 ? (
        <div className="bg-white p-8 rounded border-2 border-black text-center">
          <p className="text-text-secondary">No sales found</p>
        </div>
      ) : (
        <div className="bg-white rounded border-2 border-black overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-black text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Sale #</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Cashier</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Payment</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale, index) => {
                  const isExpanded = expandedSaleId === sale.id
                  const totalCost = sale.sale_items?.reduce(
                    (sum: number, item: any) => sum + (item.cost_price_snapshot || 0) * item.quantity,
                    0
                  ) || 0
                  const profit = sale.total_amount - totalCost

                  return (
                    <>
                      <tr
                        key={sale.id}
                        onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                        className={`cursor-pointer transition-all ${
                          index % 2 === 0 ? 'bg-white' : 'bg-bg-secondary'
                        } ${isExpanded ? 'border-l-4 border-black' : ''} hover:bg-gray-50`}
                      >
                        <td className="px-4 py-3 font-mono text-sm">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            {sale.sale_number}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {new Date(sale.sale_date).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3">{sale.users?.full_name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          ${sale.total_amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-bg-secondary rounded text-sm">
                            {sale.payment_method === 'Cash' ? (
                              <DollarSign size={14} />
                            ) : (
                              <CreditCard size={14} />
                            )}
                            {sale.payment_method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              sale.payment_status === 'Paid'
                                ? 'bg-black text-white'
                                : sale.payment_status === 'Partial'
                                ? 'bg-status-warning text-white'
                                : 'bg-status-error text-white'
                            }`}
                          >
                            {sale.payment_status}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${sale.id}-details`} className="animate-fadeIn">
                          <td colSpan={6} className={index % 2 === 0 ? 'bg-white' : 'bg-bg-secondary'}>
                            <div className="px-4 py-4 border-t-2 border-gray-200">
                              {/* Sale Summary */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="p-3 border-2 border-black rounded">
                                  <div className="text-xs text-text-secondary mb-1">Sale Date</div>
                                  <div className="font-bold">
                                    {new Date(sale.sale_date).toLocaleString('en-US', {
                                      month: 'long',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                </div>
                                <div className="p-3 border-2 border-black rounded">
                                  <div className="text-xs text-text-secondary mb-1">Cashier</div>
                                  <div className="font-bold">{sale.users?.full_name || 'Unknown'}</div>
                                </div>
                                <div className="p-3 border-2 border-black rounded">
                                  <div className="text-xs text-text-secondary mb-1">Amount Paid</div>
                                  <div className="font-bold">${sale.amount_paid?.toFixed(2) || '0.00'}</div>
                                </div>
                                <div className="p-3 border-2 border-black rounded">
                                  <div className="text-xs text-text-secondary mb-1">Profit</div>
                                  <div className={`font-bold ${profit >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                                    ${profit.toFixed(2)}
                                  </div>
                                </div>
                              </div>

                              {/* Sale Items */}
                              <div className="mb-3">
                                <div className="flex items-center gap-2 text-sm font-bold mb-2">
                                  <Package size={16} />
                                  Sale Items ({sale.sale_items?.length || 0})
                                </div>
                                <div className="border-2 border-black rounded overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left">SKU</th>
                                        <th className="px-3 py-2 text-left">Product</th>
                                        <th className="px-3 py-2 text-center">Qty</th>
                                        <th className="px-3 py-2 text-right">Unit Price</th>
                                        <th className="px-3 py-2 text-right">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sale.sale_items?.map((item: any, idx: number) => (
                                        <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                          <td className="px-3 py-2 font-mono text-xs">{item.product_sku || 'N/A'}</td>
                                          <td className="px-3 py-2">{item.product_name || 'Unknown Product'}</td>
                                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                                          <td className="px-3 py-2 text-right">${item.unit_price.toFixed(2)}</td>
                                          <td className="px-3 py-2 text-right font-bold">${item.subtotal.toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="bg-black text-white">
                                      <tr>
                                        <td colSpan={4} className="px-3 py-2 text-right font-bold">Total:</td>
                                        <td className="px-3 py-2 text-right font-bold">${sale.total_amount.toFixed(2)}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>

                              {/* Notes */}
                              {sale.notes && (
                                <div className="text-sm">
                                  <div className="font-bold mb-1">Notes:</div>
                                  <div className="text-text-secondary italic">{sale.notes}</div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )


}
