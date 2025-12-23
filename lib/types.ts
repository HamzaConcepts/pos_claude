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
  quantity_added: number
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
  is_active: boolean
  created_at: string
  updated_at: string
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
  netProfit: number
  lowStockCount: number
  lowStockProducts: ProductWithBackwardCompatibility[]
  recentSales: Sale[]
  topProducts: Array<{ product_name: string; revenue: number }>
  salesTrend: Array<{ date: string; revenue: number }>
}
