-- =====================================================
-- COMPREHENSIVE DATABASE CLEANUP AND VERIFICATION
-- This script removes all references to old column names
-- and ensures the new schema is properly in place
-- =====================================================

-- SECTION 1: REMOVE OLD TRIGGERS AND FUNCTIONS
-- =====================================================
DOTHIS:
  -- Drop old triggers
  DROP TRIGGER IF EXISTS trigger_update_product_average_price ON stock_batches CASCADE;
  DROP TRIGGER IF EXISTS update_product_avg_price_trigger ON stock_batches CASCADE;
  DROP TRIGGER IF EXISTS trigger_update_product_prices ON stock_batches CASCADE;
  
  -- Drop old functions
  DROP FUNCTION IF EXISTS update_product_average_price(INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS trigger_update_product_average_price() CASCADE;
  DROP FUNCTION IF EXISTS update_product_prices() CASCADE;
  DROP FUNCTION IF EXISTS calculate_weighted_average_price(INTEGER) CASCADE;
  
  RAISE NOTICE 'Old triggers and functions removed';
END;
$$ LANGUAGE plpgsql;


-- SECTION 2: VERIFY NEW TRIGGERS ARE IN PLACE
-- =====================================================
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'stock_batches'::regclass
    AND tgname = 'trigger_update_aggregated_stock'
    AND tgisinternal = false;
    
  IF trigger_count = 0 THEN
    RAISE EXCEPTION 'ERROR: trigger_update_aggregated_stock is missing! Please run the new-schema-migration.sql first.';
  ELSE
    RAISE NOTICE 'SUCCESS: New trigger trigger_update_aggregated_stock is in place';
  END IF;
END;
$$ LANGUAGE plpgsql;


-- SECTION 3: VERIFY aggregated_stock TABLE EXISTS
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'aggregated_stock'
  ) THEN
    RAISE EXCEPTION 'ERROR: aggregated_stock table does not exist! Please run the new-schema-migration.sql first.';
  ELSE
    RAISE NOTICE 'SUCCESS: aggregated_stock table exists';
  END IF;
END;
$$ LANGUAGE plpgsql;


-- SECTION 4: LIST REMAINING TRIGGERS ON STOCK_BATCHES
-- =====================================================
SELECT 
    'Triggers on stock_batches:' AS info,
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'stock_batches'::regclass
  AND tgisinternal = false;


-- SECTION 5: VERIFY COLUMNS ON PRODUCTS TABLE
-- =====================================================
SELECT 
    'Products table columns:' AS info,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
ORDER BY ordinal_position;


-- SECTION 6: VERIFY COLUMNS ON STOCK_BATCHES TABLE
-- =====================================================
SELECT 
    'Stock_batches table columns:' AS info,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'stock_batches'
ORDER BY ordinal_position;


-- =====================================================
-- EXPECTED RESULTS:
-- =====================================================
-- 1. Old triggers should be removed (DONE message)
-- 2. New trigger should exist (SUCCESS message)
-- 3. aggregated_stock table should exist (SUCCESS message)
-- 4. Products table should NOT have: target_price, min_sale_price, cost_price, average_price
-- 5. Stock_batches should have: selling_price, lowest_negotiable_price
-- 6. Only trigger_update_aggregated_stock should be listed for stock_batches
