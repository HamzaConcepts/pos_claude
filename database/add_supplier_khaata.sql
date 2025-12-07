-- Supplier Khaata (Supplier Accounts) Migration
-- This script creates the supplier_khaata table to track partial payments to suppliers
-- Similar to partial_payment_customers but for tracking money owed TO suppliers

-- =============================================
-- 1. Create supplier_khaata table
-- =============================================

CREATE TABLE IF NOT EXISTS public.supplier_khaata (
  id SERIAL PRIMARY KEY,
  stock_batch_id INTEGER NOT NULL,
  supplier_id INTEGER NOT NULL,
  supplier_name VARCHAR(100) NOT NULL,
  supplier_phone VARCHAR(20),
  supplier_contact VARCHAR(255),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  amount_remaining NUMERIC(10, 2) NOT NULL CHECK (amount_remaining >= 0),
  store_id INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_supplier_khaata_stock_batch 
    FOREIGN KEY (stock_batch_id) REFERENCES stock_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_supplier_khaata_supplier 
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  CONSTRAINT fk_supplier_khaata_store 
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- =============================================
-- 2. Create indexes for better query performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_supplier_khaata_store_id 
  ON public.supplier_khaata(store_id);

CREATE INDEX IF NOT EXISTS idx_supplier_khaata_supplier_id 
  ON public.supplier_khaata(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_khaata_stock_batch_id 
  ON public.supplier_khaata(stock_batch_id);

CREATE INDEX IF NOT EXISTS idx_supplier_khaata_supplier_phone 
  ON public.supplier_khaata(supplier_phone);

-- =============================================
-- 3. Create trigger to update updated_at timestamp
-- =============================================

CREATE OR REPLACE FUNCTION update_supplier_khaata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_supplier_khaata_updated_at
  BEFORE UPDATE ON supplier_khaata
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_khaata_updated_at();

-- =============================================
-- 4. Enable Row Level Security (RLS)
-- =============================================

ALTER TABLE public.supplier_khaata ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view supplier_khaata records for their store
CREATE POLICY supplier_khaata_select_policy ON public.supplier_khaata
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE created_by = auth.uid()
    )
  );

-- Policy: Users can only insert supplier_khaata records for their store
CREATE POLICY supplier_khaata_insert_policy ON public.supplier_khaata
  FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores WHERE created_by = auth.uid()
    )
  );

-- Policy: Users can only update supplier_khaata records for their store
CREATE POLICY supplier_khaata_update_policy ON public.supplier_khaata
  FOR UPDATE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE created_by = auth.uid()
    )
  );

-- Policy: Users can only delete supplier_khaata records for their store
CREATE POLICY supplier_khaata_delete_policy ON public.supplier_khaata
  FOR DELETE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE created_by = auth.uid()
    )
  );

-- =============================================
-- 5. Create a view for supplier khaata summary
-- =============================================

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

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Check if table was created
-- SELECT EXISTS (
--   SELECT FROM information_schema.tables 
--   WHERE table_schema = 'public' 
--   AND table_name = 'supplier_khaata'
-- );

-- Check indexes
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'supplier_khaata';

-- Check RLS policies
-- SELECT policyname, cmd FROM pg_policies 
-- WHERE tablename = 'supplier_khaata';

-- =============================================
-- ROLLBACK (if needed)
-- =============================================

-- DROP VIEW IF EXISTS supplier_khaata_summary;
-- DROP TRIGGER IF EXISTS trigger_update_supplier_khaata_updated_at ON supplier_khaata;
-- DROP FUNCTION IF EXISTS update_supplier_khaata_updated_at();
-- DROP TABLE IF EXISTS public.supplier_khaata CASCADE;
