'use client'

import { useEffect, useState } from 'react'
import { Calendar, User, DollarSign, CreditCard } from 'lucide-react'


export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
                {sales.map((sale, index) => (
                  <tr
                    key={sale.id}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-bg-secondary'}
                  >
                    <td className="px-4 py-3 font-mono text-sm">{sale.sale_number}</td>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )


}
