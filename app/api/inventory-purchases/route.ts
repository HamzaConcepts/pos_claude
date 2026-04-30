import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Create admin client to bypass RLS
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

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Fetch ONLY inventory-related expenses (new_product and inventory_restock)
    const { data, error } = await supabaseAdmin
      .from('expenses')
      .select('*')
      .eq('store_id', parseInt(storeId))
      .in('category', ['new_product', 'inventory_restock'])
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching inventory purchases:', error)
      throw error
    }

    // Build a due map from stock batches and supplier khaata entries.
    // expense.reference_id points to stock_batches.id for inventory purchases.
    const stockBatchIds = [...new Set((data || []).map((expense: any) => expense.reference_id).filter(Boolean))]
    const batchById = new Map<number, any>()
    const dueByBatchId = new Map<number, { total_amount: number; amount_paid: number; amount_remaining: number }>()

    if (stockBatchIds.length > 0) {
      const { data: batches, error: batchesError } = await supabaseAdmin
        .from('stock_batches')
        .select(`
          id,
          product_id,
          batch_number,
          cost_price,
          selling_price,
          lowest_negotiable_price,
          quantity_purchased,
          quantity_remaining,
          purchase_date,
          amount_paid,
          products (id, name, sku, description, low_stock_threshold)
        `)
        .in('id', stockBatchIds)

      if (!batchesError && batches) {
        batches.forEach((batch: any) => {
          batchById.set(batch.id, batch)
        })
      }

      const { data: supplierKhaataRows, error: khaataError } = await supabaseAdmin
        .from('supplier_khaata')
        .select('stock_batch_id, total_amount, amount_paid, amount_remaining')
        .eq('store_id', parseInt(storeId))
        .in('stock_batch_id', stockBatchIds)

      if (!khaataError && supplierKhaataRows) {
        supplierKhaataRows.forEach((row: any) => {
          dueByBatchId.set(row.stock_batch_id, {
            total_amount: Number(row.total_amount || 0),
            amount_paid: Number(row.amount_paid || 0),
            amount_remaining: Number(row.amount_remaining || 0),
          })
        })
      }
    }

    // Fetch recorder names separately
    if (data && data.length > 0) {
      const managerIds = [...new Set(data.map(e => e.recorded_by).filter(Boolean))]
      const cashierAccountIds = [...new Set(data.map(e => e.recorded_by_cashier_id).filter(Boolean))]
      const cashierRefIds = [...new Set(data.map(e => e.cashier_ref_id).filter(Boolean))]
      
      const nameMap = new Map()
      
      // Fetch managers
      if (managerIds.length > 0) {
        const { data: managers } = await supabaseAdmin
          .from('managers')
          .select('id, full_name')
          .in('id', managerIds)
        
        managers?.forEach(m => nameMap.set(`manager_${m.id}`, m.full_name))
      }
      
      // Fetch cashier accounts
      if (cashierAccountIds.length > 0) {
        const { data: cashierAccounts } = await supabaseAdmin
          .from('cashier_accounts')
          .select('id, full_name')
          .in('id', cashierAccountIds)
        
        cashierAccounts?.forEach(c => nameMap.set(`cashier_account_${c.id}`, c.full_name))
      }
      
      // Fetch cashiers (staff members from cashiers table)
      if (cashierRefIds.length > 0) {
        const { data: cashiers } = await supabaseAdmin
          .from('cashiers')
          .select('id, full_name')
          .in('id', cashierRefIds)
        
        cashiers?.forEach(c => nameMap.set(`cashier_${c.id}`, c.full_name))
      }
      
      // Add recorder names and due fields to expenses
      data.forEach(expense => {
        if (expense.cashier_ref_id) {
          expense.recorded_by_name = nameMap.get(`cashier_${expense.cashier_ref_id}`) || 'Unknown'
        } else if (expense.recorded_by) {
          expense.recorded_by_name = nameMap.get(`manager_${expense.recorded_by}`) || 'Unknown'
        } else if (expense.recorded_by_cashier_id) {
          expense.recorded_by_name = nameMap.get(`cashier_account_${expense.recorded_by_cashier_id}`) || 'Unknown'
        }

        const batchId = expense.reference_id
        const batch = batchById.get(batchId)
        const mappedKhaata = dueByBatchId.get(batchId)

        const fallbackTotal = Number(expense.amount || 0)
        const fallbackPaid = batch ? Number(batch.amount_paid || fallbackTotal) : fallbackTotal
        const fallbackRemaining = Math.max(0, fallbackTotal - fallbackPaid)

        expense.total_amount = mappedKhaata ? mappedKhaata.total_amount : fallbackTotal
        expense.amount_paid = mappedKhaata ? mappedKhaata.amount_paid : fallbackPaid
        expense.amount_remaining = mappedKhaata ? mappedKhaata.amount_remaining : fallbackRemaining

        if (batch) {
          expense.product_id = batch.product_id
          expense.batch_number = batch.batch_number
          expense.cost_price = batch.cost_price
          expense.selling_price = batch.selling_price
          expense.lowest_negotiable_price = batch.lowest_negotiable_price
          expense.quantity_purchased = batch.quantity_purchased
          expense.quantity_remaining = batch.quantity_remaining
          expense.batch_purchase_date = batch.purchase_date

          const product = batch.products
          expense.product_name = product?.name
          expense.product_sku = product?.sku
          expense.product_description = product?.description
          expense.low_stock_threshold = product?.low_stock_threshold

          if (!expense.product_display && product?.name) {
            expense.product_display = product.sku ? `${product.name} (${product.sku})` : product.name
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    })
  } catch (error: any) {
    console.error('Inventory purchases API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inventory purchases' },
      { status: 500 }
    )
  }
}
