-- Add currency field to stores table
-- This allows each store to set their own currency preference
-- Default is 'PKR' for backward compatibility

ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'PKR' NOT NULL;

-- Add a comment to explain the field
COMMENT ON COLUMN stores.currency IS 'Store currency code (e.g., PKR, USD, EUR, GBP, INR)';

-- Update existing stores to have PKR by default if NULL
UPDATE stores 
SET currency = 'PKR' 
WHERE currency IS NULL;
