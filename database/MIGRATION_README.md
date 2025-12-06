# Database Schema Migration: Aggregated Stock Implementation

## Overview
This migration introduces a new `aggregated_stock` table to centralize stock and pricing data, removing redundant price columns from the `products` table and adding `lowest_negotiable_price` to `stock_batches`.

## Schema Changes

### 1. New Table: `aggregated_stock`
Stores aggregated stock data with weighted average prices calculated from stock batches.

**Columns:**
- `id` (SERIAL, PK)
- `product_id` (INTEGER, FK → products.id)
- `store_id` (INTEGER, FK → stores.id)
- `aggregated_cost_price` (NUMERIC) - Weighted average of batch cost prices
- `aggregated_selling_price` (NUMERIC) - Weighted average of batch selling prices
- `aggregated_lowest_negotiable` (NUMERIC) - Weighted average of lowest negotiable prices
- `total_quantity_purchased` (INTEGER) - Sum of all batch purchases
- `total_quantity_remaining` (INTEGER) - Sum of all remaining quantities
- `total_quantity_sold` (INTEGER) - Total sold items
- `low_stock_threshold` (INTEGER) - Alert threshold
- `created_at`, `updated_at` (TIMESTAMP)

**Unique Constraint:** `(product_id, store_id)`

### 2. Modified Table: `stock_batches`
Added column for lowest negotiable price per batch.

**New Column:**
- `lowest_negotiable_price` (NUMERIC) - Minimum acceptable selling price for this batch

### 3. Modified Table: `products`
**Removed Columns** (after migration complete):
- `cost_price`
- `target_price`
- `min_sale_price`
- `average_price`

**Remaining Columns:**
- `id`, `sku`, `name`, `description`
- `category` (FK), `subcategory` (FK)
- `store_id` (FK)
- `is_active`, `is_phone`
- `created_at`, `updated_at`

## Automated Calculations

### Trigger: `update_aggregated_stock()`
Automatically maintains `aggregated_stock` table when `stock_batches` are modified.

**Trigger Events:** INSERT, UPDATE, DELETE on `stock_batches`

**Calculations:**
```sql
-- Weighted Average Cost Price
SUM(cost_price * quantity_remaining) / SUM(quantity_remaining)

-- Weighted Average Selling Price
SUM(selling_price * quantity_remaining) / SUM(quantity_remaining)

-- Weighted Average Lowest Negotiable
SUM(lowest_negotiable_price * quantity_remaining) / SUM(quantity_remaining)
```

## Implementation Steps

### Step 1: Run Database Migration ✅
```bash
psql -U your_user -d your_database -f database/new-schema-migration.sql
```

This will:
1. Add `lowest_negotiable_price` to `stock_batches`
2. Create `aggregated_stock` table
3. Create trigger functions
4. Migrate existing data to `aggregated_stock`
5. Set up automatic updates

**Verification:**
```sql
-- Check aggregated_stock has data
SELECT COUNT(*) FROM aggregated_stock;

-- Compare old vs new pricing
SELECT 
  p.sku,
  p.name,
  p.average_price as old_avg_price,
  agg.aggregated_selling_price as new_avg_price
FROM products p
LEFT JOIN aggregated_stock agg ON agg.product_id = p.id
WHERE p.is_active = true
LIMIT 10;
```

### Step 2: Update TypeScript Types ✅
File: `lib/types.ts`

**Changes:**
- ✅ Removed price fields from `Product` interface
- ✅ Added new `AggregatedStock` interface
- ✅ Updated `ProductWithBackwardCompatibility` to include aggregated data
- ✅ Added `lowest_negotiable_price` to `StockBatch` interface

### Step 3: Update API Routes 🔄
Files to modify:
- `app/api/products/route.ts` - GET and POST endpoints
- `app/api/products/[id]/route.ts` - GET and PUT endpoints
- `app/api/stock-batches/[id]/route.ts` - PUT endpoint

