-- =====================================================
-- SCHEMA MIGRATION: Aggregated Stock Implementation
-- =====================================================
-- This migration creates the aggregated_stock table and modifies
-- products and stock_batches tables according to new requirements
-- =====================================================

-- STEP 1: Add lowest_negotiable_price to stock_batches table
-- =====================================================
ALTER TABLE public.stock_batches
ADD COLUMN IF NOT EXISTS lowest_negotiable_price NUMERIC(10, 2) NULL;

ALTER TABLE public.stock_batches
ADD CONSTRAINT stock_batches_lowest_negotiable_check 
CHECK (lowest_negotiable_price >= 0);

-- Create index for lowest_negotiable_price
CREATE INDEX IF NOT EXISTS idx_batches_lowest_negotiable 
ON public.stock_batches(lowest_negotiable_price);

COMMENT ON COLUMN public.stock_batches.lowest_negotiable_price 
IS 'Minimum acceptable selling price for this batch';


-- STEP 2: Create aggregated_stock table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.aggregated_stock (
  id SERIAL NOT NULL,
  product_id INTEGER NOT NULL,
  store_id INTEGER NOT NULL,
  
  -- Aggregated pricing (weighted averages from stock_batches)
  aggregated_cost_price NUMERIC(10, 2) NULL DEFAULT 0,
  aggregated_selling_price NUMERIC(10, 2) NULL DEFAULT 0,
  aggregated_lowest_negotiable NUMERIC(10, 2) NULL DEFAULT 0,
  
  -- Stock quantities
  total_quantity_purchased INTEGER NOT NULL DEFAULT 0,
  total_quantity_remaining INTEGER NOT NULL DEFAULT 0,
  total_quantity_sold INTEGER NOT NULL DEFAULT 0,
  
  -- Low stock threshold (moved from inventory table)
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  
  -- Audit timestamps
  created_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT aggregated_stock_pkey PRIMARY KEY (id),
  CONSTRAINT aggregated_stock_product_store_unique UNIQUE (product_id, store_id),
  CONSTRAINT aggregated_stock_product_id_fkey FOREIGN KEY (product_id) 
    REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT aggregated_stock_store_id_fkey FOREIGN KEY (store_id) 
    REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT aggregated_stock_cost_price_check 
    CHECK (aggregated_cost_price >= 0),
  CONSTRAINT aggregated_stock_selling_price_check 
    CHECK (aggregated_selling_price >= 0),
  CONSTRAINT aggregated_stock_lowest_negotiable_check 
    CHECK (aggregated_lowest_negotiable >= 0),
  CONSTRAINT aggregated_stock_quantities_check 
    CHECK (total_quantity_remaining >= 0 AND total_quantity_remaining <= total_quantity_purchased),
  CONSTRAINT aggregated_stock_threshold_check 
    CHECK (low_stock_threshold >= 0)
) TABLESPACE pg_default;

-- Create indexes for aggregated_stock
CREATE INDEX IF NOT EXISTS idx_aggregated_stock_product_id 
ON public.aggregated_stock(product_id);

CREATE INDEX IF NOT EXISTS idx_aggregated_stock_store_id 
ON public.aggregated_stock(store_id);

CREATE INDEX IF NOT EXISTS idx_aggregated_stock_remaining 
ON public.aggregated_stock(total_quantity_remaining);

CREATE INDEX IF NOT EXISTS idx_aggregated_stock_product_store 
ON public.aggregated_stock(product_id, store_id);

COMMENT ON TABLE public.aggregated_stock 
IS 'Stores aggregated stock data with weighted average prices calculated from stock_batches';


-- STEP 3: Create trigger function to update aggregated_stock
-- =====================================================
CREATE OR REPLACE FUNCTION update_aggregated_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id INTEGER;
  v_store_id INTEGER;
  v_total_purchased INTEGER;
  v_total_remaining INTEGER;
  v_total_sold INTEGER;
  v_weighted_cost NUMERIC(10, 2);
  v_weighted_selling NUMERIC(10, 2);
  v_weighted_lowest NUMERIC(10, 2);
  v_total_cost_value NUMERIC(12, 2);
  v_total_selling_value NUMERIC(12, 2);
  v_total_lowest_value NUMERIC(12, 2);
