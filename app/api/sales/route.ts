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
      // Get cashier_ref_id values (from cashiers table) - this is the MAIN cashier reference
      const cashierRefIds = [...new Set(sales.map(s => s.cashier_ref_id).filter(Boolean))]
      const cashierRefNameMap = new Map()
      
      if (cashierRefIds.length > 0) {
        const { data: cashierRefs } = await supabaseAdmin
          .from('cashiers')
          .select('id, full_name')
          .in('id', cashierRefIds)
        
        if (cashierRefs) {
          cashierRefs.forEach(c => cashierRefNameMap.set(c.id, c.full_name))
        }
      }
      
      // Add cashier names to sales - prioritize cashier_ref_id
      sales.forEach(sale => {
        if (sale.cashier_ref_id) {
          sale.cashier_name = cashierRefNameMap.get(sale.cashier_ref_id) || 'Unknown'
        } else {
          sale.cashier_name = 'Unknown'
        }
      })
      
      // Legacy support: also fetch from cashier_id field (for old records)
      const allCashierIds = [...new Set(sales.map(s => s.cashier_id).filter(Boolean))]
      
      if (allCashierIds.length > 0) {
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
        
        // Fetch cashier account names
        if (cashierAccountIds.length > 0) {
          const { data: cashiers } = await supabaseAdmin
            .from('cashier_accounts')
            .select('id, full_name')
            .in('id', cashierAccountIds)
          
          cashiers?.forEach(c => cashierNameMap.set(c.id, c.full_name))
        }
        
        // Add cashier names to sales (only if cashier_name not already set from cashier_ref_id)
        sales.forEach(sale => {
          if (!sale.cashier_name && sale.cashier_id) {
            sale.cashier_name = cashierNameMap.get(sale.cashier_id) || 'Unknown'
          }
        })
      }
      
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
      cashier_ref_id, // Reference to cashier from cashiers table
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

    // Fetch product details and calculate total
    let totalAmount = 0
    const saleItems = []

    for (const item of items) {
      console.log(`[SALES API] Processing item: product_id=${item.product_id}, quantity=${item.quantity}`)
      
      // First, get the product details with aggregated stock
      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .select(`
          id,
          sku,
          name,
          description,
          is_phone,
          is_active,
          store_id,
          aggregated_stock (
            aggregated_cost_price,
            aggregated_selling_price,
            aggregated_lowest_negotiable,
            total_quantity_remaining
          )
        `)
        .eq('id', item.product_id)
        .eq('store_id', parseInt(store_id))
        .single()

      console.log(`[SALES API] Product query result:`, { product, productError })

      if (productError || !product) {
        console.error(`[SALES API] ❌ Product not found: ${item.product_id}`, productError)
        return NextResponse.json(
          {
            success: false,
            error: `Product not found: ${item.product_id}`,
            code: 'PRODUCT_NOT_FOUND',
          },
          { status: 404 }
        )
      }

      // Get available stock batches ordered by FIFO (oldest first)
      const { data: batches, error: batchError } = await supabaseAdmin
        .from('stock_batches')
        .select('id, quantity_remaining, purchase_date')
        .eq('product_id', item.product_id)
        .eq('store_id', parseInt(store_id))
        .eq('is_depleted', false)
        .gt('quantity_remaining', 0)
        .order('purchase_date', { ascending: true })
        .order('id', { ascending: true })

      console.log(`[SALES API] Batches query result:`, { batches, batchError })

      if (batchError || !batches || batches.length === 0) {
        console.error(`[SALES API] ❌ No stock available for product ${product.name}`, batchError)
        return NextResponse.json(
          {
            success: false,
            error: `No stock available for ${product.name}`,
            code: 'NO_STOCK',
          },
          { status: 400 }
        )
      }

      // Calculate total stock from all available batches
      const totalStock = batches.reduce(
        (sum, batch) => sum + batch.quantity_remaining,
        0
      )

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

      // Validate IMEI numbers for phone products
      if (product.is_phone) {
        if (!item.imei_numbers || item.imei_numbers.length !== item.quantity) {
          return NextResponse.json(
            {
              success: false,
              error: `Please select ${item.quantity} IMEI number${item.quantity > 1 ? 's' : ''} for ${product.name}`,
              code: 'IMEI_REQUIRED',
            },
            { status: 400 }
          )
        }

        // Verify all IMEIs are available (in_stock status)
        const { data: imeiRecords, error: imeiError } = await supabaseAdmin
          .from('product_imeis')
          .select('id, imei_number, status')
          .in('imei_number', item.imei_numbers)
          .eq('product_id', product.id)
          .eq('store_id', parseInt(store_id))

        if (imeiError || !imeiRecords || imeiRecords.length !== item.imei_numbers.length) {
          return NextResponse.json(
            {
              success: false,
              error: `Some IMEI numbers not found for ${product.name}`,
              code: 'IMEI_NOT_FOUND',
            },
            { status: 400 }
          )
        }

        const unavailableIMEIs = imeiRecords.filter((imei: any) => imei.status !== 'in_stock')
        if (unavailableIMEIs.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: `IMEI ${unavailableIMEIs[0].imei_number} is not available (status: ${unavailableIMEIs[0].status})`,
              code: 'IMEI_UNAVAILABLE',
            },
            { status: 400 }
          )
        }
      }

      // Use aggregated_selling_price from aggregated_stock
      const aggStock = Array.isArray(product.aggregated_stock) 
        ? product.aggregated_stock[0] 
        : product.aggregated_stock
      
      const sellingPrice = aggStock?.aggregated_selling_price || 0
      
      // Use aggregated_cost_price for cost calculation (for profit tracking)
      const costPrice = aggStock?.aggregated_cost_price || 0
      
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
        imei_numbers: item.imei_numbers || [],
        is_phone: product.is_phone,
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
      const { customer_name, customer_phone } = partial_payment_customer
      if (!customer_name || !customer_phone) {
        return NextResponse.json(
          {
            success: false,
            error: 'Customer name and phone are required for partial payment',
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }
    }

    // Generate sale number
    const saleNumber = `SALE-${Date.now()}`

    // Determine if cashier_id is a UUID (manager) or integer (cashier account)
    // Only store UUID in cashier_id field, set to null for cashier accounts
    const isManagerUUID = cashier_id && typeof cashier_id === 'string' && cashier_id.includes('-')
    const cashierIdForSale = isManagerUUID ? cashier_id : null

    // Create sale
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .insert([
        {
          sale_number: saleNumber,
          sale_description: sale_description || null,
          cashier_id: cashierIdForSale, // Only UUID (managers), null for cashier accounts
          cashier_ref_id: cashier_ref_id || null, // Reference to selected cashier
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
      const { customer_name, customer_phone } = partial_payment_customer
      
      const { error: partialPaymentError } = await supabaseAdmin
        .from('partial_payment_customers')
        .insert([
          {
            sale_id: sale.id,
            customer_name,
            customer_phone,
            total_amount: totalAmount,
            amount_paid: paidAmount,
            amount_remaining: dueAmount,
            store_id: parseInt(store_id),
          },
        ])

      if (partialPaymentError) throw partialPaymentError
    }

    // Create sale items and update inventory using FIFO
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

      // Use FIFO function to deduct stock from batches
      const { data: fifoResult, error: fifoError } = await supabaseAdmin
        .rpc('deduct_stock_fifo', {
          p_product_id: saleItem.product_id,
          p_store_id: parseInt(store_id),
          p_quantity: saleItem.quantity,
          p_sale_id: sale.id,
        })

      if (fifoError) {
        console.error('FIFO deduction error:', fifoError)
        throw new Error(`Failed to deduct stock for ${saleItem.product_name}: ${fifoError.message}`)
      }

      // Mark IMEIs as sold if it's a phone product
      if (saleItem.is_phone && saleItem.imei_numbers && saleItem.imei_numbers.length > 0) {
        const { error: imeiUpdateError } = await supabaseAdmin
          .from('product_imeis')
          .update({
            status: 'sold',
            sold_at: new Date().toISOString(),
            sale_id: sale.id,
          })
          .in('imei_number', saleItem.imei_numbers)
          .eq('product_id', saleItem.product_id)
          .eq('store_id', parseInt(store_id))

        if (imeiUpdateError) {
          console.error('IMEI update error:', imeiUpdateError)
          throw new Error(`Failed to mark IMEIs as sold for ${saleItem.product_name}`)
        }
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
    
    // Fetch cashier name from cashiers table using cashier_ref_id
    if (completeSale && completeSale.cashier_ref_id) {
      const { data: cashier } = await supabaseAdmin
        .from('cashiers')
        .select('full_name')
        .eq('id', completeSale.cashier_ref_id)
        .single()
      
      if (cashier) {
        completeSale.cashier_name = cashier.full_name
      } else {
        completeSale.cashier_name = 'Unknown'
      }
    } else if (completeSale && completeSale.cashier_id) {
      // Legacy support: Check if cashier_id is UUID (manager) or integer (cashier)
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
    } else {
      completeSale.cashier_name = 'Unknown'
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
