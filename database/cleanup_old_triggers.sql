-- =====================================================
-- CLEANUP OLD TRIGGERS AND FUNCTIONS
-- Run this script to remove old triggers that reference deleted columns
-- =====================================================

-- 1. Drop old trigger on stock_batches
DROP TRIGGER IF EXISTS trigger_update_product_average_price ON stock_batches;

-- 2. Drop old trigger function
DROP FUNCTION IF EXISTS trigger_update_product_average_price();

-- 3. Drop old average price update function
DROP FUNCTION IF EXISTS update_product_average_price(INTEGER);

-- 4. Verify the new trigger is in place
-- This should show: trigger_update_aggregated_stock
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgrelid = 'stock_batches'::regclass
  AND tgisinternal = false;

-- 5. Verify the new trigger function exists
-- This should show: update_aggregated_stock()
SELECT 
    proname AS function_name
FROM pg_proc
WHERE proname LIKE '%aggregated_stock%';

COMMENT ON SCRIPT IS 'Cleanup script to remove old triggers that reference target_price and average_price columns which no longer exist';
