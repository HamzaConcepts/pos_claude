-- Create khaata_customers table for tracking customer account balances
-- This table supports the Khaata System feature (Manager-only)

CREATE TABLE IF NOT EXISTS khaata_customers (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  total_amount DECIMAL(10,2) DEFAULT 0 CHECK (total_amount >= 0),
  amount_paid DECIMAL(10,2) DEFAULT 0 CHECK (amount_paid >= 0),
  amount_remaining DECIMAL(10,2) DEFAULT 0 CHECK (amount_remaining >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for search performance
CREATE INDEX IF NOT EXISTS idx_khaata_customers_name ON khaata_customers(customer_name);
CREATE INDEX IF NOT EXISTS idx_khaata_customers_phone ON khaata_customers(customer_phone);
CREATE INDEX IF NOT EXISTS idx_khaata_customers_created_at ON khaata_customers(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE khaata_customers IS 'Stores customer account information for tracking amounts owed, paid, and remaining balances';
COMMENT ON COLUMN khaata_customers.customer_name IS 'Full name of the customer';
COMMENT ON COLUMN khaata_customers.customer_phone IS 'Contact phone number';
COMMENT ON COLUMN khaata_customers.total_amount IS 'Total amount owed by customer';
COMMENT ON COLUMN khaata_customers.amount_paid IS 'Total amount paid by customer';
COMMENT ON COLUMN khaata_customers.amount_remaining IS 'Remaining balance (total_amount - amount_paid)';
COMMENT ON COLUMN khaata_customers.notes IS 'Additional notes (e.g., "Sold iPhone 12, will pay Friday")';

-- Enable Row Level Security (optional, uncomment if needed)
-- ALTER TABLE khaata_customers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (optional, uncomment if needed)
-- CREATE POLICY "Enable read access for authenticated users" ON khaata_customers
--   FOR SELECT USING (auth.role() = 'authenticated');
-- CREATE POLICY "Enable insert for authenticated users" ON khaata_customers
--   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Enable update for authenticated users" ON khaata_customers
--   FOR UPDATE USING (auth.role() = 'authenticated');
-- CREATE POLICY "Enable delete for authenticated users" ON khaata_customers
--   FOR DELETE USING (auth.role() = 'authenticated');

-- Verification query (run after table creation)
-- SELECT 
--   table_name, 
--   column_name, 
--   data_type, 
--   is_nullable,
--   column_default
-- FROM information_schema.columns
-- WHERE table_name = 'khaata_customers'
-- ORDER BY ordinal_position;
