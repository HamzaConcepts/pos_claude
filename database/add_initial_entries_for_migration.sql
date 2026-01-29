-- =====================================================
-- MIGRATION: ADD INITIAL CUSTOMER AND SUPPLIER ENTRIES
-- =====================================================
-- This migration adds tables to track initial customer and supplier balances
-- when migrating from another system to this POS.
-- These entries DO NOT affect profit/loss calculations.
-- Date: January 28, 2026
-- =====================================================

-- Table: Initial Customer Entries
-- =====================================================
-- Tracks customers who owe money when migrating to this POS
CREATE TABLE IF NOT EXISTS public.initial_customer_entries (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_name VARCHAR(100) NOT NULL,
  customer_cnic VARCHAR(20),
  customer_phone VARCHAR(20),
  amount_owed NUMERIC(10, 2) NOT NULL CHECK (amount_owed >= 0),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_initial_customers_store_id ON public.initial_customer_entries(store_id);
CREATE INDEX IF NOT EXISTS idx_initial_customers_phone ON public.initial_customer_entries(customer_phone);

COMMENT ON TABLE public.initial_customer_entries IS 'Initial customer balances when migrating to this POS - customers who owe money';
COMMENT ON COLUMN public.initial_customer_entries.amount_owed IS 'Amount customer owes at migration time - does not affect profit/loss';


-- Table: Initial Supplier Entries
-- =====================================================
-- Tracks suppliers to whom we owe money when migrating to this POS
CREATE TABLE IF NOT EXISTS public.initial_supplier_entries (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_name VARCHAR(100) NOT NULL,
  contact_person VARCHAR(100),
  supplier_phone VARCHAR(20),
  supplier_email VARCHAR(100),
  address TEXT,
  amount_owed NUMERIC(10, 2) NOT NULL CHECK (amount_owed >= 0),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_initial_suppliers_store_id ON public.initial_supplier_entries(store_id);
CREATE INDEX IF NOT EXISTS idx_initial_suppliers_phone ON public.initial_supplier_entries(supplier_phone);

COMMENT ON TABLE public.initial_supplier_entries IS 'Initial supplier balances when migrating to this POS - suppliers to whom we owe money';
COMMENT ON COLUMN public.initial_supplier_entries.amount_owed IS 'Amount we owe supplier at migration time - does not affect profit/loss';


-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_initial_customers_created_at ON public.initial_customer_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_initial_suppliers_created_at ON public.initial_supplier_entries(created_at DESC);
