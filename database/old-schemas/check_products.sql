-- Quick diagnostic queries to check product data
-- Run these in Supabase SQL Editor to verify your setup

-- 1. Check if products table exists and has data
SELECT COUNT(*) as total_products FROM products;

-- 2. View all products
SELECT id, name, sku, price, stock_quantity, category FROM products ORDER BY id;

-- 3. Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'products';

-- 4. Check existing RLS policies
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'products';

-- 5. Test if you can select (run this while logged in)
SELECT * FROM products LIMIT 5;

-- If the last query fails with permission error, RLS is blocking you
-- Run the fix_rls_policies.sql script to fix it
