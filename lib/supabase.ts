import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type UserRole = 'Manager' | 'Cashier'

export interface User {
  id: string
  email: string
  role: UserRole
  full_name: string
  username: string
}

export const permissions = {
  Manager: [
    'create_user', 'edit_user', 'delete_user',
    'create_product', 'edit_product', 'delete_product',
    'process_sale', 'view_sales', 'delete_sale',
    'add_expense', 'edit_expense', 'delete_expense',
    'view_reports', 'export_reports',
    'view_dashboard'
  ],
  Cashier: [
    'create_product', 'edit_product',
    'process_sale',
    'add_expense'
  ]
}

export function hasPermission(role: UserRole, permission: string): boolean {
  return permissions[role].includes(permission)
}

// Multi-Tenant Helper: Get store_id from current session
export function getStoreId(): number | null {
  if (typeof window === 'undefined') return null // Server-side
  
  // First, try to get directly from sessionStorage (for managers)
  const storeIdFromSession = sessionStorage.getItem('store_id')
  if (storeIdFromSession) {
    return parseInt(storeIdFromSession)
  }
  
  // Then check user_type to determine where to look
  const userType = sessionStorage.getItem('user_type')
  
  if (userType === 'Manager') {
    // For managers, get from sessionStorage
    const storeId = sessionStorage.getItem('store_id')
    return storeId ? parseInt(storeId) : null
  }
  
  // For cashiers, get from localStorage user_session
  const cashierSession = localStorage.getItem('user_session')
  if (cashierSession) {
    try {
      const cashierData = JSON.parse(cashierSession)
      return cashierData.store_id || null
    } catch {
      return null
    }
  }
  
  return null
}