BEGIN
  -- Determine which product to update
  IF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
    v_store_id := OLD.store_id;
  ELSE
    v_product_id := NEW.product_id;
    v_store_id := NEW.store_id;
  END IF;

  -- Calculate aggregated values from all batches of this product
  SELECT 
    COALESCE(SUM(quantity_purchased), 0),
    COALESCE(SUM(quantity_remaining), 0),
    COALESCE(SUM(quantity_purchased - quantity_remaining), 0),
    COALESCE(SUM(cost_price * quantity_remaining), 0),
    COALESCE(SUM(COALESCE(selling_price, 0) * quantity_remaining), 0),
    COALESCE(SUM(COALESCE(lowest_negotiable_price, 0) * quantity_remaining), 0)
  INTO 
    v_total_purchased,
    v_total_remaining,
    v_total_sold,
    v_total_cost_value,
    v_total_selling_value,
    v_total_lowest_value
  FROM stock_batches
  WHERE product_id = v_product_id 
    AND store_id = v_store_id
    AND NOT is_depleted;

  -- Calculate weighted averages (avoid division by zero)
  IF v_total_remaining > 0 THEN
    v_weighted_cost := v_total_cost_value / v_total_remaining;
    v_weighted_selling := v_total_selling_value / v_total_remaining;
    v_weighted_lowest := v_total_lowest_value / v_total_remaining;
  ELSE
    v_weighted_cost := 0;
    v_weighted_selling := 0;
    v_weighted_lowest := 0;
  END IF;

  -- Upsert aggregated_stock record
  INSERT INTO aggregated_stock (
    product_id,
    store_id,
    aggregated_cost_price,
    aggregated_selling_price,
    aggregated_lowest_negotiable,
    total_quantity_purchased,
    total_quantity_remaining,
    total_quantity_sold,
    updated_at
  ) VALUES (
    v_product_id,
    v_store_id,
    v_weighted_cost,
    v_weighted_selling,
    v_weighted_lowest,
    v_total_purchased,
    v_total_remaining,
    v_total_sold,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (product_id, store_id) 
  DO UPDATE SET
    aggregated_cost_price = EXCLUDED.aggregated_cost_price,
    aggregated_selling_price = EXCLUDED.aggregated_selling_price,
    aggregated_lowest_negotiable = EXCLUDED.aggregated_lowest_negotiable,
    total_quantity_purchased = EXCLUDED.total_quantity_purchased,
    total_quantity_remaining = EXCLUDED.total_quantity_remaining,
    total_quantity_sold = EXCLUDED.total_quantity_sold,
    updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Create triggers on stock_batches
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_aggregated_stock ON stock_batches;

CREATE TRIGGER trigger_update_aggregated_stock
AFTER INSERT OR UPDATE OR DELETE ON stock_batches
FOR EACH ROW
EXECUTE FUNCTION update_aggregated_stock();

COMMENT ON TRIGGER trigger_update_aggregated_stock ON stock_batches
IS 'Automatically updates aggregated_stock when stock_batches are modified';


-- STEP 5: Create updated_at trigger for aggregated_stock
-- =====================================================
CREATE OR REPLACE FUNCTION update_aggregated_stock_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_aggregated_stock_updated_at ON aggregated_stock;

CREATE TRIGGER update_aggregated_stock_updated_at
BEFORE UPDATE ON aggregated_stock
FOR EACH ROW
EXECUTE FUNCTION update_aggregated_stock_timestamp();


-- STEP 6: Migrate existing data to aggregated_stock
-- =====================================================
-- This will populate aggregated_stock from existing stock_batches
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
)
SELECT 
  sb.product_id,
  sb.store_id,
  -- Weighted average cost price
  CASE 
    WHEN SUM(sb.quantity_remaining) > 0 
    THEN SUM(sb.cost_price * sb.quantity_remaining) / SUM(sb.quantity_remaining)
    ELSE 0 
  END as aggregated_cost_price,
  -- Weighted average selling price
  CASE 
    WHEN SUM(sb.quantity_remaining) > 0 
    THEN SUM(COALESCE(sb.selling_price, 0) * sb.quantity_remaining) / SUM(sb.quantity_remaining)
    ELSE 0 
  END as aggregated_selling_price,
  -- Weighted average lowest negotiable (use selling_price as fallback)
  CASE 
    WHEN SUM(sb.quantity_remaining) > 0 
    THEN SUM(COALESCE(sb.lowest_negotiable_price, sb.selling_price, 0) * sb.quantity_remaining) / SUM(sb.quantity_remaining)
    ELSE 0 
  END as aggregated_lowest_negotiable,
  -- Total quantities
  SUM(sb.quantity_purchased) as total_quantity_purchased,
  SUM(sb.quantity_remaining) as total_quantity_remaining,
  SUM(sb.quantity_purchased - sb.quantity_remaining) as total_quantity_sold,
  -- Get low_stock_threshold from inventory table (default 10)
  COALESCE((
    SELECT low_stock_threshold 
    FROM inventory 
    WHERE product_id = sb.product_id 
    ORDER BY restock_date DESC 
    LIMIT 1
  ), 10) as low_stock_threshold
