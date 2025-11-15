-- Fix RLS Policies for Sales and Related Tables
-- Run this in Supabase SQL Editor

-- Drop existing policies for sales
DROP POLICY IF EXISTS "Anyone authenticated can view sales" ON sales;
DROP POLICY IF EXISTS "Anyone authenticated can create sales" ON sales;

-- Drop existing policies for sale_items
DROP POLICY IF EXISTS "Anyone can view sale_items" ON sale_items;
DROP POLICY IF EXISTS "Anyone can insert sale_items" ON sale_items;

-- Create new policies for sales table
CREATE POLICY "authenticated_users_read_sales" ON sales
    FOR SELECT 
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_users_insert_sales" ON sales
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_users_update_sales" ON sales
    FOR UPDATE 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create new policies for sale_items table
CREATE POLICY "authenticated_users_read_sale_items" ON sale_items
    FOR SELECT 
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_users_insert_sale_items" ON sale_items
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_users_update_sale_items" ON sale_items
    FOR UPDATE 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Verify policies are created
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('sales', 'sale_items')
ORDER BY tablename, policyname;
