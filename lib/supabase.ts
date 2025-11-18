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
