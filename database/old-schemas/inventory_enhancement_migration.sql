-- =====================================================
-- INVENTORY ENHANCEMENT MIGRATION
-- Features: Suppliers, Multiple Prices, IMEI Tracking, FIFO Batches
-- =====================================================

-- 1. CREATE SUPPLIERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Phone number must be unique per store
  CONSTRAINT unique_supplier_phone_per_store UNIQUE (store_id, phone_number)
);

-- Index for fast supplier search by phone
CREATE INDEX idx_suppliers_phone ON suppliers(phone_number);
CREATE INDEX idx_suppliers_store ON suppliers(store_id);

-- 2. UPDATE PRODUCTS TABLE - Add New Price Fields
-- =====================================================
-- Note: Current schema stores prices in inventory table
-- We're adding these to products table for the new system
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS target_price DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS min_sale_price DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS average_price DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS is_phone BOOLEAN DEFAULT false;

-- Add foreign keys to categories (if not already added from previous migration)
-- These link to the categories/subcategories created in store_categories_migration.sql
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL;

-- Migrate existing inventory prices to products (take average from inventory)
UPDATE products p
SET 
  cost_price = COALESCE((
    SELECT AVG(i.cost_price) 
    FROM inventory i 
    WHERE i.product_id = p.id AND i.quantity_remaining > 0
  ), 0),
  target_price = COALESCE((
    SELECT AVG(i.selling_price) 
    FROM inventory i 
    WHERE i.product_id = p.id AND i.quantity_remaining > 0
  ), 0),
  average_price = COALESCE((
    SELECT AVG(i.cost_price) 
    FROM inventory i 
    WHERE i.product_id = p.id AND i.quantity_remaining > 0
  ), 0),
  min_sale_price = COALESCE((
    SELECT AVG(i.selling_price) * 0.9 
    FROM inventory i 
    WHERE i.product_id = p.id AND i.quantity_remaining > 0
  ), 0)
WHERE cost_price IS NULL;

-- Note: Keep old 'category' VARCHAR column for now (contains text category names)
-- category_id will be the new FK to categories table

