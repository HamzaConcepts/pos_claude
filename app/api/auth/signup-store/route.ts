// API endpoint for unified store signup flow (3-page signup)
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

interface StaffCashier {
  name: string
  phone: string
  commissionRate: number
}

interface SignupStoreRequest {
  // Page 1
  storeName: string
  ownerName: string
  
  // Page 2
  email: string
  phoneNumber: string
  password: string
  
  // Page 3
  cashierAccount: {
    accountName: string
    accountPhone: string
    accountPassword: string
  }
  staffCashiers: StaffCashier[]
}

export async function POST(request: Request) {
  let managerUuid: string | null = null

  try {
    const body: SignupStoreRequest = await request.json()
    const { storeName, ownerName, email, phoneNumber, password, cashierAccount, staffCashiers } = body

    // ═══════════════════════════════════════════════════════
    // STEP 1: Validate All Input
    // ═══════════════════════════════════════════════════════
    const errors: Record<string, string> = {}

    // Store validation
    if (!storeName || storeName.trim().length === 0) {
      errors.storeName = 'Store name is required'
    } else if (storeName.length > 100) {
      errors.storeName = 'Store name must be 100 characters or less'
    }

    if (!ownerName || ownerName.trim().length === 0) {
      errors.ownerName = 'Owner name is required'
    } else if (ownerName.length > 100) {
      errors.ownerName = 'Owner name must be 100 characters or less'
    }

    // Manager validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Valid email is required'
    }

    if (!phoneNumber || !/^[0-9]{11}$/.test(phoneNumber)) {
      errors.phoneNumber = 'Phone must be exactly 11 digits'
    }

    if (!password || password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errors.password = 'Password must contain uppercase, lowercase, and number'
    }

    // Cashier account validation
    if (!cashierAccount?.accountPhone || !/^[0-9]{11}$/.test(cashierAccount.accountPhone)) {
      errors.cashierAccountPhone = 'Cashier account phone must be 11 digits'
    }

    if (cashierAccount?.accountPhone === phoneNumber) {
      errors.cashierAccountPhone = 'Cashier account phone must be different from manager phone'
    }

    if (!cashierAccount?.accountPassword || cashierAccount.accountPassword.length < 6) {
      errors.cashierAccountPassword = 'Cashier password must be at least 6 characters'
    }

    if (!cashierAccount?.accountName || cashierAccount.accountName.trim().length === 0) {
      errors.cashierAccountName = 'Cashier account name is required'
    }

    // Staff cashiers validation
    if (!staffCashiers || staffCashiers.length === 0) {
      errors.staffCashiers = 'At least one staff cashier is required'
    } else {
      staffCashiers.forEach((cashier, idx) => {
        if (!cashier.name || cashier.name.trim().length === 0) {
          errors[`cashier_${idx}_name`] = 'Cashier name is required'
        }
        if (!cashier.phone || !/^[0-9]{11}$/.test(cashier.phone)) {
          errors[`cashier_${idx}_phone`] = 'Phone must be 11 digits'
        }
        if (cashier.commissionRate < 0 || cashier.commissionRate > 100) {
          errors[`cashier_${idx}_commission`] = 'Commission must be between 0 and 100'
        }
      })
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 })
    }

    // ═══════════════════════════════════════════════════════
    // STEP 2: Check Uniqueness (Manager Email & Phone)
    // ═══════════════════════════════════════════════════════
    const { data: existingManagerEmail } = await supabaseAdmin
      .from('managers')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    if (existingManagerEmail) {
      return NextResponse.json(
        { error: 'Email already registered', field: 'email' },
        { status: 409 }
      )
    }

    const { data: existingManagerPhone } = await supabaseAdmin
      .from('managers')
      .select('id')
      .eq('phone_number', phoneNumber)
      .maybeSingle()

    if (existingManagerPhone) {
      return NextResponse.json(
        { error: 'Phone number already registered', field: 'phoneNumber' },
        { status: 409 }
      )
    }

    // ═══════════════════════════════════════════════════════
    // STEP 3: Check Uniqueness (Cashier Account Phone)
    // ═══════════════════════════════════════════════════════
    const { data: existingCashierAccount } = await supabaseAdmin
      .from('cashier_accounts')
      .select('id')
      .eq('phone_number', cashierAccount.accountPhone)
      .maybeSingle()

    if (existingCashierAccount) {
      return NextResponse.json(
        { error: 'Cashier account phone already registered', field: 'cashierAccountPhone' },
        { status: 409 }
      )
    }

    // ═══════════════════════════════════════════════════════
    // STEP 4: Create Supabase Auth User (Manager)
    // ═══════════════════════════════════════════════════════
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true, // Auto-confirm for now
      user_metadata: {
        full_name: ownerName,
        phone_number: phoneNumber,
        role: 'Manager',
      },
    })

    if (authError || !authData.user) {
      console.error('Error creating auth user:', authError)
      return NextResponse.json(
        { error: authError?.message || 'Failed to create user account' },
        { status: 500 }
      )
    }

    managerUuid = authData.user.id

    try {
      // ═══════════════════════════════════════════════════════
      // STEP 5: Generate Store Code (via RPC)
      // ═══════════════════════════════════════════════════════
      const { data: storeCode, error: codeError } = await supabaseAdmin
        .rpc('generate_store_code')

      if (codeError) {
        console.error('Error generating store code:', codeError)
        throw new Error(`Store code generation failed: ${codeError.message}`)
      }

      // ═══════════════════════════════════════════════════════
      // STEP 6: Insert Store
      // ═══════════════════════════════════════════════════════
      const { data: store, error: storeError } = await supabaseAdmin
        .from('stores')
        .insert([{
          store_code: storeCode,
          store_name: storeName.trim(),
          created_by: managerUuid,
        }])
        .select()
        .single()

      if (storeError) {
        console.error('Error creating store:', storeError)
        throw new Error(`Store creation failed: ${storeError.message}`)
      }

      // ═══════════════════════════════════════════════════════
      // STEP 7: Insert Manager
      // ═══════════════════════════════════════════════════════
      const { error: managerError } = await supabaseAdmin
        .from('managers')
        .insert([{
          id: managerUuid,
          email: email.toLowerCase().trim(),
          full_name: ownerName.trim(),
          phone_number: phoneNumber,
          store_name: storeName.trim(),
          store_id: store.id,
          store_code: storeCode,
        }])

      if (managerError) {
        console.error('Error creating manager record:', managerError)
        throw new Error(`Manager creation failed: ${managerError.message}`)
      }

      // ═══════════════════════════════════════════════════════
      // STEP 8: Insert Cashier Account (Shared Login)
      // ═══════════════════════════════════════════════════════
      // Note: password_hash will be auto-hashed by database trigger
      const { data: cashierAcct, error: cashierAcctError } = await supabaseAdmin
        .from('cashier_accounts')
        .insert([{
          full_name: cashierAccount.accountName.trim(),
          phone_number: cashierAccount.accountPhone,
          password_hash: cashierAccount.accountPassword, // Auto-hashed by trigger
          store_id: store.id,
        }])
        .select()
        .single()

      if (cashierAcctError) {
        console.error('Error creating cashier account:', cashierAcctError)
        throw new Error(`Cashier account creation failed: ${cashierAcctError.message}`)
      }

      // ═══════════════════════════════════════════════════════
      // STEP 9: Insert Staff Cashiers (Bulk)
      // ═══════════════════════════════════════════════════════
      const staffRecords = staffCashiers.map((cashier) => ({
        store_id: store.id,
        full_name: cashier.name.trim(),
        phone_number: cashier.phone,
        commission_rate: cashier.commissionRate || 0,
        salary: 0,
      }))

      const { data: staffData, error: staffError } = await supabaseAdmin
        .from('cashiers')
        .insert(staffRecords)
        .select()

      if (staffError) {
        console.error('Error creating staff cashiers:', staffError)
        throw new Error(`Staff cashier creation failed: ${staffError.message}`)
      }

      // ═══════════════════════════════════════════════════════
      // STEP 10: Success Response
      // ═══════════════════════════════════════════════════════
      return NextResponse.json({
        success: true,
        data: {
          storeId: store.id,
          storeCode: storeCode,
          storeName: storeName.trim(),
          managerId: managerUuid,
          managerEmail: email.toLowerCase().trim(),
          cashierAccountId: cashierAcct.id,
          cashierAccountPhone: cashierAccount.accountPhone,
          staffCount: staffData?.length || 0,
        },
        message: `Store "${storeName}" created successfully! Your store code is: ${storeCode}`,
      }, { status: 201 })

    } catch (dbError: any) {
      // ═══════════════════════════════════════════════════════
      // ROLLBACK: Delete Auth User if DB operations fail
      // ═══════════════════════════════════════════════════════
      console.error('Database transaction failed, rolling back:', dbError)
      
      if (managerUuid) {
        await supabaseAdmin.auth.admin.deleteUser(managerUuid)
      }
      
      throw dbError
    }

  } catch (error: any) {
    console.error('Signup error:', error)
    
    // Clean up auth user if it was created
    if (managerUuid) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(managerUuid)
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError)
      }
    }
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