FROM stock_batches sb
WHERE NOT sb.is_depleted
GROUP BY sb.product_id, sb.store_id
ON CONFLICT (product_id, store_id) DO NOTHING;


-- STEP 7: Drop inventory table and create inventory view
-- =====================================================
-- The inventory table is replaced by aggregated_stock
-- We create a view for backward compatibility and easy querying

-- Drop existing inventory table
DROP TABLE IF EXISTS public.inventory CASCADE;

-- Create inventory view
CREATE OR REPLACE VIEW public.inventory_view AS
SELECT 
  p.id as product_id,
  p.sku,
  p.name as product_name,
  p.description,
  p.category,
  p.store_id,
  p.is_active,
  p.is_phone,
  
  -- Category information
  c.id as category_id,
  c.name as category_name,
  sc.id as subcategory_id,
  sc.name as subcategory_name,
  
  -- Aggregated pricing from aggregated_stock
  COALESCE(agg.aggregated_cost_price, 0) as cost_price,
  COALESCE(agg.aggregated_selling_price, 0) as selling_price,
  COALESCE(agg.aggregated_lowest_negotiable, 0) as min_price,
  
  -- Stock quantities
  COALESCE(agg.total_quantity_purchased, 0) as total_quantity_purchased,
  COALESCE(agg.total_quantity_remaining, 0) as stock_quantity,
  COALESCE(agg.total_quantity_sold, 0) as total_quantity_sold,
  COALESCE(agg.low_stock_threshold, 10) as low_stock_threshold,
  
  -- Timestamps
  p.created_at,
  p.updated_at,
  agg.updated_at as last_stock_update
  
FROM products p
LEFT JOIN aggregated_stock agg 
  ON agg.product_id = p.id AND agg.store_id = p.store_id
LEFT JOIN categories c 
  ON c.id = p.category_id
LEFT JOIN subcategories sc 
  ON sc.id = p.subcategory_id
WHERE p.is_active = true;

COMMENT ON VIEW public.inventory_view 
IS 'Virtual inventory table showing products with aggregated stock and pricing data';


-- STEP 8: Remove price columns from products table
-- =====================================================
-- These columns are now in aggregated_stock
-- IMPORTANT: Only run this after verifying data migration is complete

-- ALTER TABLE public.products DROP COLUMN IF EXISTS cost_price;
-- ALTER TABLE public.products DROP COLUMN IF EXISTS target_price;
-- ALTER TABLE public.products DROP COLUMN IF EXISTS min_sale_price;
-- ALTER TABLE public.products DROP COLUMN IF EXISTS average_price;

-- NOTE: The above ALTER statements are commented out for safety.
-- Uncomment and run them ONLY after:
-- 1. Verifying aggregated_stock has all data
-- 2. Updating all application code to use aggregated_stock
-- 3. Testing thoroughly in development environment


-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check aggregated_stock data
-- SELECT 
--   p.sku,
--   p.name,
--   agg.aggregated_cost_price,
--   agg.aggregated_selling_price,
--   agg.aggregated_lowest_negotiable,
--   agg.total_quantity_remaining,
--   agg.low_stock_threshold
-- FROM aggregated_stock agg
-- JOIN products p ON p.id = agg.product_id
-- ORDER BY p.sku;

-- Test inventory_view
-- SELECT 
--   sku,
--   product_name,
--   category_name,
--   subcategory_name,
--   min_price,
--   selling_price,
--   stock_quantity,
--   low_stock_threshold
-- FROM inventory_view
-- ORDER BY sku
-- LIMIT 10;

-- Compare old vs new pricing (before dropping columns)
-- SELECT 
--   p.sku,
--   p.name,
--   p.average_price as old_avg_price,
--   agg.aggregated_selling_price as new_avg_price,
--   p.min_sale_price as old_min_price,
--   agg.aggregated_lowest_negotiable as new_min_price
-- FROM products p
-- LEFT JOIN aggregated_stock agg ON agg.product_id = p.id
-- WHERE p.is_active = true
-- ORDER BY p.sku;
