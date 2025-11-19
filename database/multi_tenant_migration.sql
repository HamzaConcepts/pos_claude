-- Multi-Tenant Migration Script
-- This script adds multi-tenant store support to the POS system
-- Execute this AFTER taking full backup

-- ============================================================================
-- PHASE 1: Create New Tables and Functions
-- ============================================================================

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    store_code VARCHAR(3) UNIQUE NOT NULL,
    store_name VARCHAR(100) NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create join requests table
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
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP,
    notes TEXT
);

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

-- ============================================================================
-- PHASE 2: Add store_id Columns (Nullable First)
-- ============================================================================

-- Add store_id to managers
ALTER TABLE managers ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);

-- Add store_id to cashier_accounts
ALTER TABLE cashier_accounts ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);

-- Add store_id to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);

-- Add store_id to inventory
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);

-- Add store_id to sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);

-- Add store_id to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);

-- Add store_id to partial_payment_customers
ALTER TABLE partial_payment_customers ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);

-- Add store_id to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);

-- ============================================================================
-- PHASE 3: Migrate Existing Data
-- ============================================================================

-- Create default store from first manager's data
DO $$
DECLARE
    default_store_id INTEGER;
    default_store_code VARCHAR(3);
    first_manager_id UUID;
    first_store_name VARCHAR(100);
BEGIN
    -- Get first manager
    SELECT id, store_name INTO first_manager_id, first_store_name
    FROM managers
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Only proceed if there are existing managers
    IF first_manager_id IS NOT NULL THEN
        -- Generate store code
        default_store_code := generate_store_code();
        
        -- Use existing store_name or default
        IF first_store_name IS NULL OR first_store_name = '' THEN
            first_store_name := 'Default Store';
        END IF;
        
        -- Create default store
        INSERT INTO stores (store_code, store_name, created_by, created_at)
        VALUES (default_store_code, first_store_name, first_manager_id, NOW())
        RETURNING id INTO default_store_id;
        
        -- Assign all existing managers to default store
        UPDATE managers SET store_id = default_store_id WHERE store_id IS NULL;
        
        -- Assign all existing cashiers to default store
        UPDATE cashier_accounts SET store_id = default_store_id WHERE store_id IS NULL;
        
        -- Assign all existing products to default store
        UPDATE products SET store_id = default_store_id WHERE store_id IS NULL;
        
        -- Assign all existing inventory to default store
        UPDATE inventory SET store_id = default_store_id WHERE store_id IS NULL;
        
        -- Assign all existing sales to default store
        UPDATE sales SET store_id = default_store_id WHERE store_id IS NULL;
        
        -- Assign all existing expenses to default store
        UPDATE expenses SET store_id = default_store_id WHERE store_id IS NULL;
        
        -- Assign all existing partial payment customers to default store
        UPDATE partial_payment_customers SET store_id = default_store_id WHERE store_id IS NULL;
        
        -- Assign all existing payments to default store
        UPDATE payments SET store_id = default_store_id WHERE store_id IS NULL;
        
        RAISE NOTICE 'Created default store with code: %', default_store_code;
        RAISE NOTICE 'Migrated all existing data to store ID: %', default_store_id;
    ELSE
        RAISE NOTICE 'No existing managers found. Skipping default store creation.';
    END IF;
END $$;

-- ============================================================================
-- PHASE 4: Make store_id NOT NULL (After Migration)
-- ============================================================================

-- Make store_id NOT NULL for all tables
-- Only execute if migration was successful

-- ALTER TABLE managers ALTER COLUMN store_id SET NOT NULL;
-- ALTER TABLE cashier_accounts ALTER COLUMN store_id SET NOT NULL;
-- ALTER TABLE products ALTER COLUMN store_id SET NOT NULL;
-- ALTER TABLE inventory ALTER COLUMN store_id SET NOT NULL;
-- ALTER TABLE sales ALTER COLUMN store_id SET NOT NULL;
-- ALTER TABLE expenses ALTER COLUMN store_id SET NOT NULL;
-- ALTER TABLE partial_payment_customers ALTER COLUMN store_id SET NOT NULL;
-- ALTER TABLE payments ALTER COLUMN store_id SET NOT NULL;

-- ============================================================================
-- PHASE 5: Create Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_managers_store_id ON managers(store_id);
CREATE INDEX IF NOT EXISTS idx_cashier_accounts_store_id ON cashier_accounts(store_id);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_store_id ON inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_store_id ON expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_partial_payment_customers_store_id ON partial_payment_customers(store_id);
CREATE INDEX IF NOT EXISTS idx_payments_store_id ON payments(store_id);
CREATE INDEX IF NOT EXISTS idx_stores_code ON stores(store_code);
CREATE INDEX IF NOT EXISTS idx_join_requests_store_id ON join_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status);

