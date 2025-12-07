# Supplier Khaata Migration Guide

## Overview
This migration adds the `supplier_khaata` table to track partial payments made to suppliers when purchasing inventory.

## What It Does

1. **Creates supplier_khaata table** with the following columns:
   - `id` - Primary key
   - `stock_batch_id` - Links to the stock batch purchased
   - `supplier_id` - Links to the supplier
   - `supplier_name`, `supplier_phone`, `supplier_contact` - Supplier details
   - `total_amount` - Total cost of purchase
   - `amount_paid` - Amount already paid
   - `amount_remaining` - Outstanding balance
   - `store_id` - Multi-tenant isolation
   - `notes` - Optional notes
   - `created_at`, `updated_at` - Timestamps

2. **Creates indexes** for fast queries:
   - `idx_supplier_khaata_store_id`
   - `idx_supplier_khaata_supplier_id`
   - `idx_supplier_khaata_stock_batch_id`
   - `idx_supplier_khaata_supplier_phone`

3. **Creates trigger** to auto-update `updated_at` timestamp

4. **Enables RLS** with policies for multi-tenant security

5. **Creates view** `supplier_khaata_summary` for aggregated reporting

## Prerequisites

- Existing tables: `stores`, `suppliers`, `stock_batches`
- Supabase project with admin access
- SQL Editor access

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Login to your Supabase project
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the entire contents of `add_supplier_khaata.sql`
5. Click **Run** or press `Ctrl+Enter`
6. Verify success message

### Option 2: Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push

# Or apply specific migration
psql $DATABASE_URL -f database/add_supplier_khaata.sql
```

## Verification

After applying the migration, run these queries to verify:

### 1. Check if table exists
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'supplier_khaata'
);
-- Should return: true
```

### 2. Check indexes
```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'supplier_khaata';
-- Should return 4 indexes
```

### 3. Check RLS policies
```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'supplier_khaata';
-- Should return 4 policies (SELECT, INSERT, UPDATE, DELETE)
```

### 4. Check view
```sql
SELECT EXISTS (
  SELECT FROM information_schema.views 
  WHERE table_schema = 'public' 
  AND table_name = 'supplier_khaata_summary'
);
-- Should return: true
```

### 5. Test insert (optional)
```sql
-- This should work if you have valid IDs
INSERT INTO supplier_khaata (
  stock_batch_id,
  supplier_id,
  supplier_name,
  supplier_phone,
  total_amount,
  amount_paid,
  amount_remaining,
  store_id
) VALUES (
  1,
  1,
  'Test Supplier',
  '03001234567',
  50000,
  30000,
  20000,
  1
);

-- Then delete the test record
DELETE FROM supplier_khaata WHERE supplier_name = 'Test Supplier';
```

## Rollback

If you need to undo this migration:

```sql
DROP VIEW IF EXISTS supplier_khaata_summary;
DROP TRIGGER IF EXISTS trigger_update_supplier_khaata_updated_at ON supplier_khaata;
DROP FUNCTION IF EXISTS update_supplier_khaata_updated_at();
DROP TABLE IF EXISTS public.supplier_khaata CASCADE;
```

**⚠️ Warning**: This will permanently delete all supplier khaata records!

## Troubleshooting

### Error: relation "suppliers" does not exist
**Solution**: Ensure the `suppliers` table exists first. Check your database schema.

### Error: relation "stock_batches" does not exist
**Solution**: Ensure the `stock_batches` table exists first. This is part of your inventory system.

### Error: permission denied
**Solution**: Make sure you're running this with a user that has CREATE TABLE permissions (usually the service role or postgres user).

### RLS Policies Not Working
**Solution**: 
1. Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'supplier_khaata';`
2. Check policies exist: `SELECT * FROM pg_policies WHERE tablename = 'supplier_khaata';`
3. Ensure users are authenticated via Supabase Auth

## Post-Migration Steps

After successful migration:

1. ✅ Restart your Next.js development server
2. ✅ Test adding a product with partial payment
3. ✅ Navigate to Supplier Khaata page and verify it loads
4. ✅ Test editing a payment record
5. ✅ Verify aggregation is working correctly

## Integration with Application

The application will automatically use this table when:

1. **Adding new products** (`AddStockModal`):
   - User enters amount paid in step 3
   - If `amount_paid < total_amount`, record is created

2. **Restocking products** (`RestockModal`):
   - User enters amount paid
   - Partial payments trigger khaata record creation

3. **Viewing accounts** (`/dashboard/supplier-khaata`):
   - Displays all records grouped by supplier
   - Shows outstanding balances

## Schema Diagram

```
supplier_khaata
├── id (PK)
├── stock_batch_id (FK → stock_batches)
├── supplier_id (FK → suppliers)
├── supplier_name
├── supplier_phone
├── supplier_contact
├── total_amount
├── amount_paid
├── amount_remaining (calculated: total - paid)
├── store_id (FK → stores)
├── notes
├── created_at
└── updated_at
```

## Support

If you encounter issues:

1. Check the migration file syntax
2. Verify foreign key references exist
3. Check Supabase logs for detailed error messages
4. Ensure your database schema matches the expected structure

---

**Migration File**: `database/add_supplier_khaata.sql`  
**Created**: December 7, 2025  
**Version**: 1.0
