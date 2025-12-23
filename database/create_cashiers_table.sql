-- Create cashiers table for storing cashier information per store
CREATE TABLE IF NOT EXISTS cashiers (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 0, -- Commission rate as percentage (e.g., 5.50 for 5.5%)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cashiers_store_id ON cashiers(store_id);
CREATE INDEX IF NOT EXISTS idx_cashiers_active ON cashiers(is_active);

-- Add RLS policies
ALTER TABLE cashiers ENABLE ROW LEVEL SECURITY;

-- Policy for managers to view cashiers in their store
CREATE POLICY "Managers can view cashiers in their store" ON cashiers
  FOR SELECT
  USING (
    store_id IN (
      SELECT store_id FROM managers WHERE id = auth.uid()
    )
  );

-- Policy for managers to insert cashiers in their store
CREATE POLICY "Managers can insert cashiers in their store" ON cashiers
  FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT store_id FROM managers WHERE id = auth.uid()
    )
  );

-- Policy for managers to update cashiers in their store
CREATE POLICY "Managers can update cashiers in their store" ON cashiers
  FOR UPDATE
  USING (
    store_id IN (
      SELECT store_id FROM managers WHERE id = auth.uid()
    )
  );

-- Policy for managers to delete (soft delete) cashiers in their store
CREATE POLICY "Managers can delete cashiers in their store" ON cashiers
  FOR DELETE
  USING (
    store_id IN (
      SELECT store_id FROM managers WHERE id = auth.uid()
    )
  );

-- Add cashier_id field to sales table to track which cashier made the sale
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cashier_ref_id INTEGER REFERENCES cashiers(id);

-- Comment on tables and columns
COMMENT ON TABLE cashiers IS 'Stores cashier information for each store';
COMMENT ON COLUMN cashiers.commission_rate IS 'Commission rate as percentage (e.g., 5.50 for 5.5%)';
COMMENT ON COLUMN sales.cashier_ref_id IS 'Reference to the cashier who made the sale (from cashiers table)';
