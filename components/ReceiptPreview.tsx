'use client'

import { useCurrency } from '@/lib/currency-context'
import type { ReceiptSettings } from '@/lib/types'

interface ReceiptPreviewProps {
  settings: Partial<ReceiptSettings>
}

const SAMPLE_ITEMS = [
  { name: 'Rice Basmati 5kg', quantity: 2, unit_price: 850, subtotal: 1700 },
  { name: 'Cooking Oil 1L', quantity: 1, unit_price: 620, subtotal: 620 },
  { name: 'Sugar 1kg', quantity: 3, unit_price: 140, subtotal: 420 },
  { name: 'Tea Bags (100pc)', quantity: 1, unit_price: 350, subtotal: 350 },
]

export default function ReceiptPreview({ settings }: ReceiptPreviewProps) {
  const { formatCurrency } = useCurrency()

  const subtotal = SAMPLE_ITEMS.reduce((sum, item) => sum + item.subtotal, 0)
  const total = subtotal

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  const isThermal = settings.default_format === 'thermal'
  const paperWidth = settings.thermal_paper_width === '58mm' ? '58mm' : '80mm'

  // Receipt paper dimensions
  const receiptWidth = isThermal
    ? paperWidth === '58mm'
      ? 'w-[220px]'
      : 'w-[300px]'
    : 'w-[360px]'

  const fontSize = isThermal && paperWidth === '58mm' ? 'text-[10px]' : 'text-xs'

  return (
    <div className="p-5 rounded-lg bg-white shadow-sm dark:bg-[#0f0f0f] dark:dark-shadow">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Receipt Preview
      </h2>
      <p className="text-xs mb-4 text-gray-400 dark:text-zinc-500">
        {isThermal ? `Thermal ${paperWidth}` : 'PDF (A4)'} format &mdash; Sample receipt
      </p>

      {/* Receipt paper */}
      <div className="flex justify-center">
        <div
          className={`${receiptWidth} bg-white text-black rounded shadow-lg border border-gray-200 overflow-hidden`}
          style={{
            fontFamily: isThermal ? "'Courier New', Courier, monospace" : "'Inter', Arial, sans-serif",
          }}
        >
          <div className={`p-4 ${isThermal && paperWidth === '58mm' ? 'p-3' : ''}`}>
            {/* Header */}
            <div className="text-center mb-3">
              <h3 className={`font-bold ${isThermal ? 'text-sm' : 'text-base'}`}>
                {settings.business_name || 'Your Store Name'}
              </h3>
              {settings.business_address && (
                <p className={`${fontSize} text-gray-600 mt-0.5`}>{settings.business_address}</p>
              )}
              {settings.business_phone && (
                <p className={`${fontSize} text-gray-600`}>Tel: {settings.business_phone}</p>
              )}
              {settings.business_email && (
                <p className={`${fontSize} text-gray-600`}>{settings.business_email}</p>
              )}
              {settings.show_tax_id && settings.tax_id && (
                <p className={`${fontSize} text-gray-600`}>Tax ID: {settings.tax_id}</p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Sale info */}
            <div className={`${fontSize} text-gray-700 mb-2`}>
              <div className="flex justify-between">
                <span>Receipt #:</span>
                <span>S-000142</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{dateStr}</span>
              </div>
              <div className="flex justify-between">
                <span>Time:</span>
                <span>{timeStr}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>Ahmed</span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Items header */}
            <div className={`${fontSize} font-bold flex justify-between mb-1`}>
              <span className="flex-1">Item</span>
              <span className="w-8 text-center">Qty</span>
              <span className="w-16 text-right">Price</span>
              <span className="w-16 text-right">Total</span>
            </div>

            <div className="border-t border-gray-300 mb-1" />

            {/* Items */}
            {SAMPLE_ITEMS.map((item, i) => (
              <div key={i} className={`${fontSize} flex justify-between py-0.5`}>
                <span className="flex-1 truncate pr-1">{item.name}</span>
                <span className="w-8 text-center">{item.quantity}</span>
                <span className="w-16 text-right">{item.unit_price}</span>
                <span className="w-16 text-right">{item.subtotal}</span>
              </div>
            ))}

            {/* Divider */}
            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Totals */}
            <div className={`${fontSize} space-y-0.5`}>
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount:</span>
                <span>{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm mt-1">
                <span>TOTAL:</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Payment info */}
            <div className={`${fontSize} space-y-0.5`}>
              <div className="flex justify-between">
                <span>Payment:</span>
                <span>Cash</span>
              </div>
              <div className="flex justify-between">
                <span>Paid:</span>
                <span>{formatCurrency(total + 10)}</span>
              </div>
              <div className="flex justify-between">
                <span>Change:</span>
                <span>{formatCurrency(10)}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="font-bold">PAID</span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Footer */}
            <div className="text-center mt-2">
              {settings.thank_you_message && (
                <p className={`${fontSize} font-medium text-gray-700`}>
                  {settings.thank_you_message}
                </p>
              )}
              {settings.return_policy && (
                <p className={`${fontSize} text-gray-500 mt-1`}>
                  {settings.return_policy}
                </p>
              )}
              <p className={`${fontSize} text-gray-400 mt-2`}>
                Powered by Atom
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
