export interface Product {
  id: number
  name: string
  sku: string
  description: string | null
  price: number
  cost_price: number
  stock_quantity: number
  low_stock_threshold: number
  category: string | null
  created_at: string
  updated_at: string
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
  quantity: number
  unit_price: number
  subtotal: number
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
  lowStockProducts: Product[]
  recentSales: Sale[]
  topProducts: Array<{ product_name: string; revenue: number }>
  salesTrend: Array<{ date: string; revenue: number }>
}
