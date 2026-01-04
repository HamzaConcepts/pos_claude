-- Migration: Add Per-Store Sale ID Sequence
-- Date: January 1, 2026
-- Purpose: Implement store-specific sequential sale IDs instead of global IDs

-- Step 1: Add new column for store-specific sale number
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS sale_number_store INTEGER;

-- Step 2: Add index for performance
CREATE INDEX IF NOT EXISTS idx_sales_store_number 
ON sales(store_id, sale_number_store DESC);

-- Step 3: Create function to get next sale number for a store
CREATE OR REPLACE FUNCTION get_next_sale_number(p_store_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  -- Get the maximum sale number for this store and add 1
  SELECT COALESCE(MAX(sale_number_store), 0) + 1
  INTO next_number
  FROM sales
  WHERE store_id = p_store_id;
  
  RETURN next_number;
END;
$$;

-- Step 4: Create trigger function to auto-generate sale number
CREATE OR REPLACE FUNCTION set_sale_number_store()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only set if not already provided
  IF NEW.sale_number_store IS NULL THEN
    NEW.sale_number_store := get_next_sale_number(NEW.store_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 5: Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS trigger_set_sale_number_store ON sales;
CREATE TRIGGER trigger_set_sale_number_store
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_sale_number_store();

-- Step 6: Backfill existing sales with store-specific numbers
-- This assigns sequential numbers to existing sales per store
DO $$
DECLARE
  store_record RECORD;
  sale_record RECORD;
  counter INTEGER;
BEGIN
  -- Loop through each store
  FOR store_record IN 
    SELECT DISTINCT store_id FROM sales WHERE sale_number_store IS NULL
  LOOP
    counter := 1;
    
    -- Loop through sales for this store, ordered by sale date and ID
    FOR sale_record IN 
      SELECT id 
      FROM sales 
      WHERE store_id = store_record.store_id 
        AND sale_number_store IS NULL
      ORDER BY sale_date ASC, id ASC
    LOOP
      -- Update with sequential number
      UPDATE sales 
      SET sale_number_store = counter 
      WHERE id = sale_record.id;
      
      counter := counter + 1;
    END LOOP;
  END LOOP;
END;
$$;

-- Step 7: Make the column NOT NULL after backfill
ALTER TABLE sales 
ALTER COLUMN sale_number_store SET NOT NULL;

-- Step 8: Add unique constraint (store_id + sale_number_store must be unique)
ALTER TABLE sales
ADD CONSTRAINT unique_sale_number_per_store 
UNIQUE (store_id, sale_number_store);

-- Verification queries
-- Run these to verify the migration worked:

-- Check that all sales have store numbers
-- SELECT COUNT(*) as total_sales, 
--        COUNT(sale_number_store) as with_store_number 
-- FROM sales;

-- Check per-store sequences
-- SELECT store_id, 
--        MIN(sale_number_store) as first_number,
--        MAX(sale_number_store) as last_number,
--        COUNT(*) as total_sales
-- FROM sales
-- GROUP BY store_id
-- ORDER BY store_id;

-- Test the function
-- SELECT get_next_sale_number(1) as next_sale_for_store_1;

COMMENT ON COLUMN sales.sale_number_store IS 'Sequential sale number within the store (1, 2, 3, ...)';
COMMENT ON FUNCTION get_next_sale_number(INTEGER) IS 'Returns the next available sale number for a specific store';
