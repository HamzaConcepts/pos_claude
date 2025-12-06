-- Fix weighted average calculation to use batch selling prices
-- Based on latest-db-schema.sql where selling_price column already exists

-- 1. POPULATE EXISTING BATCHES THAT DON'T HAVE SELLING PRICE
UPDATE stock_batches sb
SET selling_price = p.target_price
FROM products p
WHERE sb.product_id = p.id
  AND sb.selling_price IS NULL;

-- 2. UPDATE THE AVERAGE PRICE CALCULATION FUNCTION
DROP FUNCTION IF EXISTS update_product_average_price(INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION update_product_average_price(p_product_id INTEGER)
RETURNS VOID AS $$
DECLARE
  weighted_sum DECIMAL(10, 2);
  total_qty INTEGER;
  avg_selling_price DECIMAL(10, 2);
BEGIN
  -- Calculate weighted average: SUM(batch.selling_price * quantity_remaining) / SUM(quantity_remaining)
  SELECT 
    SUM(COALESCE(selling_price, 0) * quantity_remaining),
    SUM(quantity_remaining)
  INTO weighted_sum, total_qty
  FROM stock_batches
  WHERE product_id = p_product_id 
    AND is_depleted = false
    AND quantity_remaining > 0
    AND selling_price IS NOT NULL;
  
  IF total_qty > 0 AND weighted_sum IS NOT NULL THEN
    avg_selling_price := weighted_sum / total_qty;
  ELSE
    SELECT target_price INTO avg_selling_price
    FROM products 
    WHERE id = p_product_id;
  END IF;
  
  UPDATE products 
  SET average_price = COALESCE(avg_selling_price, target_price, 0),
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- 3. RECREATE TRIGGER
DROP TRIGGER IF EXISTS update_product_avg_price_trigger ON stock_batches;
DROP TRIGGER IF EXISTS trg_batch_update_avg_price ON stock_batches;
DROP FUNCTION IF EXISTS trigger_update_product_average_price() CASCADE;

CREATE OR REPLACE FUNCTION trigger_update_product_average_price()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_product_average_price(OLD.product_id);
  ELSE
    PERFORM update_product_average_price(NEW.product_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_avg_price_trigger
AFTER INSERT OR UPDATE OR DELETE ON stock_batches
FOR EACH ROW
EXECUTE FUNCTION trigger_update_product_average_price();

-- 4. RECALCULATE ALL PRODUCTS
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

-- 5. FORCE SCHEMA CACHE REFRESH
NOTIFY pgrst, 'reload schema';
