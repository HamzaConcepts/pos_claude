-- Add cashier support to expenses table
-- Expenses can be recorded by either managers (UUID) or cashiers (INTEGER)

ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS recorded_by_cashier_id INTEGER REFERENCES cashier_accounts(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_expenses_recorded_by_cashier ON expenses(recorded_by_cashier_id);

COMMENT ON COLUMN expenses.recorded_by_cashier_id IS 'ID of cashier who recorded this expense (if applicable)';
COMMENT ON COLUMN expenses.recorded_by IS 'UUID of manager who recorded this expense (if applicable)';