-- 3. CREATE STOCK BATCHES TABLE (for FIFO tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS stock_batches (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  
  -- Batch details
  batch_number VARCHAR(50),
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cost_price DECIMAL(10, 2) NOT NULL,
  quantity_purchased INTEGER NOT NULL,
  quantity_remaining INTEGER NOT NULL,
  
  -- Track depletion
  is_depleted BOOLEAN DEFAULT false,
  depleted_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure remaining quantity makes sense
  CONSTRAINT check_remaining_qty CHECK (quantity_remaining >= 0 AND quantity_remaining <= quantity_purchased)
);

-- Indexes for batch queries
CREATE INDEX idx_batches_product ON stock_batches(product_id);
CREATE INDEX idx_batches_store ON stock_batches(store_id);
CREATE INDEX idx_batches_supplier ON stock_batches(supplier_id);
CREATE INDEX idx_batches_depleted ON stock_batches(is_depleted, purchase_date);

-- 4. CREATE IMEI TRACKING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS product_imeis (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id INTEGER REFERENCES stock_batches(id) ON DELETE SET NULL,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  imei_number VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'in_stock', -- in_stock, sold, returned, defective
  
  -- Sale tracking
  sold_at TIMESTAMP WITH TIME ZONE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- IMEI must be unique across the store
  CONSTRAINT unique_imei_per_store UNIQUE (store_id, imei_number)
);

-- Indexes for IMEI lookups
CREATE INDEX idx_imeis_product ON product_imeis(product_id);
CREATE INDEX idx_imeis_status ON product_imeis(status);
CREATE INDEX idx_imeis_imei ON product_imeis(imei_number);

-- 5. CREATE FUNCTION TO AUTO-GENERATE BATCH NUMBER
-- =====================================================
CREATE OR REPLACE FUNCTION generate_batch_number(p_store_id INTEGER, p_product_id INTEGER)
RETURNS VARCHAR AS $$
DECLARE
  batch_count INTEGER;
  product_code VARCHAR(10);
BEGIN
  -- Count existing batches for this product
  SELECT COUNT(*) INTO batch_count 
  FROM stock_batches 
  WHERE product_id = p_product_id AND store_id = p_store_id;
  
  -- Get product first 3 chars or id
  SELECT COALESCE(UPPER(SUBSTRING(name FROM 1 FOR 3)), id::VARCHAR)
  INTO product_code
  FROM products 
  WHERE id = p_product_id;
  
  -- Format: PROD-XXX-YYYYMMDD-NNN
  RETURN product_code || '-' || 
         TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
         LPAD((batch_count + 1)::VARCHAR, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 6. CREATE FUNCTION TO UPDATE AVERAGE PRICE
-- =====================================================
CREATE OR REPLACE FUNCTION update_product_average_price(p_product_id INTEGER)
RETURNS VOID AS $$
DECLARE
  total_cost DECIMAL(10, 2);
  total_qty INTEGER;
  avg_price DECIMAL(10, 2);
BEGIN
  -- Calculate weighted average from active batches
  SELECT 
    SUM(cost_price * quantity_remaining),
    SUM(quantity_remaining)
  INTO total_cost, total_qty
  FROM stock_batches
  WHERE product_id = p_product_id 
    AND is_depleted = false
    AND quantity_remaining > 0;
  
  -- Calculate average
  IF total_qty > 0 THEN
    avg_price := total_cost / total_qty;
  ELSE
    -- If no stock, use target price or last known average
    SELECT COALESCE(target_price, average_price) 
    INTO avg_price
    FROM products 
    WHERE id = p_product_id;
  END IF;
  
  -- Update product
  UPDATE products 
  SET average_price = avg_price,
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- 7. CREATE TRIGGER TO AUTO-UPDATE AVERAGE PRICE
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_update_average_price()
RETURNS TRIGGER AS $$
BEGIN
  -- Update average price when batch changes
  PERFORM update_product_average_price(NEW.product_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_batch_update_avg_price ON stock_batches;
CREATE TRIGGER trg_batch_update_avg_price
  AFTER INSERT OR UPDATE ON stock_batches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_average_price();

-- 8. CREATE FUNCTION FOR FIFO STOCK DEDUCTION
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
  cost_price DECIMAL(10, 2)
) AS $$
DECLARE
  remaining_qty INTEGER := p_quantity;
  batch RECORD;
  deduct_qty INTEGER;
BEGIN
  -- Loop through batches in FIFO order (oldest first)
  FOR batch IN 
    SELECT id, quantity_remaining, cost_price AS batch_cost
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
    SET quantity_remaining = quantity_remaining - deduct_qty,
        is_depleted = (quantity_remaining - deduct_qty = 0),
        depleted_at = CASE WHEN (quantity_remaining - deduct_qty = 0) THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = batch.id;
    
    -- Return deduction info
    batch_id := batch.id;
    quantity_deducted := deduct_qty;
    cost_price := batch.batch_cost;
    RETURN NEXT;
    
    remaining_qty := remaining_qty - deduct_qty;
  END LOOP;
  
  -- Update product average price after deduction
  PERFORM update_product_average_price(p_product_id);
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 9. ADD RLS POLICIES FOR NEW TABLES
-- =====================================================

-- Suppliers policies
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY suppliers_store_isolation ON suppliers
  FOR ALL
  USING (store_id IN (
    SELECT store_id FROM managers WHERE id = auth.uid()
    UNION
    SELECT store_id FROM cashier_accounts WHERE id::TEXT = (auth.jwt() ->> 'sub')
  ));

-- Stock batches policies
ALTER TABLE stock_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY batches_store_isolation ON stock_batches
  FOR ALL
  USING (store_id IN (
    SELECT store_id FROM managers WHERE id = auth.uid()
    UNION
    SELECT store_id FROM cashier_accounts WHERE id::TEXT = (auth.jwt() ->> 'sub')
  ));

-- IMEI policies
ALTER TABLE product_imeis ENABLE ROW LEVEL SECURITY;

CREATE POLICY imeis_store_isolation ON product_imeis
  FOR ALL
  USING (store_id IN (
    SELECT store_id FROM managers WHERE id = auth.uid()
    UNION
    SELECT store_id FROM cashier_accounts WHERE id::TEXT = (auth.jwt() ->> 'sub')
  ));

-- 10. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_products_is_phone ON products(is_phone) WHERE is_phone = true;
CREATE INDEX IF NOT EXISTS idx_products_average_price ON products(average_price);

-- 11. ADD HELPFUL COMMENTS
-- =====================================================
COMMENT ON TABLE suppliers IS 'Stores supplier/vendor information with unique phone numbers per store';
COMMENT ON TABLE stock_batches IS 'Tracks individual stock purchases for FIFO inventory management';
COMMENT ON TABLE product_imeis IS 'Tracks IMEI numbers for phone products';
COMMENT ON COLUMN products.cost_price IS 'Purchase/cost price (hidden from public view)';
COMMENT ON COLUMN products.target_price IS 'Regular selling price';
COMMENT ON COLUMN products.min_sale_price IS 'Minimum negotiable selling price';
COMMENT ON COLUMN products.average_price IS 'Weighted average cost of remaining stock';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next Steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Verify tables created successfully
-- 3. Test supplier creation and phone uniqueness
-- 4. Test batch creation and FIFO deduction function
-- 5. Proceed with API implementation
-- =====================================================
