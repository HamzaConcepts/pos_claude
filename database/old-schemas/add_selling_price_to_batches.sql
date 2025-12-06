-- Add selling_price to stock_batches table to track selling price per restock
-- This enables weighted average calculation based on actual restock prices

-- 1. ADD SELLING PRICE COLUMN TO STOCK_BATCHES
ALTER TABLE stock_batches 
ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10, 2);

-- 2. POPULATE EXISTING BATCHES WITH PRODUCT'S TARGET PRICE
-- (For existing batches, use the current product target_price)
UPDATE stock_batches sb
SET selling_price = p.target_price
FROM products p
WHERE sb.product_id = p.id
  AND sb.selling_price IS NULL;

-- 3. UPDATE THE AVERAGE PRICE CALCULATION FUNCTION
-- Now calculate based on batch selling prices, not product target_price
DROP FUNCTION IF EXISTS update_product_average_price(INTEGER);

CREATE OR REPLACE FUNCTION update_product_average_price(p_product_id INTEGER)
RETURNS VOID AS $$
DECLARE
  weighted_sum DECIMAL(10, 2);
  total_qty INTEGER;
  avg_selling_price DECIMAL(10, 2);
BEGIN
  -- Calculate weighted average: SUM(batch.selling_price * quantity_remaining) / SUM(quantity_remaining)
  -- This represents the true weighted average of selling prices across all active batches
  SELECT 
    SUM(COALESCE(selling_price, 0) * quantity_remaining),
    SUM(quantity_remaining)
  INTO weighted_sum, total_qty
  FROM stock_batches
  WHERE product_id = p_product_id 
    AND is_depleted = false
    AND quantity_remaining > 0
    AND selling_price IS NOT NULL;
  
  -- Calculate average selling price
  IF total_qty > 0 AND weighted_sum IS NOT NULL THEN
    avg_selling_price := weighted_sum / total_qty;
  ELSE
    -- If no stock with selling price, use target price as fallback
    SELECT target_price INTO avg_selling_price
    FROM products 
    WHERE id = p_product_id;
  END IF;
  
  -- Update product with weighted average selling price
  UPDATE products 
  SET average_price = COALESCE(avg_selling_price, target_price, 0),
      updated_at = NOW()
  WHERE id = p_product_id;
  
END;
$$ LANGUAGE plpgsql;

-- 4. RECALCULATE ALL EXISTING PRODUCTS
-- This updates all products to use the new weighted average based on batch selling prices
DO $$
DECLARE
  product_record RECORD;
BEGIN
  FOR product_record IN 
    SELECT DISTINCT id FROM products WHERE is_active = true
  LOOP
    PERFORM update_product_average_price(product_record.id);
  END LOOP;
END $$;

COMMENT ON COLUMN stock_batches.selling_price IS 
'Selling price (target price) set during this specific restock. Used for weighted average calculation.';

COMMENT ON FUNCTION update_product_average_price(INTEGER) IS 
'Calculates weighted average selling price based on batch selling prices and remaining quantities. Formula: SUM(batch.selling_price × qty_remaining) / SUM(qty_remaining)';
