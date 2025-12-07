-- Migration: Add Expenses Tracking for Inventory Restocking
-- This enables tracking of inventory restocking as expenses
-- Initial stock (added via Store tab) will NOT be tracked as expenses
-- 
-- NOTE: This works with the existing expenses table structure

-- Step 1: Add is_initial_stock flag to stock_batches table
-- This distinguishes initial migration stock from regular restocking
ALTER TABLE stock_batches 
ADD COLUMN IF NOT EXISTS is_initial_stock BOOLEAN DEFAULT FALSE;

-- Step 2: Add lowest_negotiable_price if it doesn't exist
ALTER TABLE stock_batches 
ADD COLUMN IF NOT EXISTS lowest_negotiable_price NUMERIC(10, 2);

-- Step 3: Add reference_id to expenses table to link back to stock batches
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS reference_id INTEGER;

-- Step 4: Add index on reference_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_expenses_reference_id ON expenses(reference_id);

-- Step 5: Add comment explaining the columns
COMMENT ON COLUMN stock_batches.is_initial_stock IS 
'TRUE for stock added during initial store setup (not counted as expense). FALSE for regular restocking (counted as expense).';

COMMENT ON COLUMN expenses.reference_id IS 
'Links expense to related record. For inventory_restock category, this is the stock_batch_id.';

-- Step 6: Create function to automatically create expense record when restocking
-- (excluding initial stock)
CREATE OR REPLACE FUNCTION create_restock_expense()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create expense if this is NOT initial stock
  IF NEW.is_initial_stock = FALSE THEN
    INSERT INTO expenses (
      store_id,
      category,
      description,
      amount,
      expense_date,
      reference_id
    ) VALUES (
      NEW.store_id,
      'inventory_restock',
      'Inventory restock - Batch #' || NEW.batch_number,
      NEW.cost_price * NEW.quantity_purchased,
      NEW.purchase_date::date,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to auto-create expenses on restock
DROP TRIGGER IF EXISTS trigger_create_restock_expense ON stock_batches;
CREATE TRIGGER trigger_create_restock_expense
  AFTER INSERT ON stock_batches
  FOR EACH ROW
  EXECUTE FUNCTION create_restock_expense();

-- Step 8: Create view for expense summary by date range (if not exists)
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

COMMENT ON VIEW expense_summary IS 
'Aggregated expense data by store, category, and time period for reporting';

-- Step 9: Grant appropriate permissions (if not already granted)
GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE expenses_id_seq TO authenticated;
GRANT SELECT ON expense_summary TO authenticated;

