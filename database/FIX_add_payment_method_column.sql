-- Add payment_method column to stock_batches table
-- Run this in your Supabase SQL Editor

ALTER TABLE stock_batches 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Digital'));

CREATE INDEX IF NOT EXISTS idx_stock_batches_payment_method ON stock_batches(payment_method);

COMMENT ON COLUMN stock_batches.payment_method IS 'Payment method used for purchasing this stock batch (Cash or Digital)';

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'stock_batches' 
AND column_name = 'payment_method';
