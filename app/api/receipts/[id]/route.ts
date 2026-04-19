import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_RECEIPT_SETTINGS, saleToReceiptData } from '@/lib/receipt-generator'
import type { ReceiptSettings } from '@/lib/types'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// GET: Fetch receipt data for a specific sale
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const saleId = parseInt(id)

    if (isNaN(saleId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid sale ID' },
        { status: 400 }
      )
    }

    // Fetch the sale with all related data
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items (*),
        partial_payment_customers!partial_payment_customers_sale_id_fkey (*)
      `)
      .eq('id', saleId)
      .single()

    if (saleError) {
      if (saleError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Sale not found' },
          { status: 404 }
        )
      }
      throw saleError
    }

    // Get cashier name if cashier_ref_id exists
    let cashierName = null
    if (sale.cashier_ref_id) {
      const { data: cashier } = await supabase
        .from('cashiers')
        .select('full_name')
        .eq('id', sale.cashier_ref_id)
        .single()
      if (cashier) {
        cashierName = cashier.full_name
      } else {
        const { data: cashierAccount } = await supabase
          .from('cashier_accounts')
          .select('full_name')
          .eq('id', sale.cashier_ref_id)
          .single()
        if (cashierAccount) {
          cashierName = cashierAccount.full_name
        }
      }
    }

    // If no cashier name yet, check cashier_id (manager UUID or legacy cashier account id)
    if (!cashierName && sale.cashier_id) {
      const cashierIdText = String(sale.cashier_id)

      if (cashierIdText.includes('-')) {
        const { data: manager } = await supabase
          .from('managers')
          .select('full_name')
          .eq('id', cashierIdText)
          .single()

        if (manager) {
          cashierName = manager.full_name
        }
      } else {
        const parsedCashierId = Number.parseInt(cashierIdText, 10)
        if (!Number.isNaN(parsedCashierId)) {
          const { data: cashierAccount } = await supabase
            .from('cashier_accounts')
            .select('full_name')
            .eq('id', parsedCashierId)
            .single()
          if (cashierAccount) {
            cashierName = cashierAccount.full_name
          }
        }
      }
    }

    // Fetch receipt settings for the store
    let settings: ReceiptSettings
    const { data: settingsData, error: settingsError } = await supabase
      .from('receipt_settings')
      .select('*')
      .eq('store_id', sale.store_id)
      .single()

    // Also fetch logo_url from stores table
    const { data: storeData } = await supabase
      .from('stores')
      .select('logo_url')
      .eq('id', sale.store_id)
      .single()
    const storeLogo = storeData?.logo_url || null

    if (settingsError || !settingsData) {
      // Use default settings if none exist
      settings = {
        ...DEFAULT_RECEIPT_SETTINGS,
        id: 0,
        store_id: sale.store_id,
        logo_url: storeLogo,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as ReceiptSettings
    } else {
      // Merge with defaults to ensure no null/empty critical fields
      settings = {
        ...DEFAULT_RECEIPT_SETTINGS,
        ...settingsData,
        business_name: settingsData.business_name || DEFAULT_RECEIPT_SETTINGS.business_name,
        thank_you_message: settingsData.thank_you_message || DEFAULT_RECEIPT_SETTINGS.thank_you_message,
        // Use store logo if receipt_settings doesn't have one
        logo_url: settingsData.logo_url || storeLogo,
      } as ReceiptSettings
    }

    // Add cashier name to sale object
    const saleWithCashier = {
      ...sale,
      cashier_name: cashierName,
    }

    // Convert to receipt data format
    const receiptData = saleToReceiptData(saleWithCashier, settings)

    return NextResponse.json({
      success: true,
      data: receiptData,
      sale: saleWithCashier,
      settings,
    })
  } catch (error: any) {
    console.error('Error fetching receipt data:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch receipt data' },
      { status: 500 }
    )
  }
}
