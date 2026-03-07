-- ============================================================
-- POS SYSTEM - PRODUCTION READINESS MIGRATION
-- Based on Schema Audit (Feb 16, 2026)
-- Created: March 2, 2026
--
-- Run inside a transaction in Supabase SQL Editor.
-- Test on a staging DB first.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. FIX RACE CONDITION IN SALE NUMBER GENERATION
-- Adds advisory lock to prevent duplicate sale numbers
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_sale_number(p_store_id INTEGER) 
RETURNS INTEGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  -- Advisory lock scoped to transaction prevents concurrent duplicates
  PERFORM pg_advisory_xact_lock(p_store_id);
  
  SELECT COALESCE(MAX(sale_number_store), 0) + 1
  INTO next_number
  FROM sales
  WHERE store_id = p_store_id;
  
  RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. REMOVE BROKEN TRIGGER (calls non-existent function)
-- ============================================================
DROP TRIGGER IF EXISTS trigger_update_average_price ON stock_batches;
DROP FUNCTION IF EXISTS trigger_update_average_price();

-- ============================================================
-- 3. FIX PASSWORD HASHING TRIGGER TO COVER UPDATES
-- Without this, password updates store plain text
-- ============================================================
DROP TRIGGER IF EXISTS hash_cashier_password_trigger ON cashier_accounts;
CREATE TRIGGER hash_cashier_password_trigger 
  BEFORE INSERT OR UPDATE OF password_hash ON cashier_accounts
  FOR EACH ROW 
  EXECUTE FUNCTION hash_cashier_password();

-- ============================================================
-- 4. ENABLE RLS ON supplier_payments (was wide open)
-- ============================================================
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_payments_store_isolation" ON supplier_payments
  FOR ALL
  USING (store_id IN (
    SELECT store_id FROM managers WHERE id = auth.uid()
    UNION
    SELECT store_id FROM cashier_accounts 
    WHERE id::text = (auth.jwt() ->> 'sub')
  ));

-- ============================================================
-- 5. FIX customer_payments RLS (was using stores.created_by - 
--    only store creator could access, not other managers)
-- ============================================================
DROP POLICY IF EXISTS "customer_payments_select_policy" ON customer_payments;
DROP POLICY IF EXISTS "customer_payments_insert_policy" ON customer_payments;
DROP POLICY IF EXISTS "customer_payments_update_policy" ON customer_payments;
DROP POLICY IF EXISTS "customer_payments_delete_policy" ON customer_payments;

CREATE POLICY "customer_payments_select" ON customer_payments 
  FOR SELECT USING (store_id = get_user_store_id());
CREATE POLICY "customer_payments_insert" ON customer_payments 
  FOR INSERT WITH CHECK (store_id = get_user_store_id());
CREATE POLICY "customer_payments_update" ON customer_payments 
  FOR UPDATE USING (store_id = get_user_store_id());
CREATE POLICY "customer_payments_delete" ON customer_payments 
  FOR DELETE USING (store_id = get_user_store_id());

-- ============================================================
-- 6. FIX supplier_khaata RLS (same issue as customer_payments)
-- ============================================================
DROP POLICY IF EXISTS "supplier_khaata_select_policy" ON supplier_khaata;
DROP POLICY IF EXISTS "supplier_khaata_insert_policy" ON supplier_khaata;
DROP POLICY IF EXISTS "supplier_khaata_update_policy" ON supplier_khaata;
DROP POLICY IF EXISTS "supplier_khaata_delete_policy" ON supplier_khaata;

CREATE POLICY "supplier_khaata_select" ON supplier_khaata 
  FOR SELECT USING (store_id = get_user_store_id());
CREATE POLICY "supplier_khaata_insert" ON supplier_khaata 
  FOR INSERT WITH CHECK (store_id = get_user_store_id());
CREATE POLICY "supplier_khaata_update" ON supplier_khaata 
  FOR UPDATE USING (store_id = get_user_store_id());
CREATE POLICY "supplier_khaata_delete" ON supplier_khaata 
  FOR DELETE USING (store_id = get_user_store_id());

-- ============================================================
-- 7. FIX supplier_khaata_payments RLS
-- ============================================================
DROP POLICY IF EXISTS "supplier_khaata_payments_select_policy" ON supplier_khaata_payments;
DROP POLICY IF EXISTS "supplier_khaata_payments_insert_policy" ON supplier_khaata_payments;
DROP POLICY IF EXISTS "supplier_khaata_payments_update_policy" ON supplier_khaata_payments;
DROP POLICY IF EXISTS "supplier_khaata_payments_delete_policy" ON supplier_khaata_payments;

CREATE POLICY "supplier_khaata_payments_select" ON supplier_khaata_payments 
  FOR SELECT USING (store_id = get_user_store_id());
CREATE POLICY "supplier_khaata_payments_insert" ON supplier_khaata_payments 
  FOR INSERT WITH CHECK (store_id = get_user_store_id());
CREATE POLICY "supplier_khaata_payments_update" ON supplier_khaata_payments 
  FOR UPDATE USING (store_id = get_user_store_id());
CREATE POLICY "supplier_khaata_payments_delete" ON supplier_khaata_payments 
  FOR DELETE USING (store_id = get_user_store_id());

-- ============================================================
-- 8. FIX GLOBAL UNIQUENESS → PER-STORE UNIQUENESS
-- Cashier phone and product barcode should be unique per store
-- ============================================================
ALTER TABLE cashier_accounts DROP CONSTRAINT IF EXISTS cashier_accounts_phone_number_key;
ALTER TABLE cashier_accounts ADD CONSTRAINT cashier_accounts_store_phone_unique 
  UNIQUE (store_id, phone_number);

