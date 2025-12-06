-- Update the average_price calculation to use selling prices (target_price) instead of cost_price
-- This makes average_price represent the weighted average selling price

-- 1. DROP EXISTING FUNCTION AND TRIGGER
DROP TRIGGER IF EXISTS update_product_avg_price_trigger ON stock_batches;
DROP FUNCTION IF EXISTS update_product_average_price(INTEGER);

-- 2. CREATE NEW FUNCTION - WEIGHTED AVERAGE OF SELLING PRICES
CREATE OR REPLACE FUNCTION update_product_average_price(p_product_id INTEGER)
RETURNS VOID AS $$
DECLARE
  weighted_sum DECIMAL(10, 2);
  total_qty INTEGER;
  avg_selling_price DECIMAL(10, 2);
  product_target_price DECIMAL(10, 2);
BEGIN
  -- Get product's current target price
  SELECT target_price INTO product_target_price
  FROM products 
  WHERE id = p_product_id;
  
  -- Calculate weighted average: SUM(target_price * quantity_remaining) / SUM(quantity_remaining)
  -- This represents the average selling price based on stock quantities
  SELECT 
    SUM(COALESCE(product_target_price, 0) * quantity_remaining),
    SUM(quantity_remaining)
  INTO weighted_sum, total_qty
  FROM stock_batches
  WHERE product_id = p_product_id 
    AND is_depleted = false
    AND quantity_remaining > 0;
  
  -- Calculate average selling price
  IF total_qty > 0 THEN
    avg_selling_price := weighted_sum / total_qty;
  ELSE
    -- If no stock, use target price as default
    avg_selling_price := product_target_price;
  END IF;
  
  -- Update product with weighted average selling price
  UPDATE products 
  SET average_price = COALESCE(avg_selling_price, target_price),
      updated_at = NOW()
  WHERE id = p_product_id;
  
END;
$$ LANGUAGE plpgsql;

-- 3. RECREATE TRIGGER
-- Note: Trigger function handles NEW/OLD internally, not via parameters
DROP TRIGGER IF EXISTS update_product_avg_price_trigger ON stock_batches;

CREATE OR REPLACE FUNCTION trigger_update_product_average_price()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the update function with appropriate product_id
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

-- 4. RECALCULATE ALL EXISTING PRODUCTS
-- This updates all products to use the new weighted average of selling prices
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

COMMENT ON FUNCTION update_product_average_price(INTEGER) IS 
'Calculates weighted average selling price based on stock batches. Formula: SUM(target_price × qty_remaining) / SUM(qty_remaining)';
