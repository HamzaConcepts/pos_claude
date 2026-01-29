# Average Price Update - Migration Notes

## What Changed?

The `average_price` field calculation has been updated:

### Before:
- **Formula:** Weighted average of **cost prices**
- **Calculation:** `SUM(cost_price × qty_remaining) / SUM(qty_remaining)`
- **Purpose:** Track average cost for profit calculation

### After:
- **Formula:** Weighted average of **selling prices** (target_price)
- **Calculation:** `SUM(target_price × qty_remaining) / SUM(qty_remaining)`
- **Purpose:** Track average selling price across stock batches

## UI Changes:

### Inventory Table:
- ❌ **Removed:** "Min Price" column
- ✅ **Renamed:** "Avg Price" → "Selling Price"
- ✅ **Simplified:** Now shows only Target Price and Selling Price

### Display Logic:
- **Before:** Average price shown in blue badge only when different from target
- **After:** Selling price always displayed (weighted average of target prices)

## Why This Change?

1. **Clarity:** "Selling Price" is more intuitive than "Average Price"
2. **Accuracy:** Reflects the actual average selling price based on stock
3. **Simplification:** Reduced columns from 3 prices to 2
4. **Business Logic:** When batches have same target_price, selling price = target price

## Migration Steps:

1. **Run SQL Migration:**
   ```bash
   # Execute this file in your database
   database/update_average_price_to_selling.sql
   ```

2. **What the migration does:**
   - Drops old function and trigger
   - Creates new function using target_price instead of cost_price
   - Recreates trigger
   - Recalculates all existing products

3. **Verify:**
   ```sql
   -- Check a few products
   SELECT 
     name,
     target_price,
     average_price,
     cost_price
   FROM products
   WHERE is_active = true
   LIMIT 10;
   ```

## Example Calculation:

**Scenario:** Product has 2 batches, both with target_price = $100

| Batch | Target Price | Quantity | Weight |
|-------|-------------|----------|--------|
| Batch 1 | $100 | 5 units | 5 × $100 = $500 |
| Batch 2 | $100 | 10 units | 10 × $100 = $1000 |

**Calculation:**
```
Selling Price (average_price) = ($500 + $1000) / (5 + 10) = $1500 / 15 = $100
```

**Scenario 2:** Product batches with different target prices

| Batch | Target Price | Quantity | Weight |
|-------|-------------|----------|--------|
| Batch 1 | $90 | 5 units | 5 × $90 = $450 |
| Batch 2 | $100 | 10 units | 10 × $100 = $1000 |

**Calculation:**
```
Selling Price (average_price) = ($450 + $1000) / (5 + 10) = $1450 / 15 = $96.67
```

This makes sense: if you sell from this stock, the average selling price will be $96.67.

## Impact on Other Features:

### Sales API:
- **Before:** Used `average_price` as cost for profit calculation ❌
- **After:** Uses `cost_price` for cost, `average_price` for selling price ✅

### Products API:
- **Before:** Fallback `average_price || cost_price`
- **After:** Fallback `average_price || target_price` ✅

### Inventory Display:
- Shows "Selling Price" instead of "Avg Cost"
- Hides "Min Price" completely
- Simplified pricing display

## Code Changes:

### Files Modified:
1. `database/update_average_price_to_selling.sql` - New migration
2. `app/dashboard/inventory/page.tsx` - UI updates
3. `app/api/sales/route.ts` - Use cost_price for cost calculation
4. `app/api/products/route.ts` - Fallback to target_price
5. `INVENTORY_ENHANCEMENT_SUMMARY.md` - Documentation updates

### No Impact On:
- `suppliers` table/API
- `stock_batches` table/API (stores cost_price separately)
- `product_imeis` table/API
- FIFO deduction logic
- Batch tracking
- IMEI tracking

## Testing Checklist:

- [ ] Run SQL migration successfully
- [ ] Verify average_price recalculated for all products
- [ ] Check inventory page displays "Selling Price" column
- [ ] Verify "Min Price" column is hidden
- [ ] Add new stock batch - check average_price updates
- [ ] Sell product - verify using average_price as selling price
- [ ] Check profit calculation uses cost_price (not average_price)
- [ ] Verify batch information still displays correctly

## Rollback (If Needed):

If you need to revert, run the original function from:
`database/inventory_enhancement_migration.sql` lines 160-190

Then execute:
```sql
DO $$
DECLARE
  product_record RECORD;
BEGIN
  FOR product_record IN 
    SELECT DISTINCT id FROM products WHERE is_active = true
  LOOP
    PERFORM update_product_average_price(product_record.id);
  END LOOP;
END $$;
```

---

**Migration Date:** December 6, 2024  
**Status:** Ready to deploy  
**Breaking Changes:** None (UI change only, API compatible)
