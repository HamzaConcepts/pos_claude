-- POS System - Fresh Database Schema with Multi-Tenant Support
-- For new Supabase projects (no existing data)
-- Execute this entire file in Supabase SQL Editor

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For password hashing

-- ============================================================================
-- TABLES
-- ============================================================================

-- Stores Table (Multi-Tenant Core)
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    store_code VARCHAR(3) UNIQUE NOT NULL,
    store_name VARCHAR(100) NOT NULL,
    created_by UUID NOT NULL, -- Manager ID who created the store
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Managers Table (Supabase Auth users)
CREATE TABLE IF NOT EXISTS managers (
    id UUID PRIMARY KEY, -- Supabase Auth user ID (no FK constraint)
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(11) UNIQUE NOT NULL,
    store_name VARCHAR(100),
    store_id INTEGER REFERENCES stores(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Cashier Accounts Table (Direct DB Auth)
CREATE TABLE IF NOT EXISTS cashier_accounts (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(11) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'Cashier' CHECK (role = 'Cashier'),
    store_id INTEGER REFERENCES stores(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Join Requests Table (Approval Workflow)
CREATE TABLE IF NOT EXISTS join_requests (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('Manager', 'Cashier')),
    user_name VARCHAR(100) NOT NULL,
    user_phone VARCHAR(11) NOT NULL,
    user_email VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID, -- Manager ID who reviewed (no FK constraint)
    reviewed_at TIMESTAMP,
    notes TEXT
);

-- Products Table (Master Catalog)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    store_id INTEGER NOT NULL REFERENCES stores(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sku, store_id) -- Same SKU can exist in different stores
);

-- Inventory Table (Stock Management with FIFO)
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    cost_price DECIMAL(10, 2) NOT NULL CHECK (cost_price >= 0),
    selling_price DECIMAL(10, 2) NOT NULL CHECK (selling_price >= 0),
    quantity_added INTEGER NOT NULL CHECK (quantity_added >= 0),
    quantity_remaining INTEGER NOT NULL DEFAULT 0 CHECK (quantity_remaining >= 0),
    low_stock_threshold INTEGER DEFAULT 10 CHECK (low_stock_threshold >= 0),
    batch_number VARCHAR(50),
    restock_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    sale_number VARCHAR(50) NOT NULL,
    sale_description VARCHAR(255),
    cashier_id UUID,
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
    payment_method VARCHAR(20) CHECK (payment_method IN ('Cash', 'Digital')),
    payment_status VARCHAR(20) CHECK (payment_status IN ('Paid', 'Partial', 'Pending')),
    amount_paid DECIMAL(10, 2) DEFAULT 0 CHECK (amount_paid >= 0),
    amount_due DECIMAL(10, 2) DEFAULT 0 CHECK (amount_due >= 0),
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    notes TEXT,
    UNIQUE(sale_number, store_id) -- Same sale number can exist in different stores
);

-- Sale Items Table (Transaction History)
CREATE TABLE IF NOT EXISTS sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_sku VARCHAR(50) NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    cost_price_snapshot DECIMAL(10, 2) CHECK (cost_price_snapshot >= 0),
    subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
    category VARCHAR(50),
    expense_date DATE NOT NULL,
    recorded_by UUID,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partial Payment Customers Table
CREATE TABLE IF NOT EXISTS partial_payment_customers (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    customer_name VARCHAR(100) NOT NULL,
    customer_cnic VARCHAR(20),
    customer_phone VARCHAR(20),
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
    amount_paid DECIMAL(10, 2) NOT NULL CHECK (amount_paid >= 0),
    amount_remaining DECIMAL(10, 2) NOT NULL CHECK (amount_remaining >= 0),
    store_id INTEGER NOT NULL REFERENCES stores(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES sales(id),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
    payment_method VARCHAR(20),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    manager_id UUID,  -- For managers
    cashier_id INTEGER,  -- For cashiers
    store_id INTEGER NOT NULL REFERENCES stores(id),
    CHECK ((manager_id IS NOT NULL AND cashier_id IS NULL) OR (manager_id IS NULL AND cashier_id IS NOT NULL))
);

-- ============================================================================
-- INDEXES (Performance Optimization)
-- ============================================================================

-- Stores indexes
CREATE INDEX IF NOT EXISTS idx_stores_code ON stores(store_code);
CREATE INDEX IF NOT EXISTS idx_stores_created_by ON stores(created_by);

-- Managers indexes
CREATE INDEX IF NOT EXISTS idx_managers_store_id ON managers(store_id);
CREATE INDEX IF NOT EXISTS idx_managers_phone ON managers(phone_number);

-- Cashier accounts indexes
CREATE INDEX IF NOT EXISTS idx_cashier_store_id ON cashier_accounts(store_id);
CREATE INDEX IF NOT EXISTS idx_cashier_phone ON cashier_accounts(phone_number);
CREATE INDEX IF NOT EXISTS idx_cashier_name ON cashier_accounts(full_name);

-- Join requests indexes
CREATE INDEX IF NOT EXISTS idx_join_requests_store_id ON join_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status);
CREATE INDEX IF NOT EXISTS idx_join_requests_user_id ON join_requests(user_id);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_sku_store ON products(sku, store_id);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_store_id ON inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity_remaining ON inventory(quantity_remaining);
CREATE INDEX IF NOT EXISTS idx_inventory_restock_date ON inventory(restock_date);

-- Sales indexes
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_number_store ON sales(sale_number, store_id);

-- Sale items indexes
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_store_id ON expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_recorded_by ON expenses(recorded_by);

-- Partial payment customers indexes
CREATE INDEX IF NOT EXISTS idx_partial_payment_store_id ON partial_payment_customers(store_id);
CREATE INDEX IF NOT EXISTS idx_partial_payment_sale_id ON partial_payment_customers(sale_id);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_store_id ON payments(store_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for products table
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for inventory table
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Store code generator function
CREATE OR REPLACE FUNCTION generate_store_code()
RETURNS VARCHAR(3) AS $$
DECLARE
    code VARCHAR(3);
    chars VARCHAR(36) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    is_unique BOOLEAN := FALSE;
BEGIN
    WHILE NOT is_unique LOOP
        code := '';
        FOR i IN 1..3 LOOP
            code := code || substr(chars, floor(random() * 36 + 1)::integer, 1);
        END LOOP;
        
        SELECT NOT EXISTS (SELECT 1 FROM stores WHERE store_code = code) INTO is_unique;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Cashier login verification function
CREATE OR REPLACE FUNCTION verify_cashier_login(
    identifier TEXT,
    password_input TEXT
)
RETURNS TABLE (
    id INTEGER,
    full_name VARCHAR(100),
    phone_number VARCHAR(11),
    store_id INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.full_name,
        c.phone_number,
        c.store_id
    FROM cashier_accounts c
    WHERE 
        (c.full_name ILIKE '%' || identifier || '%' OR c.phone_number = identifier)
        AND c.password_hash = crypt(password_input, c.password_hash)
        AND c.is_active = true
        AND c.store_id IS NOT NULL; -- Only allow login if assigned to store
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's store_id
CREATE OR REPLACE FUNCTION get_user_store_id()
RETURNS INTEGER AS $$
DECLARE
    user_store_id INTEGER;
BEGIN
    -- Try to get from managers table (Supabase Auth users)
    SELECT store_id INTO user_store_id 
    FROM managers 
    WHERE id = auth.uid();
    
    RETURN user_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to hash cashier passwords on insert
CREATE OR REPLACE FUNCTION hash_cashier_password()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.password_hash IS NOT NULL AND NEW.password_hash NOT LIKE '$2%' THEN
        NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hash_cashier_password_trigger
    BEFORE INSERT ON cashier_accounts
    FOR EACH ROW
    EXECUTE FUNCTION hash_cashier_password();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashier_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE partial_payment_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Stores policies
CREATE POLICY "Users can view their own store" ON stores
    FOR SELECT 
    USING (id IN (
        SELECT store_id FROM managers WHERE id = auth.uid()
    ));

CREATE POLICY "Managers can create stores" ON stores
    FOR INSERT 
    WITH CHECK (created_by = auth.uid());

-- Managers policies
CREATE POLICY "Managers can view users in their store" ON managers
    FOR SELECT 
    USING (store_id = get_user_store_id() OR auth.uid() = id);

CREATE POLICY "Managers can update their own data" ON managers
    FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Anyone can create manager account" ON managers
    FOR INSERT 
    WITH CHECK (true);

-- Cashier accounts policies
CREATE POLICY "Users can view cashiers in their store" ON cashier_accounts
    FOR SELECT 
    USING (store_id = get_user_store_id());

CREATE POLICY "Anyone can create cashier account" ON cashier_accounts
    FOR INSERT 
    WITH CHECK (true);

-- Join requests policies
CREATE POLICY "Managers can view join requests for their store" ON join_requests
    FOR SELECT 
    USING (store_id IN (SELECT store_id FROM managers WHERE id = auth.uid()));

CREATE POLICY "Anyone can create join request" ON join_requests
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Managers can update join requests for their store" ON join_requests
    FOR UPDATE 
    USING (store_id IN (SELECT store_id FROM managers WHERE id = auth.uid()));

-- Products policies (store-scoped)
CREATE POLICY "Users can view products from their store" ON products
    FOR SELECT 
    USING (store_id = get_user_store_id());

CREATE POLICY "Users can insert products to their store" ON products
    FOR INSERT 
    WITH CHECK (store_id = get_user_store_id());

CREATE POLICY "Users can update products in their store" ON products
    FOR UPDATE 
    USING (store_id = get_user_store_id());

CREATE POLICY "Users can delete products in their store" ON products
    FOR DELETE 
    USING (store_id = get_user_store_id());

-- Inventory policies (store-scoped)
CREATE POLICY "Users can view inventory from their store" ON inventory
    FOR SELECT 
    USING (store_id = get_user_store_id());

CREATE POLICY "Users can insert inventory to their store" ON inventory
    FOR INSERT 
    WITH CHECK (store_id = get_user_store_id());

CREATE POLICY "Users can update inventory in their store" ON inventory
    FOR UPDATE 
    USING (store_id = get_user_store_id());

CREATE POLICY "Users can delete inventory in their store" ON inventory
    FOR DELETE 
    USING (store_id = get_user_store_id());

-- Sales policies (store-scoped)
CREATE POLICY "Users can view sales from their store" ON sales
    FOR SELECT 
    USING (store_id = get_user_store_id());

CREATE POLICY "Users can create sales in their store" ON sales
    FOR INSERT 
    WITH CHECK (store_id = get_user_store_id());

CREATE POLICY "Users can update sales in their store" ON sales
    FOR UPDATE 
    USING (store_id = get_user_store_id());

-- Sale items policies (store-scoped via sales)
CREATE POLICY "Users can view sale items from their store" ON sale_items
    FOR SELECT 
    USING (sale_id IN (SELECT id FROM sales WHERE store_id = get_user_store_id()));

CREATE POLICY "Users can insert sale items to their store sales" ON sale_items
    FOR INSERT 
    WITH CHECK (sale_id IN (SELECT id FROM sales WHERE store_id = get_user_store_id()));

-- Expenses policies (store-scoped)
CREATE POLICY "Users can view expenses from their store" ON expenses
    FOR SELECT 
    USING (store_id = get_user_store_id());

CREATE POLICY "Managers can insert expenses to their store" ON expenses
    FOR INSERT 
    WITH CHECK (store_id = get_user_store_id());

CREATE POLICY "Managers can update expenses in their store" ON expenses
    FOR UPDATE 
    USING (store_id = get_user_store_id());

CREATE POLICY "Managers can delete expenses in their store" ON expenses
    FOR DELETE 
    USING (store_id = get_user_store_id());

-- Partial payment customers policies (store-scoped)
CREATE POLICY "Users can view partial payment customers from their store" ON partial_payment_customers
    FOR SELECT 
    USING (store_id = get_user_store_id());

CREATE POLICY "Users can insert partial payment customers to their store" ON partial_payment_customers
    FOR INSERT 
    WITH CHECK (store_id = get_user_store_id());

CREATE POLICY "Users can update partial payment customers in their store" ON partial_payment_customers
    FOR UPDATE 
    USING (store_id = get_user_store_id());

-- Payments policies (store-scoped)
CREATE POLICY "Users can view payments from their store" ON payments
    FOR SELECT 
    USING (store_id = get_user_store_id());

CREATE POLICY "Users can insert payments to their store" ON payments
    FOR INSERT 
    WITH CHECK (store_id = get_user_store_id());

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- List all indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database schema created successfully!';
    RAISE NOTICE 'Tables created: 11';
    RAISE NOTICE 'Indexes created: 30+';
    RAISE NOTICE 'Functions created: 5';
    RAISE NOTICE 'RLS policies: Multi-tenant isolation enabled';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Configure environment variables in .env.local';
    RAISE NOTICE '2. Run npm run dev';
    RAISE NOTICE '3. Sign up first manager to create first store';
    RAISE NOTICE '4. Save the store code for your employees';
END $$;
