import { NextRequest, NextResponse } from 'next/server'
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

// GET - Fetch returns for a store
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')
    const returnType = searchParams.get('type') // 'customer' or 'supplier'

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('returns')
      .select(`
        *,
        return_items (
          *
        )
      `)
      .eq('store_id', parseInt(storeId))
      .order('created_at', { ascending: false })

    if (returnType) {
      query = query.eq('return_type', returnType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching returns:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error: any) {
    console.error('GET /api/returns error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST - Process a return
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      store_id,
      return_type,
      // Customer return fields
      sale_id,
      customer_name,
      customer_phone,
      // Supplier return fields
      supplier_id,
      supplier_name,
      // Shared
      items, // Array of { product_id, product_name, batch_id, quantity, unit_price, refund_amount, return_price? }
      total_refund_amount,
      refund_method,
      notes,
      recorded_by,
      cashier_id,
    } = body

    const normalizedRefundMethod = refund_method === 'Ledger_Credit'
      ? 'Ledger_Credit'
      : refund_method === 'Digital'
      ? 'Digital'
      : 'Cash'


    // Validation
    if (!store_id || !return_type || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'store_id, return_type, and items are required' },
        { status: 400 }
      )
    }

    if (!['customer', 'supplier'].includes(return_type)) {
      return NextResponse.json(
        { success: false, error: 'return_type must be "customer" or "supplier"' },
        { status: 400 }
      )
    }

    const parsedStoreId = parseInt(String(store_id))

    // ====== CUSTOMER RETURN ======
    if (return_type === 'customer') {
      if (!sale_id) {
        return NextResponse.json(
          { success: false, error: 'sale_id is required for customer returns' },
          { status: 400 }
        )
      }

      // 1. Insert the return record
      const { data: returnRecord, error: returnError } = await supabaseAdmin
        .from('returns')
        .insert({
          store_id: parsedStoreId,
          return_type: 'customer',
          sale_id,
          customer_name: customer_name || null,
          customer_phone: customer_phone || null,
          total_refund_amount: parseFloat(String(total_refund_amount || 0)),
          refund_method: normalizedRefundMethod,
          notes: notes || null,
          recorded_by: recorded_by || null,
          cashier_id: cashier_id ? parseInt(String(cashier_id)) : null,
        })
        .select()
        .single()

      if (returnError) {
        console.error('Error inserting return:', returnError)
        return NextResponse.json(
          { success: false, error: returnError.message },
          { status: 500 }
        )
      }

      // 2. Insert return items and restore stock
      for (const item of items) {
        const { error: itemError } = await supabaseAdmin
          .from('return_items')
          .insert({
            return_id: returnRecord.id,
            product_id: item.product_id,
            product_name: item.product_name,
            batch_id: item.batch_id || null,
            quantity: item.quantity,
            unit_price: parseFloat(String(item.unit_price || 0)),
            refund_amount: parseFloat(String(item.refund_amount || 0)),
          })

        if (itemError) {
          console.error('Error inserting return item:', itemError)
        }

        // 3. Restore stock (to specific batch or latest batch)
        let targetBatchId = item.batch_id
        if (!targetBatchId) {
          const { data: latestBatch } = await supabaseAdmin
            .from('stock_batches')
            .select('id')
            .eq('product_id', item.product_id)
            .eq('store_id', parsedStoreId)
            .order('purchase_date', { ascending: false })
            .limit(1)
            .single()
          
          if (latestBatch) {
            targetBatchId = latestBatch.id
          }
        }

        if (targetBatchId) {
          const { data: batch } = await supabaseAdmin
            .from('stock_batches')
            .select('quantity_remaining, is_depleted')
            .eq('id', targetBatchId)
            .single()

          if (batch) {
            await supabaseAdmin
              .from('stock_batches')
              .update({
                quantity_remaining: batch.quantity_remaining + item.quantity,
                is_depleted: false,
              })
              .eq('id', targetBatchId)
          }
        }

        // Reduce sale_items quantity and subtotal
        const { data: saleItem } = await supabaseAdmin
          .from('sale_items')
          .select('id, quantity, subtotal')
          .eq('sale_id', sale_id)
          .eq('product_id', item.product_id)
          .limit(1)
          .single()

        if (saleItem) {
          const newQty = Math.max(0, saleItem.quantity - item.quantity)
          const newSubtotal = Math.max(0, saleItem.subtotal - item.refund_amount)
          await supabaseAdmin
            .from('sale_items')
            .update({ quantity: newQty, subtotal: newSubtotal })
            .eq('id', saleItem.id)
        }
      }

      // Reduce sales total_amount and recalculate payment fields
      const { data: saleRecord } = await supabaseAdmin
        .from('sales')
        .select('total_amount, amount_paid')
        .eq('id', sale_id)
        .single()

      const refundAmount = parseFloat(String(total_refund_amount || 0))
      const currentSaleTotal = saleRecord ? parseFloat(String(saleRecord.total_amount || 0)) : 0
      const currentAmountPaid = saleRecord ? parseFloat(String(saleRecord.amount_paid || 0)) : 0
      const currentAmountDue = Math.max(0, currentSaleTotal - currentAmountPaid)
      const cashBackForLedgerCredit = normalizedRefundMethod === 'Ledger_Credit'
        ? Math.max(0, refundAmount - currentAmountDue)
        : 0
      const updatedSaleTotal = Math.max(0, currentSaleTotal - refundAmount)
      const updatedAmountPaid = normalizedRefundMethod === 'Ledger_Credit'
        ? Math.max(0, currentAmountPaid - cashBackForLedgerCredit)
        : Math.max(0, currentAmountPaid - refundAmount)
      const updatedAmountDue = Math.max(0, updatedSaleTotal - updatedAmountPaid)
      const updatedPaymentStatus = updatedAmountDue <= 0 ? 'Paid' : 'Partial'

      if (saleRecord) {
        await supabaseAdmin
          .from('sales')
          .update({
            total_amount: updatedSaleTotal,
            amount_paid: updatedAmountPaid,
            amount_due: updatedAmountDue,
            payment_status: updatedPaymentStatus,
          })
          .eq('id', sale_id)
      }

      // 4. Recalculate the linked partial-payment balance so history reflects the net sale after the return.
      const { data: ledgerEntries } = await supabaseAdmin
        .from('partial_payment_customers')
        .select('*')
        .eq('sale_id', sale_id)
        .eq('store_id', parsedStoreId)

      if (ledgerEntries && ledgerEntries.length > 0) {
        const entry = ledgerEntries[0]
        const entryAmountPaid = parseFloat(String(entry.amount_paid || 0))
        const entryCashBackForLedgerCredit = normalizedRefundMethod === 'Ledger_Credit'
          ? Math.max(0, refundAmount - Math.max(0, currentSaleTotal - entryAmountPaid))
          : 0
        const updatedEntryAmountPaid = normalizedRefundMethod === 'Ledger_Credit'
          ? Math.max(0, entryAmountPaid - entryCashBackForLedgerCredit)
          : Math.max(0, entryAmountPaid - refundAmount)
        const nextAmountRemaining = Math.max(0, updatedSaleTotal - updatedEntryAmountPaid)

        await supabaseAdmin
          .from('partial_payment_customers')
          .update({
            total_amount: updatedSaleTotal,
            amount_paid: updatedEntryAmountPaid,
            amount_remaining: nextAmountRemaining,
            updated_at: new Date().toISOString(),
          })
          .eq('id', entry.id)
      } else if (normalizedRefundMethod === 'Ledger_Credit' && (customer_phone || customer_name)) {
        const newAmountPaid = Math.max(0, currentAmountPaid - cashBackForLedgerCredit)
        const createLedgerRecord = {
          sale_id,
          customer_name: customer_name || customer_phone || 'Ledger Credit',
          customer_phone: customer_phone || null,
          total_amount: updatedSaleTotal,
          amount_paid: newAmountPaid,
          amount_remaining: Math.max(0, updatedSaleTotal - newAmountPaid),
          store_id: parsedStoreId,
        }

        const { error: createLedgerError } = await supabaseAdmin
          .from('partial_payment_customers')
          .insert(createLedgerRecord)

        if (createLedgerError) {
          console.error('Error creating customer ledger entry for Ledger_Credit return:', createLedgerError)
        }
      }

      return NextResponse.json({
        success: true,
        data: returnRecord,
        message: 'Customer return processed successfully',
      })
    }

    // ====== SUPPLIER RETURN ======
    if (return_type === 'supplier') {
      if (!supplier_id) {
        return NextResponse.json(
          { success: false, error: 'supplier_id is required for supplier returns' },
          { status: 400 }
        )
      }

      // 1. Insert the return record
      const { data: returnRecord, error: returnError } = await supabaseAdmin
        .from('returns')
        .insert({
          store_id: parsedStoreId,
          return_type: 'supplier',
          supplier_id,
          supplier_name: supplier_name || null,
          total_refund_amount: parseFloat(String(total_refund_amount || 0)),
          refund_method: refund_method || 'Cash',
          notes: notes || null,
          recorded_by: recorded_by || null,
          cashier_id: cashier_id ? parseInt(String(cashier_id)) : null,
        })
        .select()
        .single()

      if (returnError) {
        console.error('Error inserting supplier return:', returnError)
        return NextResponse.json(
          { success: false, error: returnError.message },
          { status: 500 }
        )
      }

      // 2. Insert return items and reduce stock
      for (const item of items) {
        const returnPrice = parseFloat(String(item.return_price || item.unit_price || 0))

        const { error: itemError } = await supabaseAdmin
          .from('return_items')
          .insert({
            return_id: returnRecord.id,
            product_id: item.product_id,
            product_name: item.product_name,
            batch_id: item.batch_id || null,
            quantity: item.quantity,
            unit_price: parseFloat(String(item.unit_price || 0)),
            refund_amount: returnPrice * item.quantity,
            return_price: returnPrice,
          })

        if (itemError) {
          console.error('Error inserting supplier return item:', itemError)
        }

        // 3. Reduce stock from batch and decrease purchased history
        if (item.batch_id) {
          const { data: batch } = await supabaseAdmin
            .from('stock_batches')
            .select('quantity_remaining, quantity_purchased')
            .eq('id', item.batch_id)
            .single()

          if (batch) {
            const newQty = Math.max(0, batch.quantity_remaining - item.quantity)
            const newQtyPurchased = Math.max(0, batch.quantity_purchased - item.quantity)
            await supabaseAdmin
              .from('stock_batches')
              .update({
                quantity_remaining: newQty,
                quantity_purchased: newQtyPurchased,
                is_depleted: newQty <= 0,
                ...(newQty <= 0 ? { depleted_at: new Date().toISOString() } : {}),
              })
              .eq('id', item.batch_id)
          }

          // Decrease the expense linked to this purchase
          const { data: expenseRecords } = await supabaseAdmin
            .from('expenses')
            .select('*')
            .eq('reference_id', item.batch_id)
            .in('category', ['new_product', 'inventory_restock'])
          
          if (expenseRecords && expenseRecords.length > 0) {
            const expense = expenseRecords[0]
            await supabaseAdmin
              .from('expenses')
              .update({
                amount: Math.max(0, expense.amount - item.refund_amount)
              })
              .eq('id', expense.id)
          }
        }
      }

      // 4. If refund reduces supplier debt, update supplier_khaata
      if (refund_method === 'Ledger_Credit') {
        // Find open khaata records for this supplier and reduce debt
        const { data: khaataRecords } = await supabaseAdmin
          .from('supplier_khaata')
          .select('*')
          .eq('supplier_id', supplier_id)
          .eq('store_id', parsedStoreId)
          .gt('amount_remaining', 0)
          .order('created_at', { ascending: true })

        if (khaataRecords && khaataRecords.length > 0) {
          let remainingCredit = parseFloat(String(total_refund_amount || 0))

          for (const record of khaataRecords) {
            if (remainingCredit <= 0) break

            const reduction = Math.min(remainingCredit, record.amount_remaining)
            await supabaseAdmin
              .from('supplier_khaata')
              .update({
                amount_remaining: record.amount_remaining - reduction,
                amount_paid: record.amount_paid + reduction,
                updated_at: new Date().toISOString(),
              })
              .eq('id', record.id)

            remainingCredit -= reduction
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: returnRecord,
        message: 'Supplier return processed successfully',
      })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid return type' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('POST /api/returns error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Delete a return record
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const returnId = searchParams.get('id')

    if (!returnId) {
      return NextResponse.json(
        { success: false, error: 'Return ID is required' },
        { status: 400 }
      )
    }

    // return_items cascade on delete, so just delete the return
    const { error } = await supabaseAdmin
      .from('returns')
      .delete()
      .eq('id', parseInt(returnId))

    if (error) {
      console.error('Error deleting return:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Return deleted successfully',
    })
  } catch (error: any) {
    console.error('DELETE /api/returns error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