-- ============================================================================
-- PHASE 6: Helper Functions
-- ============================================================================

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

-- Updated verify_cashier_login function to include store_id
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
        AND c.store_id IS NOT NULL; -- Only allow login if approved and assigned to store
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 7: Update RLS Policies for Multi-Tenant Isolation
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Authenticated users can view managers" ON managers;
DROP POLICY IF EXISTS "Managers can update their own data" ON managers;
DROP POLICY IF EXISTS "Anyone can create manager account" ON managers;
DROP POLICY IF EXISTS "Anyone can view cashier accounts" ON cashier_accounts;
DROP POLICY IF EXISTS "Anyone can create cashier account" ON cashier_accounts;
DROP POLICY IF EXISTS "Cashiers can update own data" ON cashier_accounts;
DROP POLICY IF EXISTS "Anyone authenticated can view products" ON products;
DROP POLICY IF EXISTS "Managers can insert products" ON products;
DROP POLICY IF EXISTS "Managers can update products" ON products;
DROP POLICY IF EXISTS "Managers can delete products" ON products;
DROP POLICY IF EXISTS "Anyone authenticated can view sales" ON sales;
DROP POLICY IF EXISTS "Anyone authenticated can create sales" ON sales;
DROP POLICY IF EXISTS "Anyone authenticated can view sale items" ON sale_items;
DROP POLICY IF EXISTS "Anyone authenticated can insert sale items" ON sale_items;
DROP POLICY IF EXISTS "Anyone authenticated can view expenses" ON expenses;
DROP POLICY IF EXISTS "Managers can insert expenses" ON expenses;
DROP POLICY IF EXISTS "Managers can update expenses" ON expenses;
DROP POLICY IF EXISTS "Managers can delete expenses" ON expenses;
DROP POLICY IF EXISTS "Anyone authenticated can view payments" ON payments;
DROP POLICY IF EXISTS "Anyone authenticated can insert payments" ON payments;

-- Enable RLS on new tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

-- Stores policies
CREATE POLICY "Users can view their own store" ON stores
    FOR SELECT 
    USING (id IN (
        SELECT store_id FROM managers WHERE id = auth.uid()
        UNION
        SELECT store_id FROM cashier_accounts WHERE store_id IS NOT NULL
    ));

CREATE POLICY "Managers can create stores" ON stores
    FOR INSERT 
    WITH CHECK (created_by = auth.uid());

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

-- Managers policies (store-scoped)
CREATE POLICY "Managers can view users in their store" ON managers
    FOR SELECT 
    USING (store_id = get_user_store_id() OR auth.uid() = id);

CREATE POLICY "Managers can update their own data" ON managers
    FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Anyone can create manager account" ON managers
    FOR INSERT 
    WITH CHECK (true);

-- Cashier accounts policies (store-scoped)
CREATE POLICY "Users can view cashiers in their store" ON cashier_accounts
    FOR SELECT 
    USING (store_id = get_user_store_id());

CREATE POLICY "Anyone can create cashier account" ON cashier_accounts
    FOR INSERT 
    WITH CHECK (true);

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

-- Sales policies (store-scoped)
CREATE POLICY "Users can view sales from their store" ON sales
    FOR SELECT 
    USING (store_id = get_user_store_id());

CREATE POLICY "Users can create sales in their store" ON sales
    FOR INSERT 
    WITH CHECK (store_id = get_user_store_id());

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
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if default store was created
SELECT * FROM stores;

-- Check if all tables have store_id populated
SELECT 'managers' as table_name, COUNT(*) as total, COUNT(store_id) as with_store_id FROM managers
UNION ALL
SELECT 'cashier_accounts', COUNT(*), COUNT(store_id) FROM cashier_accounts
UNION ALL
SELECT 'products', COUNT(*), COUNT(store_id) FROM products
UNION ALL
SELECT 'inventory', COUNT(*), COUNT(store_id) FROM inventory
UNION ALL
SELECT 'sales', COUNT(*), COUNT(store_id) FROM sales
UNION ALL
SELECT 'expenses', COUNT(*), COUNT(store_id) FROM expenses;

-- List all indexes
SELECT tablename, indexname FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE '%store%'
ORDER BY tablename, indexname;

RAISE NOTICE 'Multi-tenant migration completed successfully!';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. Verify all data has store_id assigned';
RAISE NOTICE '2. Test store isolation with multiple stores';
RAISE NOTICE '3. Update application code to include store_id in queries';
RAISE NOTICE '4. Uncomment and run Phase 4 to make store_id NOT NULL';
