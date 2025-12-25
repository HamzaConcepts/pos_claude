-- Add payment_method column to expenses table

ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Digital'));

-- Add index for reporting
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON expenses(payment_method);

COMMENT ON COLUMN expenses.payment_method IS 'Payment method used for the expense (Cash or Digital)';

-- Update existing expenses to have 'Cash' as default if null
UPDATE expenses SET payment_method = 'Cash' WHERE payment_method IS NULL;
