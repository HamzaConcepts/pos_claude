export interface Product {
  id: number
  sku: string
  name: string
  description: string | null
  category: string | null
  is_active: boolean
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
  price: number
  cost_price: number
  stock_quantity: number
  low_stock_threshold: number
  inventory?: Inventory[]
}

export interface Sale {
  id: number
  sale_number: string
  cashier_id: number
  total_amount: number
  payment_method: 'Cash' | 'Digital'
  payment_status: 'Paid' | 'Partial' | 'Pending'
  amount_paid: number
  amount_due: number
  sale_date: string
  notes: string | null
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
  recorded_by: number
  created_at: string
}

export interface Payment {
  id: number
  sale_id: number
  amount: number
  payment_method: string
  payment_date: string
  recorded_by: number
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
  monthlyExpenses: number
  netProfit: number
  lowStockCount: number
  lowStockProducts: ProductWithBackwardCompatibility[]
  recentSales: Sale[]
  topProducts: Array<{ product_name: string; revenue: number }>
  salesTrend: Array<{ date: string; revenue: number }>
}
