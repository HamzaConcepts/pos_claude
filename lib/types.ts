export interface Product {
  id: number
  sku: string
  name: string
  description: string | null
  category: string | null
  store_id: number
  is_active: boolean
  created_at: string
  updated_at: string
  category_id: number | null
  subcategory_id: number | null
  is_phone: boolean
}

export interface AggregatedStock {
  id: number
  product_id: number
  store_id: number
  aggregated_cost_price: number
  aggregated_selling_price: number
  aggregated_lowest_negotiable: number
  total_quantity_purchased: number
  total_quantity_remaining: number
  total_quantity_sold: number
  low_stock_threshold: number
  created_at: string
  updated_at: string
}

export interface Inventory {
  id: number
  product_id: number
  cost_price: number
  selling_price: number
  quantity_purchased: number
  quantity_remaining: number
  low_stock_threshold: number
  batch_number: string | null
  restock_date: string
  store_id: number
  notes: string | null
  created_at: string
  updated_at: string
  products?: Product
}

export interface ProductWithInventory extends Product {
  inventory: Inventory[]
  total_stock: number
  current_selling_price: number
  current_cost_price: number
}

// Backward compatible type for API responses
export interface ProductWithBackwardCompatibility extends Product {
  // Category info
  category_name?: string | null
  subcategory_name?: string | null
  
  // Stock info from aggregated_stock
  stock_quantity: number
  low_stock_threshold: number
  
  // Relations
  inventory?: Inventory[]
  batches?: StockBatch[]
  aggregated_stock?: AggregatedStock
}

