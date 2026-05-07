import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')
    const includeInitialParam = searchParams.get('include_initial')
    const includeInitial = includeInitialParam ? includeInitialParam === 'true' : true

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    const { data: rows, error } = await supabaseAdmin
      .from('inventory_purchases_view')
      .select(`
        id,
        store_id,
        product_id,
        batch_number,
        quantity_purchased,
        purchase_date,
        payment_method,
        is_initial_stock,
        purchase_type,
        created_at,
        product_name,
        product_sku,
        product_description,
        supplier_name,
        supplier_phone,
        recorded_by_name,
        total_amount,
        amount_paid,
        amount_remaining,
        cash_paid,
        digital_paid
      `)
      .eq('store_id', parseInt(storeId))
      .order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching inventory purchases:', error)
      throw error
    }

    const batchIds = (rows || [])
      .map((row: any) => Number(row.id))
      .filter((id: number) => Number.isFinite(id))

    const bankAccountsByBatch = new Map<number, Set<string>>()

    if (batchIds.length > 0) {
      const { data: paymentRows, error: paymentError } = await supabaseAdmin
        .from('inventory_purchase_payments')
        .select('stock_batch_id, payment_method, bank_account_name')
        .eq('store_id', parseInt(storeId))
        .in('stock_batch_id', batchIds)

      if (paymentError) {
        console.error('Error fetching inventory purchase payments:', paymentError)
      } else {
        ;(paymentRows || []).forEach((payment: any) => {
          if (payment.payment_method !== 'Digital') return
          if (typeof payment.bank_account_name !== 'string') return

          const bankName = payment.bank_account_name.trim()
          if (!bankName) return

          const batchId = Number(payment.stock_batch_id)
          if (!Number.isFinite(batchId)) return

          const bankSet = bankAccountsByBatch.get(batchId) || new Set<string>()
          bankSet.add(bankName)
          bankAccountsByBatch.set(batchId, bankSet)
        })
      }
    }

    const earliestBatchByProduct = new Map<number, { id: number; purchase_date: string | null }>()
    ;(rows || []).forEach((row: any) => {
      const productId = Number(row.product_id)
      if (!Number.isInteger(productId)) return

      const existing = earliestBatchByProduct.get(productId)
      const rowDate = row.purchase_date ? new Date(row.purchase_date).getTime() : Number.POSITIVE_INFINITY
      const existingDate = existing?.purchase_date ? new Date(existing.purchase_date).getTime() : Number.POSITIVE_INFINITY

      if (!existing || rowDate < existingDate || (rowDate === existingDate && row.id < existing.id)) {
        earliestBatchByProduct.set(productId, {
          id: row.id,
          purchase_date: row.purchase_date || null,
        })
      }
    })

    const purchases = (rows || [])
      .map((row: any) => {
        const productName = row.product_name || 'Unknown Product'
        const batchNumber = row.batch_number || 'N/A'
        const totalAmount = Number(row.total_amount || 0)
        const amountPaid = Number(row.amount_paid || 0)
        const amountRemaining = Number(row.amount_remaining || 0)
        const cashPaid = Number(row.cash_paid || 0)
        const digitalPaid = Number(row.digital_paid || 0)

        const earliest = earliestBatchByProduct.get(Number(row.product_id))
        const isFirstBatch = Boolean(earliest && earliest.id === row.id)
        const fallbackCategory = row.is_initial_stock
          ? 'initial_stock'
          : isFirstBatch
            ? 'new_product'
            : 'inventory_restock'
        const category = row.purchase_type || fallbackCategory

        const description = category === 'initial_stock'
          ? `Initial Stock: ${productName} (Qty: ${row.quantity_purchased || 0})`
          : category === 'new_product'
            ? `New Product: ${productName} (Qty: ${row.quantity_purchased || 0})`
            : `Restock: ${productName} - Batch #${batchNumber} (Qty: ${row.quantity_purchased || 0})`

        const bankAccounts = bankAccountsByBatch.get(Number(row.id))

        return {
          id: row.id,
          description,
          amount: totalAmount,
          total_amount: totalAmount,
          amount_paid: amountPaid,
          amount_remaining: amountRemaining,
          cash_paid: cashPaid,
          digital_paid: digitalPaid,
          digital_bank_accounts: bankAccounts ? Array.from(bankAccounts) : [],
          category,
          payment_method: row.payment_method || null,
          expense_date: row.purchase_date,
          recorded_by_name: row.recorded_by_name || 'System',
          product_display: row.product_name ? (row.product_sku ? `${row.product_name} (${row.product_sku})` : row.product_name) : null,
          supplier_name: row.supplier_name || null,
          created_at: row.created_at,
        }
      })
      .filter((purchase: any) => includeInitial || purchase.category !== 'initial_stock')

    return NextResponse.json({
      success: true,
      data: purchases,
    })
  } catch (error: any) {
    console.error('Inventory purchases API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inventory purchases' },
      { status: 500 }
    )
  }
}
