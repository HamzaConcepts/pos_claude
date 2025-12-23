-- Migration: Add Predefined Expenses Table
-- This enables store managers to define recurring/common expenses for quick selection

-- Create predefined_expenses table
CREATE TABLE IF NOT EXISTS predefined_expenses (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  default_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_predefined_expenses_store_id ON predefined_expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_predefined_expenses_is_active ON predefined_expenses(is_active);

-- Add RLS policies
ALTER TABLE predefined_expenses ENABLE ROW LEVEL SECURITY;

-- Policy: Managers can view predefined expenses for their store
CREATE POLICY "Managers can view predefined expenses for their store"
  ON predefined_expenses FOR SELECT
  TO authenticated
  USING (
    store_id IN (
      SELECT store_id FROM managers WHERE user_id = auth.uid()
    )
  );

-- Policy: Managers can insert predefined expenses for their store
CREATE POLICY "Managers can insert predefined expenses for their store"
  ON predefined_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    store_id IN (
      SELECT store_id FROM managers WHERE user_id = auth.uid()
    )
  );

-- Policy: Managers can update predefined expenses for their store
CREATE POLICY "Managers can update predefined expenses for their store"
  ON predefined_expenses FOR UPDATE
  TO authenticated
  USING (
    store_id IN (
      SELECT store_id FROM managers WHERE user_id = auth.uid()
    )
  );

-- Policy: Managers can delete predefined expenses for their store
CREATE POLICY "Managers can delete predefined expenses for their store"
  ON predefined_expenses FOR DELETE
  TO authenticated
  USING (
    store_id IN (
      SELECT store_id FROM managers WHERE user_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON TABLE predefined_expenses IS 
'Pre-defined expense templates that can be quickly selected when recording expenses. Helps with recurring expenses like rent, utilities, etc.';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_predefined_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_predefined_expenses_timestamp
  BEFORE UPDATE ON predefined_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_predefined_expenses_updated_at();

-- Insert some default predefined expenses for testing
-- (These will only be inserted if stores exist)
INSERT INTO predefined_expenses (store_id, name, category, default_amount, description)
SELECT 
  s.id,
  e.name,
  e.category,
  e.default_amount,
  e.description
FROM stores s
CROSS JOIN (
  VALUES 
    ('Monthly Rent', 'Rent', 50000, 'Monthly store rent payment'),
    ('Electricity Bill', 'Utilities', 15000, 'Monthly electricity bill'),
    ('Water Bill', 'Utilities', 2000, 'Monthly water bill'),
    ('Internet & Phone', 'Utilities', 5000, 'Internet and phone charges'),
    ('Store Cleaning', 'Maintenance', 3000, 'Monthly cleaning service'),
    ('Security Service', 'Miscellaneous', 8000, 'Monthly security charges')
) AS e(name, category, default_amount, description)
WHERE s.id = (SELECT MIN(id) FROM stores)
LIMIT 6;
