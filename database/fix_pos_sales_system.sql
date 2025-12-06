-- =====================================================
-- COMPLETE DATABASE FIX FOR POS/SALES SYSTEM
-- Run this script to fix all issues with the new schema
-- =====================================================

-- STEP 1: Drop old triggers and functions that reference deleted columns
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_product_average_price ON stock_batches CASCADE;
DROP TRIGGER IF EXISTS update_product_avg_price_trigger ON stock_batches CASCADE;
DROP TRIGGER IF EXISTS trigger_update_product_prices ON stock_batches CASCADE;

DROP FUNCTION IF EXISTS update_product_average_price(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS trigger_update_product_average_price() CASCADE;
DROP FUNCTION IF EXISTS update_product_prices() CASCADE;
DROP FUNCTION IF EXISTS calculate_weighted_average_price(INTEGER) CASCADE;


-- STEP 2: Update deduct_stock_fifo function to work with new schema
-- =====================================================
CREATE OR REPLACE FUNCTION deduct_stock_fifo(
  p_product_id INTEGER,
  p_store_id INTEGER,
  p_quantity INTEGER,
  p_sale_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
  batch_id INTEGER,
  quantity_deducted INTEGER,
  batch_cost_price DECIMAL(10, 2)
) AS $$
DECLARE
  remaining_qty INTEGER := p_quantity;
  batch RECORD;
  deduct_qty INTEGER;
BEGIN
  -- Loop through batches in FIFO order (oldest first)
  FOR batch IN 
    SELECT id, quantity_remaining, stock_batches.cost_price
    FROM stock_batches
    WHERE product_id = p_product_id 
      AND store_id = p_store_id
      AND is_depleted = false
      AND quantity_remaining > 0
    ORDER BY purchase_date ASC, id ASC
  LOOP
    EXIT WHEN remaining_qty <= 0;
    
    -- Determine how much to deduct from this batch
    deduct_qty := LEAST(batch.quantity_remaining, remaining_qty);
    
    -- Update batch
    UPDATE stock_batches
    SET quantity_remaining = stock_batches.quantity_remaining - deduct_qty,
        is_depleted = (stock_batches.quantity_remaining - deduct_qty = 0),
        depleted_at = CASE WHEN (stock_batches.quantity_remaining - deduct_qty = 0) THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = batch.id;
    
    -- Return deduction info
    batch_id := batch.id;
    quantity_deducted := deduct_qty;
    batch_cost_price := batch.cost_price;
    RETURN NEXT;
    
    remaining_qty := remaining_qty - deduct_qty;
  END LOOP;
  
  -- NOTE: No need to manually update aggregated_stock here
  -- The update_aggregated_stock trigger will automatically recalculate it
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION deduct_stock_fifo(INTEGER, INTEGER, INTEGER, INTEGER) IS 
'Deducts stock using FIFO (First In, First Out) method. Works with new aggregated_stock schema.';


-- STEP 3: Verify the update_aggregated_stock trigger is in place
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
    RAISE EXCEPTION 'ERROR: trigger_update_aggregated_stock is missing! Please run new-schema-migration.sql first.';
  ELSE
    RAISE NOTICE 'SUCCESS: Trigger trigger_update_aggregated_stock is active';
  END IF;
END;
$$ LANGUAGE plpgsql;


-- STEP 4: Ensure all products have aggregated_stock records
-- =====================================================
DO $$
DECLARE
  product_record RECORD;
  agg_stock_count INTEGER;
BEGIN
  FOR product_record IN 
    SELECT DISTINCT p.id, p.store_id
    FROM products p
  LOOP
    -- Check if aggregated_stock record exists
    SELECT COUNT(*)
    INTO agg_stock_count
    FROM aggregated_stock
    WHERE product_id = product_record.id
      AND store_id = product_record.store_id;
    
    -- Create if missing
    IF agg_stock_count = 0 THEN
      INSERT INTO aggregated_stock (
        product_id,
        store_id,
        aggregated_cost_price,
        aggregated_selling_price,
        aggregated_lowest_negotiable,
        total_quantity_purchased,
        total_quantity_remaining,
        total_quantity_sold,
        low_stock_threshold
      ) VALUES (
        product_record.id,
        product_record.store_id,
        0,
        0,
        0,
        0,
        0,
        0,
        10
      );
      
      RAISE NOTICE 'Created aggregated_stock for product ID: %', product_record.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'All products have aggregated_stock records';
END;
$$ LANGUAGE plpgsql;


-- STEP 5: Recalculate aggregated_stock for all products
-- =====================================================
DO $$
DECLARE
  product_record RECORD;
  batch_id_to_update INTEGER;
BEGIN
  FOR product_record IN 
    SELECT DISTINCT product_id, store_id
    FROM stock_batches
  LOOP
    -- Get the first batch ID for this product
    SELECT id INTO batch_id_to_update
    FROM stock_batches
    WHERE product_id = product_record.product_id
      AND store_id = product_record.store_id
    LIMIT 1;
    
    -- Update that specific batch to trigger recalculation
    IF batch_id_to_update IS NOT NULL THEN
      UPDATE stock_batches
      SET updated_at = NOW()
      WHERE id = batch_id_to_update;
      
      RAISE NOTICE 'Recalculated aggregated_stock for product ID: %', product_record.product_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'All aggregated_stock records recalculated';
END;
$$ LANGUAGE plpgsql;


-- STEP 6: Verification queries
-- =====================================================

-- List all triggers on stock_batches
SELECT 
    'Active triggers on stock_batches:' AS info,
    tgname AS trigger_name
FROM pg_trigger
WHERE tgrelid = 'stock_batches'::regclass
  AND tgisinternal = false;

-- Check products without aggregated_stock
SELECT 
    'Products missing aggregated_stock:' AS info,
    COUNT(*) AS count
FROM products p
LEFT JOIN aggregated_stock agg 
  ON agg.product_id = p.id AND agg.store_id = p.store_id
WHERE agg.id IS NULL;

-- Sample aggregated_stock data
SELECT 
    'Sample aggregated_stock records:' AS info,
    p.id,
    p.name,
    agg.total_quantity_remaining,
    agg.aggregated_selling_price,
    agg.aggregated_lowest_negotiable
FROM products p
JOIN aggregated_stock agg 
  ON agg.product_id = p.id AND agg.store_id = p.store_id
LIMIT 5;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DATABASE FIX COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '1. Old triggers removed';
  RAISE NOTICE '2. deduct_stock_fifo updated';
  RAISE NOTICE '3. All products have aggregated_stock';
  RAISE NOTICE '4. Aggregated values recalculated';
  RAISE NOTICE '========================================';
END;
$$ LANGUAGE plpgsql;
