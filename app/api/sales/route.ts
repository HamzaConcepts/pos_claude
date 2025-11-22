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
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const cashierId = searchParams.get('cashier_id')
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    let query = supabaseAdmin
      .from('sales')
      .select(`
        *,
        sale_items (*),
        partial_payment_customers (*),
        payments (*)
      `)
      .eq('store_id', parseInt(storeId))
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

    if (error) {
      console.error('Error fetching sales:', error)
      throw error
    }

    // Fetch cashier names separately if needed
    if (sales && sales.length > 0) {
      const allCashierIds = [...new Set(sales.map(s => s.cashier_id).filter(Boolean))]
      
      // Separate UUIDs (managers) from integers (cashiers)
      const managerCashierIds = allCashierIds.filter(id => typeof id === 'string' && id.includes('-'))
      const cashierAccountIds = allCashierIds.filter(id => typeof id === 'number' || (typeof id === 'string' && !id.includes('-')))
      
      const cashierNameMap = new Map()
      
      // Fetch manager names
      if (managerCashierIds.length > 0) {
        const { data: managers } = await supabaseAdmin
          .from('managers')
          .select('id, full_name')
          .in('id', managerCashierIds)
        
        managers?.forEach(m => cashierNameMap.set(m.id, m.full_name))
      }
      
      // Fetch cashier names
      if (cashierAccountIds.length > 0) {
        const { data: cashiers } = await supabaseAdmin
          .from('cashier_accounts')
          .select('id, full_name')
          .in('id', cashierAccountIds)
        
        cashiers?.forEach(c => cashierNameMap.set(c.id, c.full_name))
      }
      
      // Add cashier names to sales
      sales.forEach(sale => {
        if (sale.cashier_id) {
          sale.cashier_name = cashierNameMap.get(sale.cashier_id) || 'Unknown'
        }
      })
      
      // Fetch payment recorder names (can be manager UUID or cashier ID)
      const allPayments = sales.flatMap(s => s.payments || [])
      const managerIds = [...new Set(allPayments.map(p => p.manager_id).filter(Boolean))]
      const paymentCashierIds = [...new Set(allPayments.map(p => p.cashier_id).filter(Boolean))]
      
      let managerMap = new Map()
      let paymentCashierMap = new Map()
      
      // Fetch managers
      if (managerIds.length > 0) {
        const { data: managers } = await supabaseAdmin
          .from('managers')
          .select('id, full_name')
          .in('id', managerIds)
        
        managerMap = new Map(managers?.map(m => [m.id, m.full_name]) || [])
      }
      
      // Fetch cashiers for payments
      if (paymentCashierIds.length > 0) {
        const { data: cashiers } = await supabaseAdmin
          .from('cashier_accounts')
          .select('id, full_name')
          .in('id', paymentCashierIds)
        
        paymentCashierMap = new Map(cashiers?.map(c => [c.id, c.full_name]) || [])
      }
      
      // Add recorder names to payments
      sales.forEach(sale => {
        if (sale.payments) {
          sale.payments.forEach((payment: any) => {
            if (payment.manager_id) {
              payment.recorded_by_name = managerMap.get(payment.manager_id) || 'Unknown'
            } else if (payment.cashier_id) {
              payment.recorded_by_name = paymentCashierMap.get(payment.cashier_id) || 'Unknown'
            }
          })
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: sales || [],
    })
  } catch (error: any) {
    console.error('Sales API error:', error)
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
    const { 
      items, 
      sale_description, 
      payment_method, 
      amount_paid, 
      notes, 
      cashier_id,
      partial_payment_customer, // New field for partial payment customer info
      store_id,
      discount_type,
      discount_value
    } = body

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

    if (!store_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Store ID is required',
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
      const { data: product, error: productError } = await supabaseAdmin
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

    // Calculate discount
    let discountAmount = 0
    if (discount_value && discount_value > 0) {
      if (discount_type === 'percentage') {
        discountAmount = (totalAmount * discount_value) / 100
      } else if (discount_type === 'amount') {
        discountAmount = Math.min(discount_value, totalAmount)
      }
    }

    // Apply discount to total
    totalAmount = totalAmount - discountAmount

    const paidAmount = amount_paid || 0
    const dueAmount = totalAmount - paidAmount
    const paymentStatus =
      dueAmount <= 0 ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending'

    // Validate partial payment customer info
    if (paymentStatus === 'Partial' && !partial_payment_customer) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer information required for partial payment',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (partial_payment_customer) {
      const { customer_name, customer_cnic, customer_phone } = partial_payment_customer
      if (!customer_name || !customer_cnic || !customer_phone) {
        return NextResponse.json(
          {
            success: false,
            error: 'Customer name, CNIC, and phone are required for partial payment',
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }
    }

    // Generate sale number
    const saleNumber = `SALE-${Date.now()}`

    // Create sale
    const { data: sale, error: saleError } = await supabaseAdmin
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
          store_id: parseInt(store_id),
          notes,
          discount_type: discount_type || 'none',
          discount_value: discount_value || 0,
        },
      ])
      .select()
      .single()

    if (saleError) throw saleError

    // Create payment record (track all payments)
    if (paidAmount > 0) {
      // Determine if cashier_id is a UUID (manager) or integer (cashier)
      const isUUID = typeof cashier_id === 'string' && cashier_id.includes('-')
      
      const paymentData: any = {
        sale_id: sale.id,
        amount: paidAmount,
        payment_method,
        payment_date: new Date().toISOString(),
        store_id: parseInt(store_id),
      }
      
      // Insert into correct column based on ID type
      if (isUUID) {
        paymentData.manager_id = cashier_id  // Manager UUID
      } else {
        paymentData.cashier_id = cashier_id  // Cashier integer ID
      }
      
      const { error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert([paymentData])

      if (paymentError) {
        console.error('Error creating payment record:', paymentError)
        throw paymentError
      }
    }

    // Create partial payment customer record if applicable
    if (paymentStatus === 'Partial' && partial_payment_customer) {
      const { customer_name, customer_cnic, customer_phone } = partial_payment_customer
      
      const { error: partialPaymentError } = await supabaseAdmin
        .from('partial_payment_customers')
        .insert([
          {
            sale_id: sale.id,
            customer_name,
            customer_cnic,
            customer_phone,
            total_amount: totalAmount,
            amount_paid: paidAmount,
            amount_remaining: dueAmount,
            store_id: parseInt(store_id),
          },
        ])

      if (partialPaymentError) throw partialPaymentError
    }

    // Create sale items and update inventory
    for (const saleItem of saleItems) {
      // Insert sale item (with snapshots)
      const { error: itemError } = await supabaseAdmin
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

        const { error: updateError } = await supabaseAdmin
          .from('inventory')
          .update({ quantity_remaining: newQuantity })
          .eq('id', inv.id)

        if (updateError) throw updateError

        remainingQuantity -= deductQuantity
      }
    }

    // Fetch complete sale data with items
    const { data: completeSale, error: fetchError } = await supabaseAdmin
      .from('sales')
      .select(`
        *,
        sale_items (*),
        partial_payment_customers (*)
      `)
      .eq('id', sale.id)
      .single()
    
    // Fetch cashier name separately
    if (completeSale && completeSale.cashier_id) {
      // Check if cashier_id is UUID (manager) or integer (cashier)
      const isUUID = typeof completeSale.cashier_id === 'string' && completeSale.cashier_id.includes('-')
      
      if (isUUID) {
        // Fetch from managers table
        const { data: manager } = await supabaseAdmin
          .from('managers')
          .select('full_name')
          .eq('id', completeSale.cashier_id)
          .single()
        
        if (manager) {
          completeSale.cashier_name = manager.full_name
        }
      } else {
        // Fetch from cashier_accounts table
        const { data: cashier } = await supabaseAdmin
          .from('cashier_accounts')
          .select('full_name')
          .eq('id', completeSale.cashier_id)
          .single()
        
        if (cashier) {
          completeSale.cashier_name = cashier.full_name
        }
      }
    }

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
