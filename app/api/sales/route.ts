import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const cashierId = searchParams.get('cashier_id')

    let query = supabase
      .from('sales')
      .select(`
        *,
        users:cashier_id (full_name),
        sale_items (
          *,
          products (name, sku)
        )
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
    const body = await request.json()
    const { items, payment_method, amount_paid, notes, cashier_id } = body

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

    // Fetch product details and calculate total
    let totalAmount = 0
    const saleItems = []

    for (const item of items) {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.product_id)
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

      // Check stock availability
      if (product.stock_quantity < item.quantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}`,
            code: 'INSUFFICIENT_STOCK',
          },
          { status: 400 }
        )
      }

      const subtotal = product.price * item.quantity
      totalAmount += subtotal

      saleItems.push({
        product_id: product.id,
        quantity: item.quantity,
        unit_price: product.price,
        subtotal,
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

    // Create sale items and update stock
    for (const saleItem of saleItems) {
      // Insert sale item
      const { error: itemError } = await supabase
        .from('sale_items')
        .insert([
          {
            ...saleItem,
            sale_id: sale.id,
          },
        ])

      if (itemError) throw itemError

      // Update product stock
      // First get current stock
      const { data: currentProduct } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', saleItem.product_id)
        .single()

      if (currentProduct) {
        const newStock = currentProduct.stock_quantity - saleItem.quantity
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', saleItem.product_id)

        if (updateError) throw updateError
      }
    }

    // Fetch complete sale data with items
    const { data: completeSale, error: fetchError } = await supabase
      .from('sales')
      .select(`
        *,
        users:cashier_id (full_name),
        sale_items (
          *,
          products (name, sku)
        )
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
