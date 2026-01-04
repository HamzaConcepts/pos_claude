-- Migration: Add Ledger Payment Tracking and Sales/Expense Deletion Features
-- Date: December 26, 2025
-- Description: 
--   1. Add payment tracking tables for customer and supplier dues
--   2. Add mark_for_review flag on sales table
--   3. Add triggers to handle stock reversion on sale deletion
--   4. Add triggers to handle expense deletion

-- =============================================
-- 1. Create customer_payments table for customer dues payments (partial_payment_customers)
-- =============================================

CREATE TABLE IF NOT EXISTS public.customer_payments (
  id SERIAL PRIMARY KEY,
  partial_payment_customer_id INTEGER NOT NULL,
  sale_id INTEGER,  -- Reference to the original sale
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(20),
  payment_amount NUMERIC(10, 2) NOT NULL CHECK (payment_amount > 0),
  payment_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(20) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Digital')),
  notes TEXT,
  store_id INTEGER NOT NULL,
  recorded_by UUID,  -- Manager who recorded the payment
  cashier_id INTEGER,  -- Or cashier who recorded it
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_customer_payment_partial_payment 
    FOREIGN KEY (partial_payment_customer_id) REFERENCES partial_payment_customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_payment_sale 
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_payment_store 
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
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

-- =============================================
-- 2. Create supplier_khaata_payments table for supplier dues payments
-- =============================================

CREATE TABLE IF NOT EXISTS public.supplier_khaata_payments (
  id SERIAL PRIMARY KEY,
  supplier_khaata_id INTEGER NOT NULL,
  supplier_name VARCHAR(100) NOT NULL,
  supplier_phone VARCHAR(20),
  payment_amount NUMERIC(10, 2) NOT NULL CHECK (payment_amount > 0),
  payment_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(20) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Digital')),
  notes TEXT,
  store_id INTEGER NOT NULL,
  recorded_by UUID,  -- Manager who recorded the payment
  cashier_id INTEGER,  -- Or cashier who recorded it
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_supplier_khaata_payment_supplier 
    FOREIGN KEY (supplier_khaata_id) REFERENCES supplier_khaata(id) ON DELETE CASCADE,
  CONSTRAINT fk_supplier_khaata_payment_store 
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT supplier_khaata_payments_recorder_check CHECK (
    (recorded_by IS NOT NULL AND cashier_id IS NULL) OR
    (recorded_by IS NULL AND cashier_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_supplier_khaata_payments_supplier_id ON public.supplier_khaata_payments(supplier_khaata_id);
CREATE INDEX IF NOT EXISTS idx_supplier_khaata_payments_store_id ON public.supplier_khaata_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_supplier_khaata_payments_date ON public.supplier_khaata_payments(payment_date DESC);

COMMENT ON TABLE supplier_khaata_payments IS 'Tracks supplier dues payments made on their khaata accounts';

-- =============================================
-- 3. Add mark_for_review columns to sales table
-- =============================================

ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS marked_for_review BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS marked_by_cashier_id INTEGER,
  ADD COLUMN IF NOT EXISTS marked_at TIMESTAMP WITHOUT TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_sales_marked_for_review ON public.sales(marked_for_review) WHERE marked_for_review = TRUE;

COMMENT ON COLUMN sales.marked_for_review IS 'Flag indicating if cashier marked this sale for manager review';
COMMENT ON COLUMN sales.review_reason IS 'Reason provided by cashier for marking the sale';
COMMENT ON COLUMN sales.marked_by_cashier_id IS 'Cashier who marked the sale for review';
COMMENT ON COLUMN sales.marked_at IS 'Timestamp when sale was marked for review';

-- =============================================
-- 4. Create trigger to handle stock reversion on sale deletion
-- =============================================

-- This function restores stock when a sale is deleted
CREATE OR REPLACE FUNCTION revert_sale_deletion()
RETURNS TRIGGER AS $$
DECLARE
  sale_item RECORD;
  batch_record RECORD;
  remaining_qty INTEGER;
BEGIN
  -- For each item in the deleted sale, restore stock
  FOR sale_item IN 
    SELECT si.product_id, si.quantity, si.product_sku
    FROM sale_items si
    WHERE si.sale_id = OLD.id
  LOOP
    -- Find the most recent depleted or partially depleted batch for this product
    -- to restore stock in FIFO reverse order
    remaining_qty := sale_item.quantity;
    
    FOR batch_record IN
      SELECT id, quantity_remaining, quantity_purchased
      FROM stock_batches
      WHERE product_id = sale_item.product_id 
        AND store_id = OLD.store_id
      ORDER BY purchase_date DESC
    LOOP
      EXIT WHEN remaining_qty <= 0;
      
      -- Restore stock to this batch
      UPDATE stock_batches
      SET 
        quantity_remaining = quantity_remaining + LEAST(remaining_qty, quantity_purchased - quantity_remaining),
        is_depleted = FALSE,
        depleted_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = batch_record.id;
      
      remaining_qty := remaining_qty - LEAST(remaining_qty, quantity_purchased - batch_record.quantity_remaining);
    END LOOP;
    
    -- Update product IMEIs if applicable
    UPDATE product_imeis
    SET 
      status = 'in_stock',
      sold_at = NULL,
      sale_id = NULL
    WHERE sale_id = OLD.id AND product_id = sale_item.product_id;
  END LOOP;
  
  -- Note: The sale_items will be automatically deleted by CASCADE
  -- The revenue adjustment should be done in the application layer
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_revert_sale_deletion ON sales;

-- Create the trigger
CREATE TRIGGER trigger_revert_sale_deletion
  BEFORE DELETE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION revert_sale_deletion();

COMMENT ON FUNCTION revert_sale_deletion() IS 'Restores stock quantities when a sale is deleted';

-- =============================================
-- 5. Enable RLS on new tables
-- =============================================

ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_khaata_payments ENABLE ROW LEVEL SECURITY;

-- Policies for customer_payments
CREATE POLICY customer_payments_select_policy ON public.customer_payments
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE created_by = auth.uid()
    )
  );

CREATE POLICY customer_payments_insert_policy ON public.customer_payments
  FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores WHERE created_by = auth.uid()
    )
  );

CREATE POLICY customer_payments_update_policy ON public.customer_payments
  FOR UPDATE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE created_by = auth.uid()
    )
  );

CREATE POLICY customer_payments_delete_policy ON public.customer_payments
  FOR DELETE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE created_by = auth.uid()
    )
  );

-- Policies for supplier_khaata_payments
CREATE POLICY supplier_khaata_payments_select_policy ON public.supplier_khaata_payments
  FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE created_by = auth.uid()
    )
  );

CREATE POLICY supplier_khaata_payments_insert_policy ON public.supplier_khaata_payments
  FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores WHERE created_by = auth.uid()
    )
  );

CREATE POLICY supplier_khaata_payments_update_policy ON public.supplier_khaata_payments
  FOR UPDATE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE created_by = auth.uid()
    )
  );

CREATE POLICY supplier_khaata_payments_delete_policy ON public.supplier_khaata_payments
  FOR DELETE
  USING (
    store_id IN (
      SELECT id FROM stores WHERE created_by = auth.uid()
    )
  );

-- =============================================
-- 6. Verification Queries
-- =============================================

-- Verify new tables were created
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('customer_payments', 'supplier_khaata_payments');

-- Verify new columns were added to sales table
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'sales' 
-- AND column_name IN ('marked_for_review', 'review_reason', 'marked_by_cashier_id', 'marked_at');

-- Verify trigger was created
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_name = 'trigger_revert_sale_deletion';
