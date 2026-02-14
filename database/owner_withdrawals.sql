-- Owner Withdrawals Table
-- Tracks money taken out by owner from cash or bank
-- These withdrawals do NOT affect profit/loss calculations
-- They only reduce cash in hand or bank balance

CREATE TABLE IF NOT EXISTS owner_withdrawals (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    withdrawal_from VARCHAR(20) NOT NULL CHECK (withdrawal_from IN ('Cash', 'Bank')),
    description TEXT,
    withdrawal_date DATE NOT NULL,
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE owner_withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view withdrawals from their store"
ON owner_withdrawals
FOR SELECT
TO authenticated
USING (store_id = get_user_store_id());

CREATE POLICY "Managers can insert withdrawals in their store"
ON owner_withdrawals
FOR INSERT
TO authenticated
WITH CHECK (store_id = get_user_store_id());

CREATE POLICY "Managers can update withdrawals in their store"
ON owner_withdrawals
FOR UPDATE
TO authenticated
USING (store_id = get_user_store_id());

CREATE POLICY "Managers can delete withdrawals from their store"
ON owner_withdrawals
FOR DELETE
TO authenticated
USING (store_id = get_user_store_id());

-- Index for performance
CREATE INDEX idx_owner_withdrawals_store_id ON owner_withdrawals(store_id);
CREATE INDEX idx_owner_withdrawals_date ON owner_withdrawals(withdrawal_date);

-- Comment
COMMENT ON TABLE owner_withdrawals IS 'Tracks owner capital withdrawals. These do NOT affect profit/loss - only cash/bank balance.';