DROP INDEX IF EXISTS idx_products_barcode;
CREATE UNIQUE INDEX idx_products_barcode ON products (store_id, barcode) 
  WHERE (barcode IS NOT NULL);

-- ============================================================
-- 9. REVOKE EXCESSIVE ANON PERMISSIONS ON FINANCIAL TABLES
-- The anon role should not have access to financial data
-- ============================================================
REVOKE ALL ON TABLE sales FROM anon;
REVOKE ALL ON TABLE sale_items FROM anon;
REVOKE ALL ON TABLE expenses FROM anon;
REVOKE ALL ON TABLE payments FROM anon;
REVOKE ALL ON TABLE partial_payment_customers FROM anon;
REVOKE ALL ON TABLE customer_payments FROM anon;
REVOKE ALL ON TABLE supplier_khaata FROM anon;
REVOKE ALL ON TABLE supplier_khaata_payments FROM anon;
REVOKE ALL ON TABLE supplier_payments FROM anon;
REVOKE ALL ON TABLE owner_withdrawals FROM anon;
REVOKE ALL ON TABLE stock_batches FROM anon;
REVOKE ALL ON TABLE aggregated_stock FROM anon;
REVOKE ALL ON TABLE product_imeis FROM anon;

-- ============================================================
-- 10. CHANGE CRITICAL CASCADE DELETES TO RESTRICT
-- Financial records should not be deleted when parent is deleted
-- ============================================================
ALTER TABLE partial_payment_customers 
  DROP CONSTRAINT IF EXISTS partial_payment_customers_sale_id_fkey;
ALTER TABLE partial_payment_customers 
  ADD CONSTRAINT partial_payment_customers_sale_id_fkey 
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT;

ALTER TABLE supplier_khaata 
  DROP CONSTRAINT IF EXISTS fk_supplier_khaata_stock_batch;
ALTER TABLE supplier_khaata 
  ADD CONSTRAINT fk_supplier_khaata_stock_batch 
    FOREIGN KEY (stock_batch_id) REFERENCES stock_batches(id) ON DELETE RESTRICT;

-- ============================================================
-- 11. DROP DUPLICATE INDEXES (save storage, speed up writes)
-- ============================================================

-- Exact duplicates (safe to drop immediately)
DROP INDEX IF EXISTS idx_products_sku;
DROP INDEX IF EXISTS idx_sale_items_product;
DROP INDEX IF EXISTS idx_sale_items_sale;
DROP INDEX IF EXISTS idx_payments_sale;
DROP INDEX IF EXISTS idx_partial_payment_sale;

-- Prefix-redundant (covered by composite indexes)
DROP INDEX IF EXISTS idx_aggregated_stock_product_id;
DROP INDEX IF EXISTS idx_categories_store_id;
DROP INDEX IF EXISTS idx_subcategories_category_id;
DROP INDEX IF EXISTS idx_cashiers_store_id;
DROP INDEX IF EXISTS idx_payments_cashier_id;
DROP INDEX IF EXISTS idx_batches_supplier;
DROP INDEX IF EXISTS idx_imeis_imei;

-- ============================================================
-- 12. DROP REDUNDANT AGGREGATED STOCK TIMESTAMP TRIGGER
-- The update_aggregated_stock() function already sets updated_at
-- ============================================================
DROP TRIGGER IF EXISTS update_aggregated_stock_updated_at ON aggregated_stock;
DROP FUNCTION IF EXISTS update_aggregated_stock_timestamp();

-- ============================================================
-- 13. ADD MISSING PERFORMANCE INDEXES (from performance audit)
-- ============================================================

-- Products table indexes (HIGH PRIORITY - POS scans barcodes constantly)
CREATE INDEX IF NOT EXISTS idx_products_store_active ON products(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id, store_id);

-- Product IMEIs indexes (phone sales require fast IMEI lookup)
CREATE INDEX IF NOT EXISTS idx_product_imeis_number ON product_imeis(imei_number, store_id);
CREATE INDEX IF NOT EXISTS idx_product_imeis_status ON product_imeis(product_id, status);

-- Sales indexes (dashboard and reports query by date range)
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON sales(store_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id, store_id);

-- Stock batches indexes (FIFO deduction needs fast batch lookup)
CREATE INDEX IF NOT EXISTS idx_stock_batches_product ON stock_batches(product_id, is_depleted);
CREATE INDEX IF NOT EXISTS idx_stock_batches_store ON stock_batches(store_id, purchase_date DESC);

-- Partial payment customer indexes (khaata searches by phone)
CREATE INDEX IF NOT EXISTS idx_partial_payment_phone ON partial_payment_customers(customer_phone, store_id);
CREATE INDEX IF NOT EXISTS idx_partial_payment_store_date ON partial_payment_customers(store_id, created_at DESC);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_store_date ON payments(store_id, payment_date DESC);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON expenses(store_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_store_category ON expenses(store_id, category, expense_date DESC);

-- Missing indexes from audit
CREATE INDEX IF NOT EXISTS idx_supplier_payments_store_date ON supplier_payments(store_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_customer_payments_store ON customer_payments(store_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_quotations_store_number ON quotations(store_id, quotation_number);

COMMIT;

-- ============================================================
-- NOTES:
-- 
-- 1. The REVOKE statements will break code using the anon key 
--    to access financial tables directly. The app uses service 
--    role (supabaseAdmin) in API routes, so this should be fine.
--
-- 2. The CASCADE → RESTRICT changes mean deleting a sale that  
--    has partial payment records will fail. Use soft-delete 
--    (add deleted_at column) in the application instead.
--
-- 3. Test on staging first before applying to production.
-- ============================================================
