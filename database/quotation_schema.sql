-- =====================================================
-- Quotation Management Feature - Database Schema
-- Created: 2026-02-15
-- Description: Tables for quotation management system
-- =====================================================

-- 1. Quotation number sequences (per-store, per-year)
CREATE TABLE IF NOT EXISTS quotation_sequences (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  UNIQUE(store_id, year)
);

-- 2. Quotations (header)
CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  quotation_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Customer information
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_email VARCHAR(255),
  customer_address TEXT,
  
  -- Financial summary
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none', 'fixed', 'percentage')),
  discount_value NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  
  -- Additional details
  notes TEXT,
  terms_and_conditions TEXT,
  valid_until DATE,
  
  -- Status workflow: draft -> finalized -> expired/cancelled
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'expired', 'cancelled')),
  
  -- Multi-store
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Creator tracking (one of these will be set)
  created_by UUID,
  created_by_cashier_id INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Finalization tracking
  finalized_at TIMESTAMPTZ,
  finalized_by UUID,
  finalized_by_cashier_id INTEGER,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  deleted_by_cashier_id INTEGER
);

-- 3. Quotation items (line items)
CREATE TABLE IF NOT EXISTS quotation_items (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  
  -- Product reference (nullable for manual items)
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  
  -- Product snapshot (captured at creation time)
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  product_description TEXT,
  product_category VARCHAR(100),
  
  -- Pricing
  quantity NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(15,2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(15,2) NOT NULL,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  -- Metadata
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_manual_item BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Quotation audit logs
CREATE TABLE IF NOT EXISTS quotation_audit_logs (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  user_id UUID,
  cashier_id INTEGER,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Indexes for performance
-- =====================================================

-- Quotations: primary query patterns
CREATE INDEX IF NOT EXISTS idx_quotations_store_status_date 
  ON quotations(store_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotations_customer 
  ON quotations(customer_phone, customer_name);

CREATE INDEX IF NOT EXISTS idx_quotations_valid_until 
  ON quotations(valid_until) WHERE status = 'finalized';

CREATE INDEX IF NOT EXISTS idx_quotations_deleted 
  ON quotations(deleted_at) WHERE deleted_at IS NULL;

-- Quotation items
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation 
  ON quotation_items(quotation_id);

CREATE INDEX IF NOT EXISTS idx_quotation_items_product 
  ON quotation_items(product_id) WHERE product_id IS NOT NULL;

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_quotation_audit_quotation 
  ON quotation_audit_logs(quotation_id, created_at DESC);

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update updated_at on quotations
CREATE OR REPLACE FUNCTION update_quotation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_quotation_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW
  EXECUTE FUNCTION update_quotation_updated_at();

-- Auto-update updated_at on quotation_items
CREATE TRIGGER trigger_quotation_item_updated_at
  BEFORE UPDATE ON quotation_items
  FOR EACH ROW
  EXECUTE FUNCTION update_quotation_updated_at();

-- =====================================================
-- RLS Policies (optional - API uses service role)
-- =====================================================

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_sequences ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (API routes use this)
CREATE POLICY "Service role full access on quotations" 
  ON quotations FOR ALL 
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on quotation_items" 
  ON quotation_items FOR ALL 
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on quotation_audit_logs" 
  ON quotation_audit_logs FOR ALL 
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on quotation_sequences" 
  ON quotation_sequences FOR ALL 
  USING (true) WITH CHECK (true);