**Key Changes:**
- Join with `aggregated_stock` table in queries
- Remove manual price calculations
- Use aggregated values from database
- Update batch operations to include `lowest_negotiable_price`

### Step 4: Update Components ⏳
Files to modify:
- `components/AddStockModal.tsx`
- `components/BatchEditModal.tsx`
- `app/dashboard/inventory/page.tsx`

**Key Changes:**
- Add `lowest_negotiable_price` input fields
- Update API payloads
- Display aggregated prices from new table
- Remove direct product price updates

### Step 5: Final Cleanup (ONLY AFTER FULL TESTING) ⏳
After confirming everything works:

```sql
-- Remove old price columns from products table
ALTER TABLE public.products DROP COLUMN IF EXISTS cost_price;
ALTER TABLE public.products DROP COLUMN IF EXISTS target_price;
ALTER TABLE public.products DROP COLUMN IF EXISTS min_sale_price;
ALTER TABLE public.products DROP COLUMN IF EXISTS average_price;
```

## Benefits

### 1. Data Integrity
- Single source of truth for aggregated stock data
- Automatic calculations via database triggers
- No manual sync required

### 2. Performance
- Precomputed weighted averages
- Indexed lookups on `aggregated_stock`
- No runtime calculations in API

### 3. Flexibility
- Each batch can have different negotiable prices
- Historical pricing preserved in batches
- Easy to query current stock status

### 4. Simplified Queries
**Before:**
```sql
SELECT 
  p.*,
  SUM(sb.quantity_remaining) as total_stock,
  SUM(sb.cost_price * sb.quantity_remaining) / SUM(sb.quantity_remaining) as avg_cost
FROM products p
LEFT JOIN stock_batches sb ON sb.product_id = p.id
GROUP BY p.id;
```

**After:**
```sql
SELECT 
  p.*,
  agg.aggregated_selling_price,
  agg.aggregated_lowest_negotiable,
  agg.total_quantity_remaining
FROM products p
LEFT JOIN aggregated_stock agg ON agg.product_id = p.id;
```

## Data Flow

```
┌─────────────────┐
│  stock_batches  │
│                 │
│ - cost_price    │
│ - selling_price │
│ - lowest_neg..  │
│ - quantity_rem  │
└────────┬────────┘
         │
         │ Trigger: update_aggregated_stock()
         ↓
┌─────────────────────┐
│  aggregated_stock   │
│                     │
│ - aggregated_cost   │ ← Weighted Avg
│ - aggregated_sell   │ ← Weighted Avg
│ - aggregated_low    │ ← Weighted Avg
│ - total_qty_rem     │ ← Sum
└─────────────────────┘
         ↑
         │ API Joins
         │
┌─────────────────┐
│    API Layer    │
│                 │
│ GET /products   │
│ GET /products/1 │
└─────────────────┘
         ↑
         │
┌─────────────────┐
│   UI Layer      │
│                 │
│ Inventory Page  │
│ Product Modal   │
└─────────────────┘
```

## Rollback Plan

If issues arise, you can rollback:

1. **Keep old columns temporarily** - Don't drop `products` price columns until fully tested
2. **Dual write** - Update both old and new structures during transition
3. **Feature flag** - Use environment variable to toggle between old/new logic

## Testing Checklist

- [ ] Database migration runs without errors
- [ ] `aggregated_stock` table populated correctly
- [ ] Triggers update aggregated values on batch changes
- [ ] API returns correct prices from aggregated_stock
- [ ] UI displays weighted averages properly
- [ ] Adding new stock updates aggregated_stock
- [ ] Editing batch prices recalculates weighted averages
- [ ] Low stock alerts work with new threshold location
- [ ] All existing features still functional

## Support

For questions or issues during migration, refer to:
- SQL migration file: `database/new-schema-migration.sql`
- Type definitions: `lib/types.ts`
- This README file

---

**Migration Status:** In Progress
**Last Updated:** December 6, 2025
