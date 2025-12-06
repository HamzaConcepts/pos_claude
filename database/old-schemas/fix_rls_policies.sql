-- Fix RLS Policies for Products Table
-- Run this in Supabase SQL Editor to fix product visibility issues

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone authenticated can view products" ON products;
DROP POLICY IF EXISTS "Admins and Managers can insert products" ON products;
DROP POLICY IF EXISTS "Admins and Managers can update products" ON products;
DROP POLICY IF EXISTS "Managers can delete products" ON products;

-- Create new policies that work correctly
-- Allow all authenticated users to read products
CREATE POLICY "authenticated_users_read_products" ON products
    FOR SELECT 
    TO authenticated
    USING (true);

-- Allow authenticated users to insert products
CREATE POLICY "authenticated_users_insert_products" ON products
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update products
CREATE POLICY "authenticated_users_update_products" ON products
    FOR UPDATE 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to delete products
CREATE POLICY "authenticated_users_delete_products" ON products
    FOR DELETE 
    TO authenticated
    USING (true);

-- Verify policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'products';
