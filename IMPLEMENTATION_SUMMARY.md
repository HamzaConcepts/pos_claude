# Implementation Summary: Initial Stock & Expense Tracking

## Changes Made

### ✅ Database Migration
**File:** `database/add_expenses_tracking.sql`

Works with your **existing expenses table**:
- Adds `is_initial_stock` BOOLEAN column to `stock_batches`
- Adds `reference_id` INTEGER column to `expenses` (links to stock_batch_id)
- Adds `lowest_negotiable_price` to `stock_batches` (if missing)
- Creates trigger `create_restock_expense()` that auto-creates expense records
- Creates `expense_summary` view for reporting

### ✅ Frontend: Store Tab - Initial Stock
**File:** `app/dashboard/store/page.tsx`

- Added "Initial Stock" tab (4th tab after Users, Categories, Store Info)
- Shows clear warnings that initial stock won't affect expenses
- Uses RestockModal with `isInitialStock={true}` prop
- Displays success message after adding initial stock

### ✅ Component: RestockModal Updates
**File:** `components/RestockModal.tsx`

- Added `isInitialStock?: boolean` prop (defaults to false)
- Passes `is_initial_stock` flag to API when creating stock batches
- Shows blue warning in modal header when adding initial stock
- Changes modal title based on mode

### ✅ API: Stock Batches
**File:** `app/api/stock-batches/route.ts`

- Accepts `is_initial_stock` in request body (defaults to false)
- Saves `is_initial_stock` flag to database
- Database trigger handles expense creation automatically

## How the Expense Tracking Works

### Existing Expenses Table Structure
```sql
expenses (
  id,
  description VARCHAR(255),
  amount NUMERIC(10, 2),
  category VARCHAR(50),          -- Will be 'inventory_restock'
  expense_date DATE,
  recorded_by UUID,
  store_id INTEGER,
  reference_id INTEGER           -- NEW: Links to stock_batch.id
)
```

### Automatic Expense Creation Flow

```
User clicks Restock (Inventory Tab)
         ↓
RestockModal (isInitialStock=false)
         ↓
POST /api/stock-batches
{ is_initial_stock: false, cost_price: 100, quantity: 10 }
         ↓
Stock batch inserted into stock_batches
         ↓
Database Trigger: create_restock_expense()
         ↓
IF is_initial_stock = FALSE:
  INSERT INTO expenses (
    category: 'inventory_restock',
    amount: 100 * 10 = 1000,
    reference_id: batch.id
  )
         ↓
Expense recorded automatically ✓
```

### Initial Stock Flow (No Expense)

```
User clicks Add Initial Stock (Store Tab)
         ↓
RestockModal (isInitialStock=true)
         ↓
POST /api/stock-batches
{ is_initial_stock: true, cost_price: 100, quantity: 10 }
         ↓
Stock batch inserted into stock_batches
         ↓
Database Trigger: create_restock_expense()
         ↓
IF is_initial_stock = TRUE:
  Skip expense creation
         ↓
No expense recorded ✓
Stock available in inventory ✓
```

## Usage Instructions

### 1. Apply Database Migration
```bash
# In Supabase Dashboard → SQL Editor
Run: database/add_expenses_tracking.sql
```

### 2. Add Initial Stock (One-Time Setup)
1. Go to **Store → Initial Stock** tab
2. Click "Add Initial Stock Items"
3. Select product, enter quantities and prices
4. Submit - stock is added, NO expense created

### 3. Regular Restocking (Ongoing)
1. Go to **Inventory** page
2. Click "Restock" button
3. Select product, enter quantities and prices
4. Submit - stock is added, expense AUTOMATICALLY created

### 4. View Expenses
Query expenses to see automatic inventory restock entries:

```sql
SELECT * FROM expenses 
WHERE category = 'inventory_restock'
ORDER BY expense_date DESC;
```

Use the expense_summary view for aggregated data:

```sql
SELECT * FROM expense_summary
WHERE store_id = 1 
  AND category = 'inventory_restock'
  AND expense_month >= '2025-12-01';
```

## Files Reference

| File | Purpose |
|------|---------|
| `database/add_expenses_tracking.sql` | Migration script (run once) |
| `database/EXPENSES_MIGRATION_README.md` | Detailed migration guide |
| `app/dashboard/store/page.tsx` | Initial Stock tab UI |
| `components/RestockModal.tsx` | Shared restock form |
| `app/api/stock-batches/route.ts` | Stock creation API |

## Benefits

✅ **Clean Migration**: Add existing inventory without affecting financial reports  
✅ **Automatic Tracking**: Future restocks automatically recorded as expenses  
✅ **Accurate Financials**: Net profit calculation can deduct inventory costs  
✅ **Audit Trail**: Every restock expense linked back to specific batch via reference_id  
✅ **Flexible Categories**: Supports multiple expense types beyond inventory  
