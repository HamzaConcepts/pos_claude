-- Migration: Add cashier_id to payments table
-- Date: 2024
-- Description: Adds support for tracking cashiers who record payments in addition to managers

-- Add cashier_id column
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS cashier_id INTEGER;

-- Drop the old constraint if it exists (in case this is being re-run)
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS payments_recorder_check;

-- Add constraint to ensure exactly one recorder type is set
ALTER TABLE payments 
ADD CONSTRAINT payments_recorder_check 
CHECK (
  (manager_id IS NOT NULL AND cashier_id IS NULL) OR 
  (manager_id IS NULL AND cashier_id IS NOT NULL)
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_cashier_id ON payments(cashier_id);

-- Note: This migration is safe to run multiple times (idempotent)
