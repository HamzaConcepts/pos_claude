# Seed Data Instructions

## Problem
You're not seeing the products from `database/seed.sql` in the application.

## Reason
The seed data SQL file needs to be manually executed in your Supabase database. The file exists in your project but hasn't been run yet.

## Solution - Load Seed Data

Follow these steps to load the sample products into your database:

### Step 1: Access Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project: `ijwebgttmgxovcjbcowh`
3. Click on **SQL Editor** in the left sidebar

### Step 2: Run the Schema (if not already done)
1. Open `database/schema.sql` from your project
2. Copy the entire contents
3. Paste into the Supabase SQL Editor
4. Click **Run** or press `Ctrl+Enter`
5. Wait for confirmation that all tables were created

### Step 3: Load Sample Products
1. Open `database/seed.sql` from your project
2. Copy the **Products INSERT statement** (lines 5-16):
```sql
INSERT INTO products (name, sku, description, price, cost_price, stock_quantity, low_stock_threshold, category) VALUES
('Product A', 'PRD-001', 'Sample product A description', 29.99, 15.00, 100, 10, 'Electronics'),
('Product B', 'PRD-002', 'Sample product B description', 49.99, 25.00, 5, 10, 'Electronics'),
('Product C', 'PRD-003', 'Sample product C description', 19.99, 10.00, 50, 15, 'Accessories'),
('Product D', 'PRD-004', 'Sample product D description', 39.99, 20.00, 75, 10, 'Electronics'),
('Product E', 'PRD-005', 'Sample product E description', 15.99, 8.00, 120, 20, 'Accessories'),
('Product F', 'PRD-006', 'Sample product F description', 59.99, 30.00, 8, 10, 'Premium'),
('Product G', 'PRD-007', 'Sample product G description', 24.99, 12.00, 90, 15, 'Accessories'),
('Product H', 'PRD-008', 'Sample product H description', 89.99, 45.00, 3, 5, 'Premium'),
('Product I', 'PRD-009', 'Sample product I description', 12.99, 6.00, 200, 25, 'Basic'),
('Product J', 'PRD-010', 'Sample product J description', 34.99, 17.50, 60, 10, 'Electronics');
```
3. Paste into the Supabase SQL Editor
4. Click **Run** or press `Ctrl+Enter`
5. You should see: "Success. No rows returned"

### Step 4: Verify Data
1. In Supabase Dashboard, go to **Table Editor**
2. Click on **products** table
3. You should see 10 products (Product A through Product J)

### Step 5: Refresh Your Application
1. Go back to your POS application at http://localhost:3000
2. Navigate to **Inventory** page
3. You should now see all 10 products!

## Quick SQL Command (Copy-Paste Ready)

If you want to run everything at once in the SQL Editor:

```sql
-- Load sample products
INSERT INTO products (name, sku, description, price, cost_price, stock_quantity, low_stock_threshold, category) VALUES
('Product A', 'PRD-001', 'Sample product A description', 29.99, 15.00, 100, 10, 'Electronics'),
('Product B', 'PRD-002', 'Sample product B description', 49.99, 25.00, 5, 10, 'Electronics'),
('Product C', 'PRD-003', 'Sample product C description', 19.99, 10.00, 50, 15, 'Accessories'),
('Product D', 'PRD-004', 'Sample product D description', 39.99, 20.00, 75, 10, 'Electronics'),
('Product E', 'PRD-005', 'Sample product E description', 15.99, 8.00, 120, 20, 'Accessories'),
('Product F', 'PRD-006', 'Sample product F description', 59.99, 30.00, 8, 10, 'Premium'),
('Product G', 'PRD-007', 'Sample product G description', 24.99, 12.00, 90, 15, 'Accessories'),
('Product H', 'PRD-008', 'Sample product H description', 89.99, 45.00, 3, 5, 'Premium'),
('Product I', 'PRD-009', 'Sample product I description', 12.99, 6.00, 200, 25, 'Basic'),
('Product J', 'PRD-010', 'Sample product J description', 34.99, 17.50, 60, 10, 'Electronics');
```

## Alternative: Add Products via UI

You can also add products directly through the application:

1. Login to your POS application
2. Go to **Inventory** page
3. Click **Add Product** button
4. Fill in the product details:
   - Name: e.g., "Laptop Computer"
   - SKU: e.g., "LAP-001" (must be unique)
   - Description: Brief description
   - Price: Selling price
   - Cost Price: What you paid for it
   - Stock Quantity: How many you have
   - Low Stock Threshold: Alert when stock falls below this
   - Category: e.g., "Electronics"
5. Click **Save**

## Troubleshooting

### If you still don't see products:

1. **Check database connection**: Make sure `.env.local` has correct Supabase credentials
2. **Check console**: Open browser DevTools (F12) and check Console for errors
3. **Check Network tab**: Look for the `/api/products` request and see what it returns
4. **Verify RLS policies**: In Supabase Dashboard > Authentication > Policies, make sure products table has proper read policies
5. **Check if you're logged in**: You need to be authenticated to see products

### Check Row Level Security (RLS)

If RLS is blocking access, run this in SQL Editor:

```sql
-- Allow authenticated users to read products
CREATE POLICY "Allow authenticated users to read products"
ON products FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert products
CREATE POLICY "Allow authenticated users to insert products"
ON products FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update products
CREATE POLICY "Allow authenticated users to update products"
ON products FOR UPDATE
TO authenticated
USING (true);

-- Allow authenticated users to delete products
CREATE POLICY "Allow authenticated users to delete products"
ON products FOR DELETE
TO authenticated
USING (true);
```

## Next Steps

After loading the seed data, you should:
1. Test the Inventory page - see all products
2. Test the POS page - search and add products to cart
3. Create a test sale
4. View the dashboard to see updated statistics

---

**Note**: The seed data includes 10 sample products across different categories (Electronics, Accessories, Premium, Basic) with varying stock levels to test the low stock alert feature.
