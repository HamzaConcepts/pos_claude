-- Add requires_imei column to categories table
-- This allows explicit control over which categories need IMEI tracking

ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS requires_imei BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN categories.requires_imei IS 'If true, all products in this category will require IMEI tracking (for phones, tablets, etc.)';

-- Update existing categories that have 'phone' or 'mobile' in their name to require IMEI
UPDATE categories 
SET requires_imei = TRUE 
WHERE LOWER(name) LIKE '%phone%' OR LOWER(name) LIKE '%mobile%';
