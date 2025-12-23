-- Add salary column to cashiers table
ALTER TABLE cashiers ADD COLUMN IF NOT EXISTS salary DECIMAL(10,2) DEFAULT 0;

-- Comment on the salary column
COMMENT ON COLUMN cashiers.salary IS 'Monthly salary for the cashier';

-- Update the updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for cashiers table
DROP TRIGGER IF EXISTS update_cashiers_updated_at ON cashiers;
CREATE TRIGGER update_cashiers_updated_at
    BEFORE UPDATE ON cashiers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
