-- Migration: Enhance Expense Tracking with Payment Method and Product Details
-- This adds:
-- 1. Payment method (Cash/Digital) tracking for expenses
-- 2. Better product description in expenses (product name instead of batch number)
-- 3. Payment method for stock batch purchases

-- Step 1: Add payment_method column to stock_batches table
ALTER TABLE stock_batches 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Digital'));

CREATE INDEX IF NOT EXISTS idx_stock_batches_payment_method ON stock_batches(payment_method);

COMMENT ON COLUMN stock_batches.payment_method IS 'Payment method used for purchasing this stock batch (Cash or Digital)';

-- Step 2: Ensure expenses table has payment_method (should already exist from previous migration)
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Digital'));

-- Step 3: Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_create_restock_expense ON stock_batches;
DROP FUNCTION IF EXISTS create_restock_expense();

-- Step 4: Create enhanced function that includes product name and payment method
CREATE OR REPLACE FUNCTION create_restock_expense()
RETURNS TRIGGER AS $$
DECLARE
  product_name TEXT;
  is_new_product BOOLEAN;
  expense_description TEXT;
BEGIN
  -- Only create expense if this is NOT initial stock
  IF NEW.is_initial_stock = FALSE THEN
    -- Get product name
    SELECT name INTO product_name FROM products WHERE id = NEW.product_id;
    
    -- Check if this is a new product (first batch for this product)
    -- If batch_number ends with '-1', it's the first batch for this product
    is_new_product := (NEW.batch_number LIKE '%-1');
    
    -- Generate description based on whether it's a new product or restock
    IF is_new_product THEN
      expense_description := 'New Product: ' || COALESCE(product_name, 'Unknown Product') || 
                            ' (Qty: ' || NEW.quantity_purchased || ')';
    ELSE
      expense_description := 'Restock: ' || COALESCE(product_name, 'Unknown Product') || 
                            ' - Batch #' || NEW.batch_number || 
                            ' (Qty: ' || NEW.quantity_purchased || ')';
    END IF;
    
    -- Create expense record with payment method
    INSERT INTO expenses (
      store_id,
      category,
      description,
      amount,
      expense_date,
      reference_id,
      payment_method
    ) VALUES (
      NEW.store_id,
      CASE 
        WHEN is_new_product THEN 'new_product'
        ELSE 'inventory_restock'
      END,
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

-- Step 5: Create trigger to auto-create expenses on restock with enhanced details
CREATE TRIGGER trigger_create_restock_expense
  AFTER INSERT ON stock_batches
  FOR EACH ROW
  EXECUTE FUNCTION create_restock_expense();

-- Step 6: Update existing inventory_restock expenses to have product names (optional cleanup)
-- This will update old entries to have better descriptions
DO $$
DECLARE
  expense_record RECORD;
  product_name TEXT;
  batch_info RECORD;
BEGIN
  FOR expense_record IN 
    SELECT e.id, e.reference_id 
    FROM expenses e 
    WHERE e.category IN ('inventory_restock', 'new_product') 
    AND e.reference_id IS NOT NULL
  LOOP
    -- Get batch and product info
    SELECT 
      sb.batch_number, 
      sb.quantity_purchased,
      p.name as product_name,
      (sb.batch_number LIKE '%-1') as is_first_batch
    INTO batch_info
    FROM stock_batches sb
    JOIN products p ON p.id = sb.product_id
    WHERE sb.id = expense_record.reference_id;
    
    IF FOUND THEN
      -- Update description with product name
      IF batch_info.is_first_batch THEN
        UPDATE expenses 
        SET 
          description = 'New Product: ' || batch_info.product_name || 
                       ' (Qty: ' || batch_info.quantity_purchased || ')',
          category = 'new_product'
        WHERE id = expense_record.id;
      ELSE
        UPDATE expenses 
        SET 
          description = 'Restock: ' || batch_info.product_name || 
                       ' - Batch #' || batch_info.batch_number ||
                       ' (Qty: ' || batch_info.quantity_purchased || ')'
        WHERE id = expense_record.id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Step 7: Add helpful comment
COMMENT ON COLUMN expenses.category IS 
'Expense category: new_product (first batch of product), inventory_restock (subsequent batches), or other categories';

