-- Returns Module: Database Tables
-- Run this in your Supabase SQL Editor

-- Main returns table
CREATE TABLE IF NOT EXISTS returns (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  return_type VARCHAR(20) NOT NULL CHECK (return_type IN ('customer', 'supplier')),
  
  -- Customer return fields
  sale_id INTEGER REFERENCES sales(id),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  
  -- Supplier return fields
  supplier_id INTEGER REFERENCES suppliers(id),
  supplier_name VARCHAR(255),
  
  -- Financial
  total_refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  refund_method VARCHAR(20) CHECK (refund_method IN ('Cash', 'Digital', 'Ledger_Credit', 'Exchange')),
  
  -- Metadata
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  cashier_id INTEGER,
  return_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Return line items
CREATE TABLE IF NOT EXISTS return_items (
  id SERIAL PRIMARY KEY,
  return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name VARCHAR(255) NOT NULL,
  batch_id INTEGER REFERENCES stock_batches(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- For supplier returns: the price the supplier is buying back at
  return_price DECIMAL(12,2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_returns_store_id ON returns(store_id);
CREATE INDEX IF NOT EXISTS idx_returns_return_type ON returns(return_type);
CREATE INDEX IF NOT EXISTS idx_returns_sale_id ON returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_supplier_id ON returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_product_id ON return_items(product_id);

-- Enable RLS
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow service role full access)
CREATE POLICY "Service role full access on returns" ON returns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on return_items" ON return_items FOR ALL USING (true) WITH CHECK (true);
