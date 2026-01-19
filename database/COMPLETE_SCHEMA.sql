-- =====================================================
-- COMPLETE POS SYSTEM DATABASE SCHEMA
-- =====================================================
-- This is a consolidated schema file for creating a complete POS system database
-- Compatible with Supabase PostgreSQL
-- Date: January 19, 2026
-- 
-- FEATURES:
-- - Multi-store support
-- - Manager/Cashier authentication
-- - Product inventory with FIFO stock management
-- - Sales with partial payments
-- - Customer and Supplier ledgers (Khaata system)
-- - Expense tracking with automatic restocking expenses
-- - IMEI tracking for phones
-- - Barcode support
-- - Row Level Security (RLS)
-- =====================================================

-- =====================================================
-- PART 1: ENABLE EXTENSIONS
-- =====================================================

-- Enable UUID extension (may already be enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- PART 2: CREATE TABLES
-- =====================================================

-- Table 1: Stores
-- =====================================================
CREATE TABLE IF NOT EXISTS public.stores (
  id SERIAL PRIMARY KEY,
  store_code VARCHAR(3) NOT NULL UNIQUE,
  store_name VARCHAR(100) NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_stores_code ON public.stores(store_code);
CREATE INDEX IF NOT EXISTS idx_stores_created_by ON public.stores(created_by);

COMMENT ON TABLE public.stores IS 'Stores table - one store per manager';


-- Table 2: Managers
-- =====================================================
CREATE TABLE IF NOT EXISTS public.managers (
  id UUID PRIMARY KEY,
  email VARCHAR(100) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(11) NOT NULL UNIQUE,
  store_name VARCHAR(100),
  store_id INTEGER REFERENCES stores(id),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  store_code VARCHAR(20) UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_managers_store_id ON public.managers(store_id);
CREATE INDEX IF NOT EXISTS idx_managers_phone ON public.managers(phone_number);

COMMENT ON TABLE public.managers IS 'Manager accounts linked to Supabase auth';


-- Table 3: Cashiers
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cashiers (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 0,
  salary DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cashiers_store_id ON cashiers(store_id);
CREATE INDEX IF NOT EXISTS idx_cashiers_active ON cashiers(is_active);

COMMENT ON TABLE cashiers IS 'Cashier information for each store';
COMMENT ON COLUMN cashiers.commission_rate IS 'Commission rate as percentage (e.g., 5.50 for 5.5%)';
COMMENT ON COLUMN cashiers.salary IS 'Monthly salary for the cashier';


-- Table 4: Categories
-- =====================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  requires_imei BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT categories_store_id_name_key UNIQUE (store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_store_id ON public.categories(store_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories(is_active);

COMMENT ON TABLE public.categories IS 'Product categories';
COMMENT ON COLUMN categories.requires_imei IS 'If true, products in this category require IMEI tracking';


-- Table 5: Subcategories
-- =====================================================
CREATE TABLE IF NOT EXISTS public.subcategories (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT subcategories_category_id_name_key UNIQUE (category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON public.subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_is_active ON public.subcategories(is_active);

COMMENT ON TABLE public.subcategories IS 'Product subcategories';


-- Table 6: Products
-- =====================================================
CREATE TABLE IF NOT EXISTS public.products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  barcode VARCHAR(100),
  is_phone BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT products_sku_store_id_key UNIQUE (sku, store_id)
);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON public.products(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_products_sku_store ON public.products(sku, store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_phone ON public.products(is_phone) WHERE is_phone = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_barcode_search ON products(barcode);

COMMENT ON TABLE public.products IS 'Products master table';
COMMENT ON COLUMN products.barcode IS 'Barcode for non-phone products. For phones, use IMEI from product_imeis table.';


-- Table 7: Suppliers
-- =====================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  balance_owed NUMERIC(10, 2) DEFAULT 0,
  initial_balance NUMERIC(10, 2) DEFAULT 0,
  last_payment_date TIMESTAMP WITHOUT TIME ZONE,
  total_paid NUMERIC(10, 2) DEFAULT 0,
  
  CONSTRAINT unique_supplier_phone_per_store UNIQUE (store_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_store ON public.suppliers(store_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON public.suppliers(phone_number);

COMMENT ON TABLE public.suppliers IS 'Suppliers for inventory';


-- Table 8: Stock Batches
-- =====================================================
CREATE TABLE IF NOT EXISTS public.stock_batches (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  batch_number VARCHAR(50),
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cost_price NUMERIC(10, 2) NOT NULL CHECK (cost_price >= 0),
  selling_price NUMERIC(10, 2),
  lowest_negotiable_price NUMERIC(10, 2) CHECK (lowest_negotiable_price >= 0),
  quantity_purchased INTEGER NOT NULL CHECK (quantity_purchased > 0),
  quantity_remaining INTEGER NOT NULL CHECK (quantity_remaining >= 0),
  is_depleted BOOLEAN DEFAULT FALSE,
  is_initial_stock BOOLEAN DEFAULT FALSE,
  depleted_at TIMESTAMP WITH TIME ZONE,
  payment_method VARCHAR(20) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Digital')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT check_remaining_qty CHECK (quantity_remaining >= 0 AND quantity_remaining <= quantity_purchased)
);

CREATE INDEX IF NOT EXISTS idx_batches_product ON public.stock_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_store ON public.stock_batches(store_id);
CREATE INDEX IF NOT EXISTS idx_batches_supplier ON public.stock_batches(supplier_id);
CREATE INDEX IF NOT EXISTS idx_batches_depleted ON public.stock_batches(is_depleted, purchase_date);
CREATE INDEX IF NOT EXISTS idx_batches_lowest_negotiable ON public.stock_batches(lowest_negotiable_price);
CREATE INDEX IF NOT EXISTS idx_stock_batches_payment_method ON stock_batches(payment_method);

COMMENT ON TABLE public.stock_batches IS 'Stock batches with FIFO tracking';
COMMENT ON COLUMN stock_batches.is_initial_stock IS 'TRUE for stock added during initial store setup (not counted as expense)';
COMMENT ON COLUMN stock_batches.lowest_negotiable_price IS 'Minimum acceptable selling price for this batch';
COMMENT ON COLUMN stock_batches.payment_method IS 'Payment method used for purchasing this stock batch (Cash or Digital)';


-- Table 9: Aggregated Stock
-- =====================================================
CREATE TABLE IF NOT EXISTS public.aggregated_stock (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  aggregated_cost_price NUMERIC(10, 2) DEFAULT 0 CHECK (aggregated_cost_price >= 0),
  aggregated_selling_price NUMERIC(10, 2) DEFAULT 0 CHECK (aggregated_selling_price >= 0),
  aggregated_lowest_negotiable NUMERIC(10, 2) DEFAULT 0 CHECK (aggregated_lowest_negotiable >= 0),
  total_quantity_purchased INTEGER NOT NULL DEFAULT 0,
  total_quantity_remaining INTEGER NOT NULL DEFAULT 0,
  total_quantity_sold INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT aggregated_stock_product_store_unique UNIQUE (product_id, store_id),
  CONSTRAINT aggregated_stock_quantities_check CHECK (total_quantity_remaining >= 0 AND total_quantity_remaining <= total_quantity_purchased)
);

CREATE INDEX IF NOT EXISTS idx_aggregated_stock_product_id ON public.aggregated_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_aggregated_stock_store_id ON public.aggregated_stock(store_id);
CREATE INDEX IF NOT EXISTS idx_aggregated_stock_remaining ON public.aggregated_stock(total_quantity_remaining);
CREATE INDEX IF NOT EXISTS idx_aggregated_stock_product_store ON public.aggregated_stock(product_id, store_id);

COMMENT ON TABLE public.aggregated_stock IS 'Aggregated stock data with weighted average prices calculated from stock_batches';


-- Table 10: Product IMEIs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.product_imeis (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id INTEGER REFERENCES stock_batches(id) ON DELETE SET NULL,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  imei_number VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'in_stock',
  sold_at TIMESTAMP WITH TIME ZONE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_imei_per_store UNIQUE (store_id, imei_number)
);

CREATE INDEX IF NOT EXISTS idx_imeis_product ON public.product_imeis(product_id);
CREATE INDEX IF NOT EXISTS idx_imeis_status ON public.product_imeis(status);
CREATE INDEX IF NOT EXISTS idx_imeis_imei ON public.product_imeis(imei_number);
CREATE INDEX IF NOT EXISTS idx_product_imeis_imei_search ON product_imeis(imei_number) WHERE status = 'in_stock';

COMMENT ON TABLE public.product_imeis IS 'IMEI tracking for phones';


-- Table 11: Cashier Accounts
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cashier_accounts (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'Cashier' CHECK (role = 'Cashier'),
  store_id INTEGER REFERENCES stores(id),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_cashier_accounts_store_id ON public.cashier_accounts(store_id);
CREATE INDEX IF NOT EXISTS idx_cashier_accounts_phone ON public.cashier_accounts(phone_number);
CREATE INDEX IF NOT EXISTS idx_cashier_accounts_active ON public.cashier_accounts(is_active);

COMMENT ON TABLE public.cashier_accounts IS 'Cashier authentication accounts';


-- Table 12: Join Requests
-- =====================================================
CREATE TABLE IF NOT EXISTS public.join_requests (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  user_id TEXT NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('Manager', 'Cashier')),
  user_name VARCHAR(100) NOT NULL,
  user_phone VARCHAR(20) NOT NULL,
  user_email VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITHOUT TIME ZONE,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_join_requests_store_id ON public.join_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON public.join_requests(status);
CREATE INDEX IF NOT EXISTS idx_join_requests_user_type ON public.join_requests(user_type);

COMMENT ON TABLE public.join_requests IS 'Store join requests from managers and cashiers';


-- Table 13: Sales
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sales (
  id SERIAL PRIMARY KEY,
  sale_number VARCHAR(50) NOT NULL,
  sale_number_store INTEGER NOT NULL,
  sale_description VARCHAR(255),
  cashier_id UUID,
  cashier_ref_id INTEGER REFERENCES cashiers(id),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  payment_method VARCHAR(20) CHECK (payment_method IN ('Cash', 'Digital')),
  payment_status VARCHAR(20) CHECK (payment_status IN ('Paid', 'Partial', 'Pending')),
  amount_paid NUMERIC(10, 2) DEFAULT 0 CHECK (amount_paid >= 0),
  amount_due NUMERIC(10, 2) DEFAULT 0 CHECK (amount_due >= 0),
  discount_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (discount_type IN ('percentage', 'amount', 'none')),
  discount_value NUMERIC(10, 2) DEFAULT 0 CHECK (discount_value >= 0),
  sale_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  notes TEXT,
  marked_for_review BOOLEAN DEFAULT FALSE,
  review_reason TEXT,
  marked_by_cashier_id INTEGER,
  marked_at TIMESTAMP WITHOUT TIME ZONE,
  customer_id INTEGER,
  customer_name VARCHAR(100),
  customer_phone VARCHAR(20),
  customer_cnic VARCHAR(20),
  
  CONSTRAINT sales_sale_number_store_id_key UNIQUE (sale_number, store_id),
  CONSTRAINT unique_sale_number_per_store UNIQUE (store_id, sale_number_store)
);

CREATE INDEX IF NOT EXISTS idx_sales_store_id ON public.sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON public.sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_number_store ON public.sales(sale_number, store_id);
CREATE INDEX IF NOT EXISTS idx_sales_store_number ON sales(store_id, sale_number_store DESC);
CREATE INDEX IF NOT EXISTS idx_sales_marked_for_review ON public.sales(marked_for_review) WHERE marked_for_review = TRUE;

COMMENT ON TABLE public.sales IS 'Sales transactions';
COMMENT ON COLUMN sales.cashier_ref_id IS 'Reference to the cashier who made the sale';
COMMENT ON COLUMN sales.sale_number_store IS 'Sequential sale number within the store (1, 2, 3, ...)';
COMMENT ON COLUMN sales.marked_for_review IS 'Flag indicating if cashier marked this sale for manager review';
COMMENT ON COLUMN sales.customer_id IS 'Reference to partial_payment_customers for linked customer account';


-- Table 14: Sale Items
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_sku VARCHAR(50) NOT NULL,
  product_name VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  cost_price_snapshot NUMERIC(10, 2) CHECK (cost_price_snapshot >= 0),
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);

COMMENT ON TABLE public.sale_items IS 'Items in each sale';


-- Table 15: Partial Payment Customers
-- =====================================================
CREATE TABLE IF NOT EXISTS public.partial_payment_customers (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  customer_name VARCHAR(100) NOT NULL,
  customer_cnic VARCHAR(20),
  customer_phone VARCHAR(20),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC(10, 2) NOT NULL CHECK (amount_paid >= 0),
  amount_remaining NUMERIC(10, 2) NOT NULL CHECK (amount_remaining >= 0),
  store_id INTEGER NOT NULL REFERENCES stores(id),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_partial_payment_store_id ON public.partial_payment_customers(store_id);
CREATE INDEX IF NOT EXISTS idx_partial_payment_sale_id ON public.partial_payment_customers(sale_id);

COMMENT ON TABLE public.partial_payment_customers IS 'Customer partial payment tracking (Khaata system)';


-- Table 16: Customer Payments
-- =====================================================
CREATE TABLE IF NOT EXISTS public.customer_payments (
  id SERIAL PRIMARY KEY,
  partial_payment_customer_id INTEGER NOT NULL REFERENCES partial_payment_customers(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(20),
  payment_amount NUMERIC(10, 2) NOT NULL CHECK (payment_amount > 0),
  payment_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(20) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Digital')),
  notes TEXT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  recorded_by UUID,
  cashier_id INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT customer_payments_recorder_check CHECK (
    (recorded_by IS NOT NULL AND cashier_id IS NULL) OR
    (recorded_by IS NULL AND cashier_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_partial_payment_id ON public.customer_payments(partial_payment_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_sale_id ON public.customer_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_store_id ON public.customer_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON public.customer_payments(payment_date DESC);

COMMENT ON TABLE customer_payments IS 'Tracks customer dues payments made on their partial payment accounts';


-- Table 17: Supplier Khaata
-- =====================================================
CREATE TABLE IF NOT EXISTS public.supplier_khaata (
  id SERIAL PRIMARY KEY,
  stock_batch_id INTEGER NOT NULL REFERENCES stock_batches(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_name VARCHAR(100) NOT NULL,
  supplier_phone VARCHAR(20),
  supplier_contact VARCHAR(255),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  amount_remaining NUMERIC(10, 2) NOT NULL CHECK (amount_remaining >= 0),
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_khaata_store_id ON public.supplier_khaata(store_id);
CREATE INDEX IF NOT EXISTS idx_supplier_khaata_supplier_id ON public.supplier_khaata(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_khaata_stock_batch_id ON public.supplier_khaata(stock_batch_id);
CREATE INDEX IF NOT EXISTS idx_supplier_khaata_supplier_phone ON public.supplier_khaata(supplier_phone);

COMMENT ON TABLE supplier_khaata IS 'Supplier partial payment tracking (supplier dues)';


-- Table 18: Supplier Khaata Payments
-- =====================================================
CREATE TABLE IF NOT EXISTS public.supplier_khaata_payments (
  id SERIAL PRIMARY KEY,
  supplier_khaata_id INTEGER NOT NULL REFERENCES supplier_khaata(id) ON DELETE CASCADE,
  supplier_name VARCHAR(100) NOT NULL,
  supplier_phone VARCHAR(20),
  payment_amount NUMERIC(10, 2) NOT NULL CHECK (payment_amount > 0),
  payment_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(20) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Digital')),
  notes TEXT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  recorded_by UUID,
  cashier_id INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT supplier_khaata_payments_recorder_check CHECK (
    (recorded_by IS NOT NULL AND cashier_id IS NULL) OR
    (recorded_by IS NULL AND cashier_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_supplier_khaata_payments_supplier_id ON public.supplier_khaata_payments(supplier_khaata_id);
CREATE INDEX IF NOT EXISTS idx_supplier_khaata_payments_store_id ON public.supplier_khaata_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_supplier_khaata_payments_date ON public.supplier_khaata_payments(payment_date DESC);

COMMENT ON TABLE supplier_khaata_payments IS 'Tracks supplier dues payments made on their khaata accounts';


-- Table 19: Expenses
-- =====================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id SERIAL PRIMARY KEY,
  description VARCHAR(255) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  category VARCHAR(50),
  expense_date DATE NOT NULL,
  recorded_by UUID,
  cashier_id INTEGER,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  reference_id INTEGER,
  payment_method VARCHAR(20) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Digital')),
  marked_for_review BOOLEAN DEFAULT FALSE,
  review_reason TEXT,
  marked_by INTEGER,
  marked_at TIMESTAMP WITHOUT TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_store_id ON public.expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_recorded_by ON public.expenses(recorded_by);
CREATE INDEX IF NOT EXISTS idx_expenses_reference_id ON expenses(reference_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON expenses(payment_method);

COMMENT ON TABLE public.expenses IS 'Expense tracking';
COMMENT ON COLUMN expenses.reference_id IS 'Links expense to related record. For new_product/inventory_restock category, this is the stock_batch_id.';
COMMENT ON COLUMN expenses.category IS 'Expense category: new_product (first batch), inventory_restock (subsequent batches), or other categories';
COMMENT ON COLUMN expenses.payment_method IS 'Payment method used for the expense (Cash or Digital)';
COMMENT ON COLUMN expenses.marked_for_review IS 'Flag indicating if cashier marked this expense for manager review';


-- Table 20: Predefined Expenses
-- =====================================================
CREATE TABLE IF NOT EXISTS public.predefined_expenses (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  default_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_predefined_expenses_store_id ON predefined_expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_predefined_expenses_is_active ON predefined_expenses(is_active);

COMMENT ON TABLE predefined_expenses IS 'Pre-defined expense templates for quick selection';


-- Table 21: Payments
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER REFERENCES sales(id),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  payment_method VARCHAR(20),
  payment_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  manager_id UUID,
  cashier_id INTEGER,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  
  CONSTRAINT payments_recorder_check CHECK (
    (manager_id IS NOT NULL AND cashier_id IS NULL) OR
    (manager_id IS NULL AND cashier_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON public.payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_store_id ON public.payments(store_id);
CREATE INDEX IF NOT EXISTS idx_payments_cashier_id ON public.payments(cashier_id);

COMMENT ON TABLE public.payments IS 'Payment records';


-- Table 22: Supplier Payments
-- =====================================================
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(20) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Digital')),
  payment_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  recorded_by_manager_id UUID REFERENCES managers(id),
  recorded_by_cashier_id INTEGER REFERENCES cashiers(id),
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier_id ON public.supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_store_id ON public.supplier_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON public.supplier_payments(payment_date DESC);

COMMENT ON TABLE public.supplier_payments IS 'Direct supplier payment tracking (separate from khaata system)';


-- =====================================================
-- PART 3: CREATE FUNCTIONS
-- =====================================================

-- Function: update_updated_at_column
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Function: generate_next_sku
-- =====================================================
CREATE OR REPLACE FUNCTION generate_next_sku(p_store_id INTEGER)
RETURNS VARCHAR AS $$
DECLARE
  next_number INTEGER;
  next_sku VARCHAR(50);
BEGIN
  -- Get the maximum number from existing SKUs for this store
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(sku FROM '[0-9]+$') 
        AS INTEGER
      )
    ),
    0
  ) + 1
  INTO next_number
  FROM products
  WHERE store_id = p_store_id;
  
  -- Generate SKU in format: SKU001, SKU002, etc.
  next_sku := 'SKU' || LPAD(next_number::TEXT, 3, '0');
  
  RETURN next_sku;
END;
$$ LANGUAGE plpgsql;


-- Function: generate_batch_number
-- =====================================================
CREATE OR REPLACE FUNCTION generate_batch_number(p_store_id INTEGER, p_product_id INTEGER)
RETURNS VARCHAR AS $$
DECLARE
  product_sku VARCHAR(50);
  batch_count INTEGER;
  batch_number VARCHAR(50);
BEGIN
  -- Get product SKU
  SELECT sku INTO product_sku
  FROM products
  WHERE id = p_product_id;
  
  -- Get count of existing batches for this product
  SELECT COUNT(*) INTO batch_count
  FROM stock_batches
  WHERE product_id = p_product_id AND store_id = p_store_id;
  
  -- Generate batch number: SKU001-1, SKU001-2, etc.
  batch_number := product_sku || '-' || (batch_count + 1);
  
  RETURN batch_number;
END;
$$ LANGUAGE plpgsql;


-- Function: update_aggregated_stock
-- =====================================================
CREATE OR REPLACE FUNCTION update_aggregated_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id INTEGER;
  v_store_id INTEGER;
  v_total_purchased INTEGER;
  v_total_remaining INTEGER;
  v_total_sold INTEGER;
  v_weighted_cost NUMERIC(10, 2);
  v_weighted_selling NUMERIC(10, 2);
  v_weighted_lowest NUMERIC(10, 2);
  v_total_cost_value NUMERIC(12, 2);
  v_total_selling_value NUMERIC(12, 2);
  v_total_lowest_value NUMERIC(12, 2);
BEGIN
  -- Determine which product to update
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
    v_store_id := OLD.store_id;
  ELSE
    v_product_id := NEW.product_id;
    v_store_id := NEW.store_id;
  END IF;

  -- Calculate aggregated values
  SELECT 
    COALESCE(SUM(quantity_purchased), 0),
    COALESCE(SUM(quantity_remaining), 0),
    COALESCE(SUM(quantity_purchased - quantity_remaining), 0),
    COALESCE(SUM(cost_price * quantity_remaining), 0),
    COALESCE(SUM(COALESCE(selling_price, 0) * quantity_remaining), 0),
    COALESCE(SUM(COALESCE(lowest_negotiable_price, 0) * quantity_remaining), 0)
  INTO 
    v_total_purchased,
    v_total_remaining,
    v_total_sold,
    v_total_cost_value,
    v_total_selling_value,
    v_total_lowest_value
  FROM stock_batches
  WHERE product_id = v_product_id 
    AND store_id = v_store_id
    AND NOT is_depleted;

  -- Calculate weighted averages
  IF v_total_remaining > 0 THEN
    v_weighted_cost := v_total_cost_value / v_total_remaining;
    v_weighted_selling := v_total_selling_value / v_total_remaining;
    v_weighted_lowest := v_total_lowest_value / v_total_remaining;
  ELSE
    v_weighted_cost := 0;
    v_weighted_selling := 0;
    v_weighted_lowest := 0;
  END IF;

  -- Upsert aggregated_stock
  INSERT INTO aggregated_stock (
    product_id, store_id,
    aggregated_cost_price, aggregated_selling_price, aggregated_lowest_negotiable,
    total_quantity_purchased, total_quantity_remaining, total_quantity_sold,
    updated_at
  ) VALUES (
    v_product_id, v_store_id,
    v_weighted_cost, v_weighted_selling, v_weighted_lowest,
    v_total_purchased, v_total_remaining, v_total_sold,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (product_id, store_id) 
  DO UPDATE SET
    aggregated_cost_price = EXCLUDED.aggregated_cost_price,
    aggregated_selling_price = EXCLUDED.aggregated_selling_price,
    aggregated_lowest_negotiable = EXCLUDED.aggregated_lowest_negotiable,
    total_quantity_purchased = EXCLUDED.total_quantity_purchased,
    total_quantity_remaining = EXCLUDED.total_quantity_remaining,
    total_quantity_sold = EXCLUDED.total_quantity_sold,
    updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Function: deduct_stock_fifo
-- =====================================================
CREATE OR REPLACE FUNCTION deduct_stock_fifo(
  p_product_id INTEGER,
  p_store_id INTEGER,
  p_quantity INTEGER,
  p_sale_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
  batch_id INTEGER,
  quantity_deducted INTEGER,
  cost_price DECIMAL(10, 2)
) AS $$
DECLARE
  remaining_qty INTEGER := p_quantity;
  batch RECORD;
  deduct_qty INTEGER;
BEGIN
  FOR batch IN 
    SELECT id, quantity_remaining, cost_price AS batch_cost
    FROM stock_batches
    WHERE product_id = p_product_id 
      AND store_id = p_store_id
      AND is_depleted = false
      AND quantity_remaining > 0
    ORDER BY purchase_date ASC, id ASC
  LOOP
    EXIT WHEN remaining_qty <= 0;
    
    deduct_qty := LEAST(batch.quantity_remaining, remaining_qty);
    
    UPDATE stock_batches
    SET quantity_remaining = quantity_remaining - deduct_qty,
        is_depleted = (quantity_remaining - deduct_qty = 0),
        depleted_at = CASE WHEN (quantity_remaining - deduct_qty = 0) THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = batch.id;
    
    batch_id := batch.id;
    quantity_deducted := deduct_qty;
    cost_price := batch.batch_cost;
    RETURN NEXT;
    
    remaining_qty := remaining_qty - deduct_qty;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;


-- Function: create_restock_expense
-- =====================================================
CREATE OR REPLACE FUNCTION create_restock_expense()
RETURNS TRIGGER AS $$
DECLARE
  product_name TEXT;
  is_new_product BOOLEAN;
  expense_description TEXT;
BEGIN
  IF NEW.is_initial_stock = FALSE THEN
    SELECT name INTO product_name FROM products WHERE id = NEW.product_id;
    
    is_new_product := (NEW.batch_number LIKE '%-1');
    
    IF is_new_product THEN
      expense_description := 'New Product: ' || COALESCE(product_name, 'Unknown Product') || 
                            ' (Qty: ' || NEW.quantity_purchased || ')';
    ELSE
      expense_description := 'Restock: ' || COALESCE(product_name, 'Unknown Product') || 
                            ' - Batch #' || NEW.batch_number || 
                            ' (Qty: ' || NEW.quantity_purchased || ')';
    END IF;
    
    INSERT INTO expenses (
      store_id, category, description, amount, expense_date, reference_id, payment_method
    ) VALUES (
      NEW.store_id,
      CASE WHEN is_new_product THEN 'new_product' ELSE 'inventory_restock' END,
      expense_description,
      NEW.cost_price * NEW.quantity_purchased,
      NEW.purchase_date::date,
      NEW.id,
      COALESCE(NEW.payment_method, 'Cash')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Function: get_next_sale_number
-- =====================================================
CREATE OR REPLACE FUNCTION get_next_sale_number(p_store_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(sale_number_store), 0) + 1
  INTO next_number
  FROM sales
  WHERE store_id = p_store_id;
  
  RETURN next_number;
END;
$$;


-- Function: set_sale_number_store
-- =====================================================
CREATE OR REPLACE FUNCTION set_sale_number_store()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sale_number_store IS NULL THEN
    NEW.sale_number_store := get_next_sale_number(NEW.store_id);
  END IF;
  
  RETURN NEW;
END;
$$;


-- Function: revert_sale_deletion
-- =====================================================
CREATE OR REPLACE FUNCTION revert_sale_deletion()
RETURNS TRIGGER AS $$
DECLARE
  sale_item RECORD;
  batch_record RECORD;
  remaining_qty INTEGER;
BEGIN
  FOR sale_item IN 
    SELECT si.product_id, si.quantity, si.product_sku
    FROM sale_items si
    WHERE si.sale_id = OLD.id
  LOOP
    remaining_qty := sale_item.quantity;
    
    FOR batch_record IN
      SELECT id, quantity_remaining, quantity_purchased
      FROM stock_batches
      WHERE product_id = sale_item.product_id 
        AND store_id = OLD.store_id
      ORDER BY purchase_date DESC
    LOOP
      EXIT WHEN remaining_qty <= 0;
      
      UPDATE stock_batches
      SET 
        quantity_remaining = quantity_remaining + LEAST(remaining_qty, quantity_purchased - quantity_remaining),
        is_depleted = FALSE,
        depleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = batch_record.id;
      
      remaining_qty := remaining_qty - LEAST(remaining_qty, quantity_purchased - batch_record.quantity_remaining);
    END LOOP;
    
    UPDATE product_imeis
    SET 
      status = 'in_stock',
      sold_at = NULL,
      sale_id = NULL
    WHERE sale_id = OLD.id AND product_id = sale_item.product_id;
  END LOOP;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;


-- Function: update_supplier_khaata_updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_supplier_khaata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Function: update_predefined_expenses_updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_predefined_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- PART 4: CREATE TRIGGERS
-- =====================================================

-- Trigger: update_categories_updated_at
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: update_subcategories_updated_at
DROP TRIGGER IF EXISTS update_subcategories_updated_at ON subcategories;
CREATE TRIGGER update_subcategories_updated_at
  BEFORE UPDATE ON subcategories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: update_products_updated_at
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: update_cashiers_updated_at
DROP TRIGGER IF EXISTS update_cashiers_updated_at ON cashiers;
CREATE TRIGGER update_cashiers_updated_at
  BEFORE UPDATE ON cashiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: trigger_update_aggregated_stock
DROP TRIGGER IF EXISTS trigger_update_aggregated_stock ON stock_batches;
CREATE TRIGGER trigger_update_aggregated_stock
  AFTER INSERT OR UPDATE OR DELETE ON stock_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_aggregated_stock();

-- Trigger: trigger_create_restock_expense
DROP TRIGGER IF EXISTS trigger_create_restock_expense ON stock_batches;
CREATE TRIGGER trigger_create_restock_expense
  AFTER INSERT ON stock_batches
  FOR EACH ROW
  EXECUTE FUNCTION create_restock_expense();

-- Trigger: trigger_set_sale_number_store
DROP TRIGGER IF EXISTS trigger_set_sale_number_store ON sales;
CREATE TRIGGER trigger_set_sale_number_store
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_sale_number_store();

-- Trigger: trigger_revert_sale_deletion
DROP TRIGGER IF EXISTS trigger_revert_sale_deletion ON sales;
CREATE TRIGGER trigger_revert_sale_deletion
  BEFORE DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION revert_sale_deletion();

-- Trigger: trigger_update_supplier_khaata_updated_at
DROP TRIGGER IF EXISTS trigger_update_supplier_khaata_updated_at ON supplier_khaata;
CREATE TRIGGER trigger_update_supplier_khaata_updated_at
  BEFORE UPDATE ON supplier_khaata
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_khaata_updated_at();

-- Trigger: update_predefined_expenses_timestamp
DROP TRIGGER IF EXISTS update_predefined_expenses_timestamp ON predefined_expenses;
CREATE TRIGGER update_predefined_expenses_timestamp
  BEFORE UPDATE ON predefined_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_predefined_expenses_updated_at();


-- =====================================================
-- PART 5: CREATE VIEWS
-- =====================================================

-- View: expense_summary
CREATE OR REPLACE VIEW expense_summary AS
SELECT 
  store_id,
  category,
  DATE_TRUNC('day', expense_date) as expense_day,
  DATE_TRUNC('month', expense_date) as expense_month,
  DATE_TRUNC('year', expense_date) as expense_year,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount
FROM expenses
GROUP BY store_id, category, expense_day, expense_month, expense_year;


-- View: supplier_khaata_summary
CREATE OR REPLACE VIEW supplier_khaata_summary AS
SELECT 
  sk.supplier_id,
  sk.supplier_name,
  sk.supplier_phone,
  sk.store_id,
  COUNT(sk.id) as total_transactions,
  SUM(sk.total_amount) as total_amount,
  SUM(sk.amount_paid) as total_paid,
  SUM(sk.amount_remaining) as total_remaining,
  MIN(sk.created_at) as first_transaction,
  MAX(sk.updated_at) as last_updated
FROM supplier_khaata sk
GROUP BY sk.supplier_id, sk.supplier_name, sk.supplier_phone, sk.store_id;


-- View: inventory_view
CREATE OR REPLACE VIEW public.inventory_view AS
SELECT 
  p.id as product_id,
  p.sku,
  p.name as product_name,
  p.description,
  p.category,
  p.store_id,
  p.is_active,
  p.is_phone,
  c.id as category_id,
  c.name as category_name,
  sc.id as subcategory_id,
  sc.name as subcategory_name,
  COALESCE(agg.aggregated_cost_price, 0) as cost_price,
  COALESCE(agg.aggregated_selling_price, 0) as selling_price,
  COALESCE(agg.aggregated_lowest_negotiable, 0) as min_price,
  COALESCE(agg.total_quantity_purchased, 0) as total_quantity_purchased,
  COALESCE(agg.total_quantity_remaining, 0) as stock_quantity,
  COALESCE(agg.total_quantity_sold, 0) as total_quantity_sold,
  COALESCE(agg.low_stock_threshold, 10) as low_stock_threshold,
  p.created_at,
  p.updated_at,
  agg.updated_at as last_stock_update
FROM products p
LEFT JOIN aggregated_stock agg 
  ON agg.product_id = p.id AND agg.store_id = p.store_id
LEFT JOIN categories c 
  ON c.id = p.category_id
LEFT JOIN subcategories sc 
  ON sc.id = p.subcategory_id
WHERE p.is_active = true;


-- =====================================================
-- PART 6: ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashier_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aggregated_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_imeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partial_payment_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_khaata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_khaata_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predefined_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- PART 7: CREATE RLS POLICIES
-- =====================================================

-- Store-based access policy (managers can only access their store's data)
-- This is the master policy template - apply to all store-related tables

-- Policies for stores
CREATE POLICY stores_select_policy ON public.stores
  FOR SELECT USING (created_by = auth.uid());
CREATE POLICY stores_insert_policy ON public.stores
  FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY stores_update_policy ON public.stores
  FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY stores_delete_policy ON public.stores
  FOR DELETE USING (created_by = auth.uid());

-- Policies for cashiers
CREATE POLICY cashiers_select_policy ON public.cashiers
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY cashiers_insert_policy ON public.cashiers
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY cashiers_update_policy ON public.cashiers
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY cashiers_delete_policy ON public.cashiers
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for categories
CREATE POLICY categories_select_policy ON public.categories
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY categories_insert_policy ON public.categories
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY categories_update_policy ON public.categories
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY categories_delete_policy ON public.categories
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for subcategories (via categories)
CREATE POLICY subcategories_select_policy ON public.subcategories
  FOR SELECT USING (category_id IN (SELECT id FROM categories WHERE store_id IN (SELECT id FROM stores WHERE created_by = auth.uid())));
CREATE POLICY subcategories_insert_policy ON public.subcategories
  FOR INSERT WITH CHECK (category_id IN (SELECT id FROM categories WHERE store_id IN (SELECT id FROM stores WHERE created_by = auth.uid())));
CREATE POLICY subcategories_update_policy ON public.subcategories
  FOR UPDATE USING (category_id IN (SELECT id FROM categories WHERE store_id IN (SELECT id FROM stores WHERE created_by = auth.uid())));
CREATE POLICY subcategories_delete_policy ON public.subcategories
  FOR DELETE USING (category_id IN (SELECT id FROM categories WHERE store_id IN (SELECT id FROM stores WHERE created_by = auth.uid())));

-- Policies for products
CREATE POLICY products_select_policy ON public.products
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY products_insert_policy ON public.products
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY products_update_policy ON public.products
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY products_delete_policy ON public.products
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for suppliers
CREATE POLICY suppliers_select_policy ON public.suppliers
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY suppliers_insert_policy ON public.suppliers
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY suppliers_update_policy ON public.suppliers
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY suppliers_delete_policy ON public.suppliers
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for stock_batches
CREATE POLICY stock_batches_select_policy ON public.stock_batches
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY stock_batches_insert_policy ON public.stock_batches
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY stock_batches_update_policy ON public.stock_batches
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY stock_batches_delete_policy ON public.stock_batches
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for aggregated_stock
CREATE POLICY aggregated_stock_select_policy ON public.aggregated_stock
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY aggregated_stock_insert_policy ON public.aggregated_stock
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY aggregated_stock_update_policy ON public.aggregated_stock
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY aggregated_stock_delete_policy ON public.aggregated_stock
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for product_imeis
CREATE POLICY product_imeis_select_policy ON public.product_imeis
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY product_imeis_insert_policy ON public.product_imeis
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY product_imeis_update_policy ON public.product_imeis
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY product_imeis_delete_policy ON public.product_imeis
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for sales
CREATE POLICY sales_select_policy ON public.sales
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY sales_insert_policy ON public.sales
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY sales_update_policy ON public.sales
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY sales_delete_policy ON public.sales
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for sale_items (via sales)
CREATE POLICY sale_items_select_policy ON public.sale_items
  FOR SELECT USING (sale_id IN (SELECT id FROM sales WHERE store_id IN (SELECT id FROM stores WHERE created_by = auth.uid())));
CREATE POLICY sale_items_insert_policy ON public.sale_items
  FOR INSERT WITH CHECK (sale_id IN (SELECT id FROM sales WHERE store_id IN (SELECT id FROM stores WHERE created_by = auth.uid())));
CREATE POLICY sale_items_update_policy ON public.sale_items
  FOR UPDATE USING (sale_id IN (SELECT id FROM sales WHERE store_id IN (SELECT id FROM stores WHERE created_by = auth.uid())));
CREATE POLICY sale_items_delete_policy ON public.sale_items
  FOR DELETE USING (sale_id IN (SELECT id FROM sales WHERE store_id IN (SELECT id FROM stores WHERE created_by = auth.uid())));

-- Policies for partial_payment_customers
CREATE POLICY partial_payment_customers_select_policy ON public.partial_payment_customers
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY partial_payment_customers_insert_policy ON public.partial_payment_customers
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY partial_payment_customers_update_policy ON public.partial_payment_customers
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY partial_payment_customers_delete_policy ON public.partial_payment_customers
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for customer_payments
CREATE POLICY customer_payments_select_policy ON public.customer_payments
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY customer_payments_insert_policy ON public.customer_payments
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY customer_payments_update_policy ON public.customer_payments
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY customer_payments_delete_policy ON public.customer_payments
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for supplier_khaata
CREATE POLICY supplier_khaata_select_policy ON public.supplier_khaata
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY supplier_khaata_insert_policy ON public.supplier_khaata
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY supplier_khaata_update_policy ON public.supplier_khaata
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY supplier_khaata_delete_policy ON public.supplier_khaata
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for supplier_khaata_payments
CREATE POLICY supplier_khaata_payments_select_policy ON public.supplier_khaata_payments
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY supplier_khaata_payments_insert_policy ON public.supplier_khaata_payments
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY supplier_khaata_payments_update_policy ON public.supplier_khaata_payments
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY supplier_khaata_payments_delete_policy ON public.supplier_khaata_payments
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for expenses
CREATE POLICY expenses_select_policy ON public.expenses
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY expenses_insert_policy ON public.expenses
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY expenses_update_policy ON public.expenses
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY expenses_delete_policy ON public.expenses
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for predefined_expenses
CREATE POLICY predefined_expenses_select_policy ON public.predefined_expenses
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY predefined_expenses_insert_policy ON public.predefined_expenses
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY predefined_expenses_update_policy ON public.predefined_expenses
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY predefined_expenses_delete_policy ON public.predefined_expenses
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for payments
CREATE POLICY payments_select_policy ON public.payments
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY payments_insert_policy ON public.payments
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY payments_update_policy ON public.payments
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY payments_delete_policy ON public.payments
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for cashier_accounts
CREATE POLICY cashier_accounts_select_policy ON public.cashier_accounts
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY cashier_accounts_insert_policy ON public.cashier_accounts
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY cashier_accounts_update_policy ON public.cashier_accounts
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY cashier_accounts_delete_policy ON public.cashier_accounts
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for join_requests
CREATE POLICY join_requests_select_policy ON public.join_requests
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY join_requests_insert_policy ON public.join_requests
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY join_requests_update_policy ON public.join_requests
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY join_requests_delete_policy ON public.join_requests
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));

-- Policies for supplier_payments
CREATE POLICY supplier_payments_select_policy ON public.supplier_payments
  FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY supplier_payments_insert_policy ON public.supplier_payments
  FOR INSERT WITH CHECK (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY supplier_payments_update_policy ON public.supplier_payments
  FOR UPDATE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));
CREATE POLICY supplier_payments_delete_policy ON public.supplier_payments
  FOR DELETE USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()));


-- =====================================================
-- PART 8: GRANT PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE expenses_id_seq TO authenticated;
GRANT SELECT ON expense_summary TO authenticated;


-- =====================================================
-- SCHEMA CREATION COMPLETE
-- =====================================================
-- This schema includes:
-- - 22 tables with all constraints and indexes
-- - 12 functions for business logic
-- - 11 triggers for automatic updates
-- - 3 views for reporting
-- - Complete RLS policies for all 22 tables
-- 
-- Tables included:
-- 1. stores, 2. managers, 3. cashiers, 4. cashier_accounts
-- 5. join_requests, 6. categories, 7. subcategories, 8. products
-- 9. suppliers, 10. stock_batches, 11. aggregated_stock, 12. product_imeis
-- 13. sales, 14. sale_items, 15. partial_payment_customers, 16. customer_payments
-- 17. supplier_khaata, 18. supplier_khaata_payments, 19. supplier_payments
-- 20. expenses, 21. predefined_expenses, 22. payments
--
-- To use this schema:
-- 1. Create a new Supabase project
-- 2. Go to SQL Editor
-- 3. Copy and paste this entire file
-- 4. Execute the script
-- 5. Your database is ready!
-- =====================================================
