import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_RECEIPT_SETTINGS } from '@/lib/receipt-generator'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// GET: Fetch receipt settings for a store
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'store_id is required' },
        { status: 400 }
      )
    }

    // Fetch receipt settings for the store
    const { data, error } = await supabase
      .from('receipt_settings')
      .select('*')
      .eq('store_id', parseInt(storeId))
      .single()

    if (error) {
      // If no settings exist, return defaults
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          success: true,
          data: {
            ...DEFAULT_RECEIPT_SETTINGS,
            store_id: parseInt(storeId),
            id: null,
          },
          isDefault: true,
        })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      data,
      isDefault: false,
    })
  } catch (error: any) {
    console.error('Error fetching receipt settings:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch receipt settings' },
      { status: 500 }
    )
  }
}

// POST: Create or update receipt settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      store_id,
      business_name,
      business_address,
      business_phone,
      business_email,
      tax_id,
      logo_url,
      default_format,
      thermal_paper_width,
      auto_print,
      show_logo,
      show_tax_id,
      thank_you_message,
      return_policy,
    } = body

    if (!store_id) {
      return NextResponse.json(
        { success: false, error: 'store_id is required' },
        { status: 400 }
      )
    }

    // Upsert the settings (insert or update)
    const { data, error } = await supabase
      .from('receipt_settings')
      .upsert(
        {
          store_id: parseInt(store_id),
          business_name: business_name || 'My Store',
          business_address,
          business_phone,
          business_email,
          tax_id,
          logo_url,
          default_format: default_format || 'pdf',
          thermal_paper_width: thermal_paper_width || '80mm',
          auto_print: auto_print ?? false,
          show_logo: show_logo ?? true,
          show_tax_id: show_tax_id ?? true,
          thank_you_message: thank_you_message || 'Thank you for your purchase!',
          return_policy,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'store_id',
        }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      message: 'Receipt settings saved successfully',
    })
  } catch (error: any) {
    console.error('Error saving receipt settings:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save receipt settings' },
      { status: 500 }
    )
  }
}
