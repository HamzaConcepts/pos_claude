-- Add balance tracking to suppliers table
-- This allows tracking outstanding amounts owed to suppliers

ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS balance_owed DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS initial_balance DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS total_paid DECIMAL(10, 2) DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN suppliers.balance_owed IS 'Current outstanding balance owed to this supplier';
COMMENT ON COLUMN suppliers.initial_balance IS 'Initial balance when supplier was added (for migration)';
COMMENT ON COLUMN suppliers.last_payment_date IS 'Date of last payment to supplier';
COMMENT ON COLUMN suppliers.total_paid IS 'Total amount paid to supplier over time';

-- Create supplier payments tracking table
CREATE TABLE IF NOT EXISTS supplier_payments (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Digital')),
    payment_date TIMESTAMP DEFAULT NOW(),
    recorded_by_manager_id UUID REFERENCES managers(id),
    recorded_by_cashier_id INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_store ON supplier_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(payment_date);

COMMENT ON TABLE supplier_payments IS 'Tracks all payments made to suppliers';
