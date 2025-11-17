import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const cashierId = searchParams.get('cashier_id')

    let query = supabase
      .from('sales')
      .select(`
        *,
        users:cashier_id (full_name),
        sale_items (*)
      `)
      .order('sale_date', { ascending: false })

    if (startDate) {
      query = query.gte('sale_date', startDate)
    }

    if (endDate) {
      query = query.lte('sale_date', endDate)
    }

    if (cashierId) {
      query = query.eq('cashier_id', cashierId)
    }

    const { data: sales, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: sales || [],
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch sales',
        code: 'FETCH_SALES_ERROR',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const body = await request.json()
    const { items, sale_description, payment_method, amount_paid, notes, cashier_id } = body

    // Validation
    if (!items || items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cart is empty',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (!payment_method || !['Cash', 'Digital'].includes(payment_method)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payment method',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    // Fetch product details with inventory and calculate total
    let totalAmount = 0
    const saleItems = []

    for (const item of items) {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select(`
          *,
          inventory (
            id,
            cost_price,
            selling_price,
            quantity_remaining
          )
        `)
        .eq('id', item.product_id)
        .eq('is_active', true)
        .single()

      if (productError || !product) {
        return NextResponse.json(
          {
            success: false,
            error: `Product not found: ${item.product_id}`,
            code: 'PRODUCT_NOT_FOUND',
          },
          { status: 404 }
        )
      }

      // Calculate total stock
      const totalStock = product.inventory?.reduce(
        (sum: number, inv: any) => sum + (inv.quantity_remaining || 0),
        0
      ) || 0

      // Check stock availability
      if (totalStock < item.quantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient stock for ${product.name}. Available: ${totalStock}`,
            code: 'INSUFFICIENT_STOCK',
          },
          { status: 400 }
        )
      }

      const latestInventory = product.inventory?.[0]
      const sellingPrice = latestInventory?.selling_price || 0
      const costPrice = latestInventory?.cost_price || 0
      const subtotal = sellingPrice * item.quantity
      totalAmount += subtotal

      saleItems.push({
        product_id: product.id,
        product_sku: product.sku,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: sellingPrice,
        cost_price_snapshot: costPrice,
        subtotal,
        inventoryToUpdate: product.inventory,
      })
    }

    const paidAmount = amount_paid || 0
    const dueAmount = totalAmount - paidAmount
    const paymentStatus =
      dueAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending'

    // Generate sale number
    const saleNumber = `SALE-${Date.now()}`

    // Create sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([
        {
          sale_number: saleNumber,
          sale_description: sale_description || null,
          cashier_id: cashier_id,
          total_amount: totalAmount,
          payment_method,
          payment_status: paymentStatus,
          amount_paid: paidAmount,
          amount_due: dueAmount > 0 ? dueAmount : 0,
          notes,
        },
      ])
      .select()
      .single()

    if (saleError) throw saleError

    // Create sale items and update inventory
    for (const saleItem of saleItems) {
      // Insert sale item (with snapshots)
      const { error: itemError } = await supabase
        .from('sale_items')
        .insert([
          {
            sale_id: sale.id,
            product_id: saleItem.product_id,
            product_sku: saleItem.product_sku,
            product_name: saleItem.product_name,
            quantity: saleItem.quantity,
            unit_price: saleItem.unit_price,
            cost_price_snapshot: saleItem.cost_price_snapshot,
            subtotal: saleItem.subtotal,
          },
        ])

      if (itemError) throw itemError

      // Update inventory stock (FIFO - First In, First Out)
      let remainingQuantity = saleItem.quantity
      const inventories = saleItem.inventoryToUpdate || []

      for (const inv of inventories) {
        if (remainingQuantity <= 0) break

        const deductQuantity = Math.min(inv.quantity_remaining, remainingQuantity)
        const newQuantity = inv.quantity_remaining - deductQuantity

        const { error: updateError } = await supabase
          .from('inventory')
          .update({ quantity_remaining: newQuantity })
          .eq('id', inv.id)

        if (updateError) throw updateError

        remainingQuantity -= deductQuantity
      }
    }

    // Fetch complete sale data with items
    const { data: completeSale, error: fetchError } = await supabase
      .from('sales')
      .select(`
        *,
        users:cashier_id (full_name),
        sale_items (*)
      `)
      .eq('id', sale.id)
      .single()

    if (fetchError) throw fetchError

    return NextResponse.json({
      success: true,
      data: completeSale,
      message: 'Sale completed successfully',
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create sale',
        code: 'CREATE_SALE_ERROR',
      },
      { status: 500 }
    )
  }
}
