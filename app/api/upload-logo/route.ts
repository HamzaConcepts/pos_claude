import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

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

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const BUCKET_NAME = 'store-logos'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const storeId = formData.get('store_id') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 5 MB' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Only PNG, JPEG, WebP, and SVG images are allowed' },
        { status: 400 }
      )
    }

    // Generate a unique filename
    const ext = file.name.split('.').pop() || 'png'
    const fileName = `store_${storeId}/logo_${Date.now()}.${ext}`

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // First, try to delete any existing logo for this store
    const { data: existingFiles } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list(`store_${storeId}`)

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `store_${storeId}/${f.name}`)
      await supabaseAdmin.storage.from(BUCKET_NAME).remove(filesToDelete)
    }

    // Upload new file
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { success: false, error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName)

    const publicUrl = urlData.publicUrl

    // Update the stores table with the logo URL
    const { error: updateError } = await supabaseAdmin
      .from('stores')
      .update({ logo_url: publicUrl })
      .eq('id', parseInt(storeId))

    if (updateError) {
      console.error('Database update error:', updateError)
      // Still return success with URL since upload succeeded
    }

    return NextResponse.json({
      success: true,
      data: {
        logo_url: publicUrl,
        file_name: fileName,
      },
    })
  } catch (error: any) {
    console.error('Logo upload error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to upload logo' },
      { status: 500 }
    )
  }
}

// DELETE: Remove the store logo
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('store_id')

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      )
    }

    // Delete all files in the store's folder
    const { data: existingFiles } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .list(`store_${storeId}`)

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `store_${storeId}/${f.name}`)
      await supabaseAdmin.storage.from(BUCKET_NAME).remove(filesToDelete)
    }

    // Clear logo_url in stores table
    const { error: updateError } = await supabaseAdmin
      .from('stores')
      .update({ logo_url: null })
      .eq('id', parseInt(storeId))

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      message: 'Logo removed successfully',
    })
  } catch (error: any) {
    console.error('Logo delete error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove logo' },
      { status: 500 }
    )
  }
}
