import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPKTNow } from '@/lib/date-utils'

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

const roundToTwo = (value: number): number => Math.round(value * 100) / 100

const deriveStorePrefix = (storeName?: string | null, storeCode?: string | null): string => {
  const tokens = (storeName || '').toUpperCase().match(/[A-Z0-9]+/g) || []
  let prefix = ''

  if (tokens.length >= 2) {
    prefix = tokens.slice(0, 3).map((token) => token[0]).join('')
  } else if (tokens.length === 1) {
    prefix = tokens[0].slice(0, 3)
  }

  if (!prefix) {
    prefix = ((storeCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)) || 'SAL'
  }

  return prefix.padEnd(3, 'X')
}

const formatStoreSaleNumber = (prefix: string, sequenceNumber: number): string => {
  return `INV-${prefix}-${String(sequenceNumber).padStart(4, '0')}`
}

const resolveCashierName = async (sale: any): Promise<string> => {
  if (sale.cashier_ref_id) {
    const { data: cashier } = await supabaseAdmin
      .from('cashiers')
      .select('full_name')
      .eq('id', sale.cashier_ref_id)
      .single()

    if (cashier?.full_name) {
      return cashier.full_name
    }

    const { data: cashierAccountFromRef } = await supabaseAdmin
      .from('cashier_accounts')
      .select('full_name')
      .eq('id', sale.cashier_ref_id)
      .single()

    if (cashierAccountFromRef?.full_name) {
      return cashierAccountFromRef.full_name
    }
  }

  if (sale.cashier_id) {
    const cashierIdText = String(sale.cashier_id)

    if (cashierIdText.includes('-')) {
      const { data: manager } = await supabaseAdmin
        .from('managers')
        .select('full_name')
        .eq('id', cashierIdText)
        .single()

      if (manager?.full_name) {
        return manager.full_name
      }
    } else {
      const parsedCashierId = Number.parseInt(cashierIdText, 10)
      if (!Number.isNaN(parsedCashierId)) {
        const { data: cashierAccount } = await supabaseAdmin
          .from('cashier_accounts')
          .select('full_name')
          .eq('id', parsedCashierId)
          .single()

        if (cashierAccount?.full_name) {
          return cashierAccount.full_name
        }
      }
    }
  }

  return 'Unknown'
}

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
        partial_payment_customers!partial_payment_customers_sale_id_fkey (*),
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
          // Don't set to 'Unknown' yet - will check cashier_id next
          sale.cashier_name = null
        }
      })
      
      // Legacy support: also fetch from cashier_id field (for old records and managers)
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
      
      // Set any remaining null names to 'Unknown'
      sales.forEach(sale => {
        if (!sale.cashier_name) {
          sale.cashier_name = 'Unknown'
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
      payments,
      amount_paid, 
      notes, 
      cashier_id,
      cashier_ref_id, // Reference to cashier from cashiers table
      partial_payment_customer, // New field for partial payment customer info
      store_id,
      discount_type,
      discount_value,
      invoice_total,
      customer_name, // Customer details
      customer_phone,
      customer_cnic,
      bank_account_name
    } = body

    const fallbackPartialCustomerName =
      typeof partial_payment_customer?.customer_name === 'string'
        ? partial_payment_customer.customer_name.trim()
        : ''
    const fallbackPartialCustomerPhone =
      typeof partial_payment_customer?.customer_phone === 'string'
        ? partial_payment_customer.customer_phone.trim()
        : ''
    const normalizedCustomerName =
      (typeof customer_name === 'string' ? customer_name.trim() : '') || fallbackPartialCustomerName
    const normalizedCustomerPhone =
      (typeof customer_phone === 'string' ? customer_phone.trim() : '') || fallbackPartialCustomerPhone
    const normalizedBankAccountName =
      typeof bank_account_name === 'string' ? bank_account_name.trim() : ''
    const normalizedCashierId = typeof cashier_id === 'string' ? cashier_id.trim() : cashier_id
    const normalizedCashierRefId = typeof cashier_ref_id === 'string' ? cashier_ref_id.trim() : cashier_ref_id

    // Determine the authenticated user for payment recording
    // cashier_id can be:
    // - UUID string (manager from Supabase Auth)
    // - Integer or string number (cashier account ID)
    let paymentRecorderId: string | number
    let isManagerUser = false

    // Check if we have a valid cashier_id
    if (!normalizedCashierId && !normalizedCashierRefId) {
      return NextResponse.json(
        {
          success: false,
          error: 'User authentication required',
          code: 'AUTHENTICATION_ERROR',
        },
        { status: 401 }
      )
    }

    // Prioritize cashier_id for authentication (who is making the sale)
    const authId = normalizedCashierId || normalizedCashierRefId
    const authIdStr = String(authId)

    // Check if it's a UUID (manager)
    if (authIdStr.includes('-')) {
      isManagerUser = true
      paymentRecorderId = authIdStr // UUID for manager
    } else {
      // It's a cashier account ID (could be number or string number)
      isManagerUser = false
      const parsedId = parseInt(authIdStr)
      if (isNaN(parsedId)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid user authentication',
            code: 'AUTHENTICATION_ERROR',
          },
          { status: 401 }
        )
      }
      paymentRecorderId = parsedId
    }

    let cashierRefIdForSale: number | null = null
    if (!isManagerUser) {
      const fallbackCashierRef = normalizedCashierRefId ?? paymentRecorderId
      const parsedCashierRef = Number.parseInt(String(fallbackCashierRef), 10)

      if (Number.isNaN(parsedCashierRef)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid user authentication',
            code: 'AUTHENTICATION_ERROR',
          },
          { status: 401 }
        )
      }

      cashierRefIdForSale = parsedCashierRef
    }

    const paymentSplits = Array.isArray(payments) ? payments : []
    let cashPaid = 0
    let digitalPaid = 0
    let splitBankAccountName = ''
    let hasPaymentSplits = false

    for (const payment of paymentSplits) {
      const method = payment?.payment_method || payment?.method
      const amount = Number(payment?.amount)

      if (!method) continue

      if (!['Cash', 'Digital'].includes(method)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid payment method in split payments',
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }

      if (!Number.isFinite(amount) || amount < 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid payment amount in split payments',
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }

      if (amount <= 0) continue

      hasPaymentSplits = true

      if (method === 'Cash') {
        cashPaid += amount
      } else {
        digitalPaid += amount
        const bankName = typeof payment?.bank_account_name === 'string'
          ? payment.bank_account_name.trim()
          : ''

        if (bankName) {
          if (splitBankAccountName && splitBankAccountName !== bankName) {
            return NextResponse.json(
              {
                success: false,
                error: 'Only one bank account can be used for digital split payments',
                code: 'VALIDATION_ERROR',
              },
              { status: 400 }
            )
          }
          splitBankAccountName = bankName
        }
      }
    }

    const normalizedPaymentMethod =
      typeof payment_method === 'string' && ['Cash', 'Digital', 'Mixed'].includes(payment_method)
        ? payment_method
        : null

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

    const parsedStoreId = parseInt(String(store_id), 10)
    if (Number.isNaN(parsedStoreId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid store ID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    if (!hasPaymentSplits && (!normalizedPaymentMethod || normalizedPaymentMethod === 'Mixed')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid payment method',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const requiresDigitalDetails = digitalPaid > 0 || normalizedPaymentMethod === 'Digital'

    if (requiresDigitalDetails && !normalizedCustomerName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Customer name is required for Digital payment',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const resolvedBankAccountName = splitBankAccountName || normalizedBankAccountName

    if (requiresDigitalDetails && !resolvedBankAccountName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bank account is required for Digital payment',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const hasInvoiceTotal = invoice_total !== undefined && invoice_total !== null && invoice_total !== ''
    const invoiceTotalValue = hasInvoiceTotal ? parseFloat(String(invoice_total)) : null

    if (hasInvoiceTotal && (invoiceTotalValue === null || !Number.isFinite(invoiceTotalValue) || invoiceTotalValue <= 0)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invoice total must be a valid number greater than 0',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const { data: storeDetails, error: storeDetailsError } = await supabaseAdmin
      .from('stores')
      .select('store_name, store_code')
      .eq('id', parsedStoreId)
      .single()

    if (storeDetailsError || !storeDetails) {
      return NextResponse.json(
        {
          success: false,
          error: 'Store not found',
          code: 'STORE_NOT_FOUND',
        },
        { status: 404 }
      )
    }

    if (requiresDigitalDetails) {
      const { data: matchingBankAccounts, error: bankAccountLookupError } = await supabaseAdmin
        .from('store_bank_accounts')
        .select('id')
        .eq('store_id', parsedStoreId)
        .eq('account_name', resolvedBankAccountName)
        .limit(1)

      if (bankAccountLookupError) {
        throw bankAccountLookupError
      }

      if (!matchingBankAccounts || matchingBankAccounts.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Selected bank account is not configured for this store',
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }
    }

    // Fetch product details and calculate total
    let totalAmount = 0
    const saleItems = []

    for (const item of items) {
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
        .eq('store_id', parsedStoreId)
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

      // Get available stock batches ordered by FIFO (oldest first)
      const { data: batches, error: batchError } = await supabaseAdmin
        .from('stock_batches')
        .select('id, quantity_remaining, purchase_date')
        .eq('product_id', item.product_id)
        .eq('store_id', parsedStoreId)
        .eq('is_depleted', false)
        .gt('quantity_remaining', 0)
        .order('purchase_date', { ascending: true })
        .order('id', { ascending: true })

      if (batchError || !batches || batches.length === 0) {
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
      const itemQuantity = Number.parseInt(String(item.quantity), 10)
      if (!Number.isInteger(itemQuantity) || itemQuantity <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid quantity for ${product.name}`,
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }

      if (totalStock < itemQuantity) {
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
        if (!item.imei_numbers || item.imei_numbers.length !== itemQuantity) {
          return NextResponse.json(
            {
              success: false,
              error: `Please select ${itemQuantity} IMEI number${itemQuantity > 1 ? 's' : ''} for ${product.name}`,
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
          .eq('store_id', parsedStoreId)

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

      const defaultSellingPrice = Number(aggStock?.aggregated_selling_price || 0)
      const lowestNegotiable = Number(aggStock?.aggregated_lowest_negotiable || 0)
      const rawRequestedUnitPrice = item.unit_price
      const hasRequestedUnitPrice = rawRequestedUnitPrice !== undefined && rawRequestedUnitPrice !== null && rawRequestedUnitPrice !== ''
      const requestedUnitPrice = hasRequestedUnitPrice ? Number(rawRequestedUnitPrice) : null

      if (hasRequestedUnitPrice && (!Number.isFinite(requestedUnitPrice) || (requestedUnitPrice as number) < 0)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid unit price for ${product.name}`,
            code: 'VALIDATION_ERROR',
          },
          { status: 400 }
        )
      }

      if (hasRequestedUnitPrice && (requestedUnitPrice as number) < lowestNegotiable && !isManagerUser) {
        return NextResponse.json(
          {
            success: false,
            error: `Manager confirmation is required to set ${product.name} below lowest negotiable price`,
            code: 'MANAGER_CONFIRMATION_REQUIRED',
          },
          { status: 403 }
        )
      }

      const sellingPrice = roundToTwo(hasRequestedUnitPrice ? (requestedUnitPrice as number) : defaultSellingPrice)
      
      // Use aggregated_cost_price for cost calculation (for profit tracking)
      const costPrice = aggStock?.aggregated_cost_price || 0
      
      const subtotal = roundToTwo(sellingPrice * itemQuantity)
      totalAmount += subtotal

      saleItems.push({
        product_id: product.id,
        product_sku: product.sku,
        product_name: product.name,
        quantity: itemQuantity,
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

    // For Khaata flow, invoice_total overrides computed list total.
    if (invoiceTotalValue !== null) {
      totalAmount = invoiceTotalValue
    }

    if (invoiceTotalValue !== null) {
      const baseSubtotal = saleItems.reduce((sum, item) => sum + item.subtotal, 0)

      if (baseSubtotal > 0) {
        let allocatedSubtotal = 0

        saleItems.forEach((saleItem, index) => {
          let proportionalSubtotal = 0

          if (index === saleItems.length - 1) {
            proportionalSubtotal = roundToTwo(totalAmount - allocatedSubtotal)
          } else {
            proportionalSubtotal = roundToTwo((saleItem.subtotal / baseSubtotal) * totalAmount)
          }

          allocatedSubtotal = roundToTwo(allocatedSubtotal + proportionalSubtotal)
          saleItem.subtotal = proportionalSubtotal
          saleItem.unit_price = roundToTwo(proportionalSubtotal / saleItem.quantity)
        })

        const distributedSubtotal = roundToTwo(
          saleItems.reduce((sum, item) => sum + item.subtotal, 0)
        )
        const roundingDifference = roundToTwo(totalAmount - distributedSubtotal)

        if (saleItems.length > 0 && Math.abs(roundingDifference) >= 0.01) {
          const lastItem = saleItems[saleItems.length - 1]
          lastItem.subtotal = roundToTwo(lastItem.subtotal + roundingDifference)
          lastItem.unit_price = roundToTwo(lastItem.subtotal / lastItem.quantity)
        }
      }
    }

    const paidAmount = roundToTwo(
      hasPaymentSplits ? cashPaid + digitalPaid : Number(amount_paid) || 0
    )

    if (invoiceTotalValue !== null && paidAmount > totalAmount) {
      return NextResponse.json(
        {
          success: false,
          error: 'Amount paid cannot exceed invoice price for Khaata sale',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const dueAmount = totalAmount - paidAmount
    const paymentStatus = dueAmount <= 0 ? 'Paid' : 'Partial'
    let salePaymentMethod = normalizedPaymentMethod || 'Cash'

    if (hasPaymentSplits) {
      if (cashPaid > 0 && digitalPaid > 0) {
        salePaymentMethod = 'Mixed'
      } else if (digitalPaid > 0) {
        salePaymentMethod = 'Digital'
      } else if (cashPaid > 0) {
        salePaymentMethod = 'Cash'
      }
    }

    // Validate partial payment customer info when provided
    if (partial_payment_customer) {
      const { customer_name, customer_phone } = partial_payment_customer
      const partialCustomerName = typeof customer_name === 'string' ? customer_name.trim() : ''
      const partialCustomerPhone = typeof customer_phone === 'string' ? customer_phone.trim() : ''

      if (!partialCustomerName || !partialCustomerPhone) {
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

    // sale_number_store is auto-generated by DB trigger; we store a provisional number first,
    // then replace it with PREFIX-001 format once sale_number_store is known.
    const saleNumber = `TMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    // For the sales table: use cashier_id only for managers (UUID)
    // For cashier accounts, use null and rely on cashier_ref_id
    const cashierIdForSale = isManagerUser ? paymentRecorderId : null

    // Create sale
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .insert([
        {
          sale_number: saleNumber,
          sale_date: getPKTNow(), // Use PKT timezone
          sale_description: sale_description || null,
          cashier_id: cashierIdForSale, // Only UUID (managers), null for cashier accounts
          cashier_ref_id: cashierRefIdForSale, // Reference to selected cashier
          total_amount: totalAmount,
          payment_method: salePaymentMethod,
          payment_status: paymentStatus,
          amount_paid: paidAmount,
          amount_due: dueAmount > 0 ? dueAmount : 0,
          store_id: parsedStoreId,
          notes,
          discount_type: discount_type || 'none',
          discount_value: discount_value || 0,
          customer_name: normalizedCustomerName || null,
          customer_phone: normalizedCustomerPhone || null,
          customer_cnic: customer_cnic || null,
          bank_account_name:
            salePaymentMethod === 'Digital' || salePaymentMethod === 'Mixed'
              ? resolvedBankAccountName
              : null,
        },
      ])
      .select()
      .single()

    if (saleError) throw saleError

    const salePrefix = deriveStorePrefix(storeDetails.store_name, storeDetails.store_code)
    const formattedSaleNumber = formatStoreSaleNumber(salePrefix, sale.sale_number_store)

    const { error: saleNumberUpdateError } = await supabaseAdmin
      .from('sales')
      .update({ sale_number: formattedSaleNumber })
      .eq('id', sale.id)
      .eq('store_id', parsedStoreId)

    if (saleNumberUpdateError) {
      throw saleNumberUpdateError
    }

    sale.sale_number = formattedSaleNumber

    // Create payment record(s) (track all payments)
    const paymentRows: any[] = []

    if (hasPaymentSplits) {
      if (cashPaid > 0) {
        paymentRows.push({
          sale_id: sale.id,
          amount: cashPaid,
          payment_method: 'Cash',
          bank_account_name: null,
        })
      }

      if (digitalPaid > 0) {
        paymentRows.push({
          sale_id: sale.id,
          amount: digitalPaid,
          payment_method: 'Digital',
          bank_account_name: resolvedBankAccountName,
        })
      }
    } else if (paidAmount > 0) {
      paymentRows.push({
        sale_id: sale.id,
        amount: paidAmount,
        payment_method: salePaymentMethod,
        bank_account_name: salePaymentMethod === 'Digital' ? resolvedBankAccountName : null,
      })
    }

    if (paymentRows.length > 0) {
      const recordedByRows = paymentRows.map((row) => ({
        ...row,
        payment_date: getPKTNow(), // Use PKT timezone
        store_id: parsedStoreId,
        manager_id: isManagerUser ? paymentRecorderId : null,
        cashier_id: isManagerUser ? null : paymentRecorderId,
      }))

      const { error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert(recordedByRows)

      if (paymentError) {
        throw paymentError
      }
    }

    // Create partial payment customer record if applicable (including zero paid)
    if (partial_payment_customer) {
      const { customer_name, customer_phone } = partial_payment_customer
      const partialCustomerName = typeof customer_name === 'string' ? customer_name.trim() : ''
      const partialCustomerPhone = typeof customer_phone === 'string' ? customer_phone.trim() : ''
      
      const { error: partialPaymentError } = await supabaseAdmin
        .from('partial_payment_customers')
        .insert([
          {
            sale_id: sale.id,
            customer_name: partialCustomerName,
            customer_phone: partialCustomerPhone,
            total_amount: totalAmount,
            amount_paid: paidAmount,
            amount_remaining: dueAmount,
            store_id: parsedStoreId,
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
          p_store_id: parsedStoreId,
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
            sold_at: getPKTNow(), // Use PKT timezone
            sale_id: sale.id,
          })
          .in('imei_number', saleItem.imei_numbers)
          .eq('product_id', saleItem.product_id)
          .eq('store_id', parsedStoreId)

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
        partial_payment_customers!partial_payment_customers_sale_id_fkey (*)
      `)
      .eq('id', sale.id)
      .single()
    
    if (fetchError || !completeSale) {
      console.error('Error fetching complete sale:', fetchError)
      throw new Error('Failed to fetch sale details')
    }

    completeSale.cashier_name = await resolveCashierName(completeSale)

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