export interface StockBatch {
  id: number
  product_id: number
  store_id: number
  supplier_id: number | null
  batch_number: string | null
  purchase_date: string
  cost_price: number
  selling_price: number | null
  lowest_negotiable_price: number | null
  quantity_purchased: number
  quantity_remaining: number
  is_depleted: boolean
  depleted_at: string | null
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: number
  store_id: number
  supplier_name: string
  phone_number: string
  email: string | null
  address: string | null
  notes: string | null
  balance_owed: number
  initial_balance: number
  last_payment_date: string | null
  total_paid: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SupplierPayment {
  id: number
  supplier_id: number
  store_id: number
  amount: number
  payment_method: 'Cash' | 'Digital'
  payment_date: string
  recorded_by_manager_id: string | null
  recorded_by_cashier_id: number | null
  notes: string | null
  created_at: string
}

export interface Category {
  id: number
  name: string
  description: string | null
  store_id: number
  requires_imei: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  subcategories?: Subcategory[]
}

export interface Subcategory {
  id: number
  category_id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface ProductIMEI {
  id: number
  product_id: number
  batch_id: number | null
  store_id: number
  imei_number: string
  status: 'in_stock' | 'sold' | 'returned' | 'defective'
  sold_at: string | null
  sale_id: number | null
  created_at: string
  updated_at: string
}

export interface Sale {
  id: number
  sale_number: string
  sale_description: string | null
  cashier_id: string | null
  total_amount: number
  payment_method: 'Cash' | 'Digital'
  payment_status: 'Paid' | 'Partial' | 'Pending'
  amount_paid: number
  amount_due: number
  sale_date: string
  store_id: number
  notes: string | null
  discount_type: 'percentage' | 'amount' | 'none'
  discount_value: number
}

export interface PartialPaymentCustomer {
  id: number
  sale_id: number
  customer_name: string
  customer_cnic: string | null
  customer_phone: string | null
  total_amount: number
  amount_paid: number
  amount_remaining: number
  store_id: number
  created_at: string
  updated_at: string
}

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number
  product_sku: string
  product_name: string
  quantity: number
  unit_price: number
  cost_price_snapshot: number | null
  subtotal: number
  created_at: string
  products?: Product
}

export interface Expense {
  id: number
  description: string
  amount: number
  category: string | null
  payment_method: 'Cash' | 'Digital'
  expense_date: string
  recorded_by: string | null
  store_id: number
  created_at: string
}

export interface Cashier {
  id: number
  store_id: number
  full_name: string
  phone_number: string
  commission_rate: number
  salary: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Payment {
  id: number
  sale_id: number | null
  amount: number
  payment_method: string | null
  payment_date: string
  manager_id: string | null
  cashier_id: number | null
  store_id: number
}

export interface DashboardStats {
  todaySales: {
    count: number
    revenue: number
  }
  monthlySales: {
    count: number
    revenue: number
  }
  todayExpenses: number
  monthlyExpenses: number
  expensesByCategory: Array<{ category: string; total: number }>
  monthlyCOGS: number
  grossProfit: number
  netProfit: number
  lowStockCount: number
  lowStockProducts: ProductWithBackwardCompatibility[]
  recentSales: Sale[]
  topProducts: Array<{ product_name: string; revenue: number }>
  salesTrend: Array<{ date: string; revenue: number }>
}

// ===== Receipt Printing Types =====

export type ReceiptFormat = 'pdf' | 'thermal'
export type ThermalPaperWidth = '58mm' | '80mm'

export interface ReceiptSettings {
  id: number
  store_id: number
  // Store/Business Information
  business_name: string
  business_address: string | null
  business_phone: string | null
  business_email: string | null
  tax_id: string | null
  logo_url: string | null
  // Receipt Preferences
  default_format: ReceiptFormat
  thermal_paper_width: ThermalPaperWidth
  auto_print: boolean
  show_logo: boolean
  show_tax_id: boolean
  // Footer Messages
  thank_you_message: string
  return_policy: string | null
  // Created/Updated
  created_at: string
  updated_at: string
}

export interface ReceiptData {
  // Sale Info
  sale_number: string
  sale_date: string
  cashier_name: string | null
  payment_method: 'Cash' | 'Digital'
  payment_status: 'Paid' | 'Partial' | 'Pending'
  // Currency
  currency?: string
  // Amounts
  subtotal: number
  discount_type: 'percentage' | 'amount' | 'none'
  discount_value: number
  total_amount: number
  amount_paid: number
  amount_due: number
  change_given: number
  // Items
  items: ReceiptItem[]
  // Customer Info (optional)
  customer_name?: string | null
  customer_phone?: string | null
  customer_cnic?: string | null
  // Partial Payment Customer
  partial_customer?: {
    name: string
    phone: string
    amount_remaining: number
  } | null
  // Store Settings
  settings: ReceiptSettings
}

export interface ReceiptItem {
  name: string
  quantity: number
  unit_price: number
  subtotal: number
}

// ===== Quotation Management Types =====

export interface Quotation {
  id: number
  quotation_number: string
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  customer_address: string | null
  subtotal: number
  discount_type: 'none' | 'fixed' | 'percentage'
  discount_value: number
  discount_amount: number
  total: number
  notes: string | null
  terms_and_conditions: string | null
  valid_until: string | null
  status: 'draft' | 'finalized' | 'expired' | 'cancelled'
  store_id: number
  created_by: string | null
  created_by_cashier_id: number | null
  created_at: string
  updated_at: string
  finalized_at: string | null
  finalized_by: string | null
  finalized_by_cashier_id: number | null
  deleted_at: string | null
  deleted_by: string | null
  deleted_by_cashier_id: number | null
  // Nested relations
  quotation_items?: QuotationItem[]
}

export interface QuotationItem {
  id: number
  quotation_id: number
  product_id: number | null
  product_name: string
  product_sku: string | null
  product_description: string | null
  product_category: string | null
  quantity: number
  unit_price: number
  line_total: number
  discount_amount: number
  notes: string | null
  sort_order: number
  is_manual_item: boolean
  created_at: string
  updated_at: string
}

export interface QuotationAuditLog {
  id: number
  quotation_id: number
  action: string
  user_id: string | null
  cashier_id: number | null
  changes: Record<string, unknown> | null
  created_at: string
}

export interface QuotationFormItem {
  id?: number
  product_id: number | null
  product_name: string
  product_sku: string
  product_description: string
  product_category: string
  quantity: number
  unit_price: number
  line_total: number
  is_manual_item: boolean
  notes: string
  sort_order: number
  // Client-side only fields
  temp_id?: string
  stock_available?: number
}

export interface QuotationFormData {
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_address: string
  valid_until: string
  notes: string
  terms_and_conditions: string
  discount_type: 'none' | 'fixed' | 'percentage'
  discount_value: number
  items: QuotationFormItem[]
}

export interface QuotationPDFData {
  quotation: Quotation
  items: QuotationItem[]
  store_name: string
  store_address: string | null
  store_phone: string | null
  store_email: string | null
  currency: string
  logo_url: string | null
}
