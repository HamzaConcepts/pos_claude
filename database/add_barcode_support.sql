-- Add barcode support to products table
-- Run this in Supabase SQL Editor

-- Add barcode column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);

-- Add unique constraint for barcode (allowing nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode 
ON products(barcode) 
WHERE barcode IS NOT NULL;

-- Add index for fast barcode lookups
CREATE INDEX IF NOT EXISTS idx_products_barcode_search 
ON products(barcode);

-- For phones, IMEI numbers in product_imeis table act as individual barcodes
-- Add index for fast IMEI barcode lookups
CREATE INDEX IF NOT EXISTS idx_product_imeis_imei_search 
ON product_imeis(imei_number) 
WHERE status = 'in_stock';

COMMENT ON COLUMN products.barcode IS 'Barcode for non-phone products. For phones, use IMEI from product_imeis table.';
