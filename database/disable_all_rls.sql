-- COMPREHENSIVE FIX: Disable RLS on All Tables (For Testing)
-- Run this in Supabase SQL Editor to quickly fix all RLS issues

-- Disable RLS on all tables
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('products', 'sales', 'sale_items', 'expenses', 'payments', 'users');

-- You should see rowsecurity = false for all tables

-- ⚠️ IMPORTANT: This is for TESTING/DEVELOPMENT ONLY
-- For production, you should create proper RLS policies instead
-- To re-enable RLS later, use:
-- ALTER TABLE tablename ENABLE ROW LEVEL SECURITY;
