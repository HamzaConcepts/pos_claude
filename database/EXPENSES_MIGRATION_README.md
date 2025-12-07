# Expenses Tracking System Migration

This migration adds automatic expense tracking for inventory restocking, while allowing initial stock setup without affecting expense reports.

## Prerequisites

✅ Your database already has an `expenses` table with these columns:
- `id`, `description`, `amount`, `category`, `expense_date`, `recorded_by`, `store_id`

## What This Migration Does

1. **Adds `is_initial_stock` flag** to `stock_batches` table - Distinguishes initial migration stock from regular restocking
2. **Adds `reference_id` column** to `expenses` table - Links expenses back to stock batches
3. **Adds `lowest_negotiable_price` column** to `stock_batches` (if missing)
4. **Creates automatic expense recording** - Triggers automatically create expense records when restocking (except for initial stock)
5. **Creates expense summary view** - Aggregates expenses by category and time period

## How to Apply

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `add_expenses_tracking.sql`
5. Click **Run** or press `Ctrl+Enter`

### Option 2: Supabase CLI
```bash
supabase db push --file database/add_expenses_tracking.sql
```

## How It Works

### Initial Stock (No Expense)
When adding stock via **Store → Initial Stock** tab:
- Stock batch is created with `is_initial_stock = TRUE`
- NO expense record is created
- Stock appears in inventory immediately
- Use this for migrating existing inventory to the platform

### Regular Restocking (Creates Expense)
When adding stock via **Inventory → Restock** button:
- Stock batch is created with `is_initial_stock = FALSE` (default)
- Expense record is AUTOMATICALLY created via database trigger
- Expense `category` = `'inventory_restock'`
- Expense `amount` = `cost_price × quantity_purchased`
- Expense `reference_id` links to the batch ID
- Expense `description` = `'Inventory restock - Batch #[batch_number]'`

## Expense Categories

The existing expenses table uses a `category` VARCHAR(50) field. Common categories:
- `inventory_restock` - Automatic when restocking inventory (set by trigger)
- `utilities` - Power, water, internet bills
- `salary` - Employee wages
- `rent` - Store rental costs
- Other custom categories as needed

## Future Enhancements

You can manually add other expense types (utilities, rent, salaries) through API calls or a future Expenses management page:

```javascript
await fetch('/api/expenses', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    category: 'utilities',
    description: 'Electricity bill - December 2025',
    amount: 150.00,
    expense_date: '2025-12-01',
    store_id: yourStoreId
  })
})
```

## Verification

After running the migration, verify it worked:

```sql
-- Check if is_initial_stock column exists in stock_batches
SELECT is_initial_stock FROM stock_batches LIMIT 1;

-- Check if reference_id column exists in expenses
SELECT reference_id FROM expenses LIMIT 1;

-- Check if trigger exists
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'trigger_create_restock_expense';

-- Check expense summary view
SELECT * FROM expense_summary LIMIT 5;
```

## Rollback (If Needed)

If you need to remove this feature:

```sql
-- Remove trigger and function
DROP TRIGGER IF EXISTS trigger_create_restock_expense ON stock_batches;
DROP FUNCTION IF EXISTS create_restock_expense();

-- Remove added columns
ALTER TABLE stock_batches DROP COLUMN IF EXISTS is_initial_stock;
ALTER TABLE expenses DROP COLUMN IF EXISTS reference_id;

-- Remove view
DROP VIEW IF EXISTS expense_summary;

-- Note: We don't drop the expenses table since it existed before this migration
```

## Support

If you encounter any issues:
1. Check the SQL error message
2. Verify you have the necessary permissions
3. Ensure stock_batches and stores tables exist
4. Check that RLS is enabled on your project
