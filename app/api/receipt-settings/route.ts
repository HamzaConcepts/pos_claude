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

    // Merge with defaults to ensure no null/empty critical fields
    const mergedData = {
      ...DEFAULT_RECEIPT_SETTINGS,
      ...data,
      // Override empty strings with defaults for critical fields
      business_name: data.business_name || DEFAULT_RECEIPT_SETTINGS.business_name,
      thank_you_message: data.thank_you_message || DEFAULT_RECEIPT_SETTINGS.thank_you_message,
    }

    return NextResponse.json({
      success: true,
      data: mergedData,
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

    // Ensure critical fields are never empty
    const finalBusinessName = (business_name && business_name.trim()) || 'My Store'
    const finalThankYouMessage = (thank_you_message && thank_you_message.trim()) || 'Thank you for your purchase!'

    // Upsert the settings (insert or update)
    const { data, error } = await supabase
      .from('receipt_settings')
      .upsert(
        {
          store_id: parseInt(store_id),
          business_name: finalBusinessName,
          business_address: business_address?.trim() || null,
          business_phone: business_phone?.trim() || null,
          business_email: business_email?.trim() || null,
          tax_id: tax_id?.trim() || null,
          logo_url: logo_url?.trim() || null,
          default_format: default_format || 'pdf',
          thermal_paper_width: thermal_paper_width || '80mm',
          auto_print: auto_print ?? false,
          show_logo: show_logo ?? true,
          show_tax_id: show_tax_id ?? true,
          thank_you_message: finalThankYouMessage,
          return_policy: return_policy?.trim() || null,
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
