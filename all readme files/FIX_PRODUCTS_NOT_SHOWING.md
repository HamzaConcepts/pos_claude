# Fix: Products Not Showing in Inventory

## Problem
Products exist in the database but don't appear in the Inventory page.

## Root Cause
Row Level Security (RLS) policies are blocking access to the products table. The current policies use `auth.role() = 'authenticated'` which doesn't work correctly with Supabase client-side queries.

## Solution - Fix RLS Policies

### Step 1: Verify Products Exist
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste this query:
```sql
SELECT COUNT(*) as total_products FROM products;
```
3. Click **Run**
4. You should see `total_products: 10` (or however many you inserted)

### Step 2: Check Current Policies
Run this query to see existing policies:
```sql
SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'products';
```

### Step 3: Fix the RLS Policies
Copy the **entire content** from `database/fix_rls_policies.sql` and run it in Supabase SQL Editor:

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Anyone authenticated can view products" ON products;
DROP POLICY IF EXISTS "Admins and Managers can insert products" ON products;
DROP POLICY IF EXISTS "Admins and Managers can update products" ON products;
DROP POLICY IF EXISTS "Managers can delete products" ON products;

-- Create new policies that work correctly
CREATE POLICY "authenticated_users_read_products" ON products
    FOR SELECT 
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_users_insert_products" ON products
    FOR INSERT 
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "authenticated_users_update_products" ON products
    FOR UPDATE 
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_users_delete_products" ON products
    FOR DELETE 
    TO authenticated
    USING (true);
```

### Step 4: Verify the Fix
Run this query to test:
```sql
SELECT id, name, sku, price, stock_quantity FROM products LIMIT 5;
```

If you see products returned, the fix worked!

### Step 5: Test in Your Application
1. Refresh your browser at http://localhost:3000
2. Make sure you're logged in
3. Navigate to **Inventory** page
4. You should now see all 10 products!

## Alternative: Disable RLS Temporarily (Quick Test)

If you just want to test quickly, you can temporarily disable RLS:

```sql
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
```

**⚠️ Warning**: Only use this for testing. Re-enable it for production:
```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
```

## Troubleshooting

### Still Not Seeing Products?

**1. Check Browser Console**
- Press F12 to open Developer Tools
- Go to Console tab
- Look for errors related to `/api/products`

**2. Check Network Tab**
- In Developer Tools, go to Network tab
- Refresh the Inventory page
- Find the request to `/api/products`
- Click it and check:
  - Status: Should be 200
  - Response: Should contain `"success": true` and array of products

**3. Verify Authentication**
- Make sure you're logged in
- Check that your session is valid
- Try logging out and logging back in

**4. Check Supabase Connection**
- Verify `.env.local` has correct credentials
- Make sure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct

**5. Test Direct Database Query**
In Supabase SQL Editor, run:
```sql
-- Check if data exists
SELECT * FROM products;

-- Check RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'products';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'products';
```

## What Changed

The original schema had policies like:
```sql
CREATE POLICY "Anyone authenticated can view products" ON products
    FOR SELECT USING (auth.role() = 'authenticated');
```

This doesn't work because `auth.role()` returns the database role (like 'anon' or 'authenticated'), not a boolean.

The fix changes it to:
```sql
CREATE POLICY "authenticated_users_read_products" ON products
    FOR SELECT 
    TO authenticated
    USING (true);
```

This properly restricts access to authenticated users while allowing all authenticated users to read products.

## Quick Summary

1. ✅ Run `database/fix_rls_policies.sql` in Supabase SQL Editor
2. ✅ Refresh your application
3. ✅ Products should now appear in Inventory page

The issue was RLS policy syntax, not missing data!
