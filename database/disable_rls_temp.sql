-- TEMPORARY FIX: Disable RLS for Testing
-- This will allow you to see products immediately
-- Run this in Supabase SQL Editor

-- Disable RLS on products table (for testing only)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- Verify it's disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'products';

-- Check if products exist
SELECT COUNT(*) as total_products FROM products;

-- View all products
SELECT id, name, sku, price, stock_quantity FROM products;

-- ⚠️ IMPORTANT: This is for TESTING ONLY
-- After confirming products show up in your app, re-enable RLS:
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
