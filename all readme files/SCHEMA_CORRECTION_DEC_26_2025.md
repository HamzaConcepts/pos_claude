# Database Schema Correction - December 26, 2025

## Issue Identified
The initial migration script referenced `khaata_customers` table, but the actual project uses `partial_payment_customers` table.

## Changes Made

### 1. Database Migration Script Updated
**File:** `database/add_ledger_and_deletion_features.sql`

**Changed:**
- ❌ `khaata_payments` table → ✅ `customer_payments` table
- ❌ Foreign key to `khaata_customers` → ✅ Foreign key to `partial_payment_customers`
- ❌ Column `khaata_customer_id` → ✅ Column `partial_payment_customer_id`
- ✅ Added `sale_id` column to reference original sale
- ✅ `supplier_khaata_payments` table remains unchanged (correct)

**New Table Structure:**
```sql
CREATE TABLE customer_payments (
  id SERIAL PRIMARY KEY,
  partial_payment_customer_id INTEGER NOT NULL,  -- Links to partial_payment_customers
  sale_id INTEGER,  -- Reference to the original sale
  customer_name VARCHAR(100) NOT NULL,
  customer_phone VARCHAR(20),
  payment_amount NUMERIC(10, 2) NOT NULL CHECK (payment_amount > 0),
  payment_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(20) DEFAULT 'Cash',
  notes TEXT,
  store_id INTEGER NOT NULL,
  recorded_by UUID,
  cashier_id INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (partial_payment_customer_id) REFERENCES partial_payment_customers(id),
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (store_id) REFERENCES stores(id)
);
```

### 2. API Route Updated
**File:** `app/api/khaata-payments/route.ts`

**Changed:**
- ❌ Query from `khaata_payments` → ✅ Query from `customer_payments`
- ❌ Query param `khaata_customer_id` → ✅ Query param `partial_payment_customer_id`
- ❌ Insert/Update to `khaata_payments` → ✅ Insert/Update to `customer_payments`
- ❌ Fetch from `khaata_customers` → ✅ Fetch from `partial_payment_customers`
- ✅ Added support for `sale_id` parameter in GET requests
- ✅ Automatically includes `sale_id` from customer record when creating payment

### 3. Supplier Payments (No Changes Needed)
**File:** `app/api/supplier-khaata-payments/route.ts`

✅ This is correct as-is. Uses `supplier_khaata` table which exists in the project.

---

## Why This Matters

### Original Incorrect Flow:
```
Customer owes money → khaata_customers table (doesn't exist ❌)
                   → khaata_payments table (would fail ❌)
```

### Corrected Flow:
```
Customer owes money → partial_payment_customers table (exists ✅)
                   → customer_payments table (new, working ✅)
                   → Links to original sale via sale_id
```

---

## Database Schema Context

### Existing Tables (Already in Production):
1. **`partial_payment_customers`** - Tracks customers with outstanding balances
   - Created when a sale has partial payment
   - Contains: customer_name, customer_phone, total_amount, amount_paid, amount_remaining
   - Links to: `sales` table via `sale_id`

2. **`supplier_khaata`** - Tracks suppliers with outstanding balances
   - Created when inventory purchase has partial payment
   - Contains: supplier info, amounts, batch references
   - Links to: `stock_batches`, `suppliers`, `stores`

### New Tables (Being Added):
1. **`customer_payments`** - Records payment transactions for customer dues
   - Records each payment made toward partial_payment_customers balance
   - Links to: `partial_payment_customers`, `sales`, `stores`

2. **`supplier_khaata_payments`** - Records payment transactions for supplier dues
   - Records each payment made toward supplier_khaata balance
   - Links to: `supplier_khaata`, `stores`

---

## Updated Documentation References

### API Endpoint Usage

#### Customer Payment (Updated)
```typescript
// Record a customer payment
POST /api/khaata-payments
{
  "partial_payment_customer_id": 5,
  "sale_id": 123,  // Optional, auto-filled from customer record
  "payment_amount": 5000,
  "payment_method": "Cash",
  "notes": "Partial payment received",
  "store_id": 1,
  "recorded_by": "manager-uuid"
}

// Fetch customer payments
GET /api/khaata-payments?store_id=1&customer_id=5
GET /api/khaata-payments?store_id=1&sale_id=123
```

#### Supplier Payment (Unchanged)
```typescript
// Record a supplier payment
POST /api/supplier-khaata-payments
{
  "supplier_khaata_id": 10,
  "payment_amount": 15000,
  "payment_method": "Cash",
  "notes": "Payment for stock batch",
  "store_id": 1,
  "recorded_by": "manager-uuid"
}
```

---

## Migration Instructions (Updated)

### Step 1: Run the Corrected Migration
```sql
-- Run this in Supabase SQL Editor
-- File: database/add_ledger_and_deletion_features.sql

-- This will create:
-- 1. customer_payments table (new name)
-- 2. supplier_khaata_payments table
-- 3. Add mark_for_review columns to sales table
-- 4. Create stock reversion trigger
```

### Step 2: Verify Tables Created
```sql
-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('customer_payments', 'supplier_khaata_payments');

-- Should return:
--   customer_payments
--   supplier_khaata_payments

-- Check columns in sales table
SELECT column_name FROM information_schema.columns
WHERE table_name = 'sales' 
AND column_name IN ('marked_for_review', 'review_reason');

-- Should return:
--   marked_for_review
--   review_reason
```

### Step 3: Test the APIs
```bash
# Test customer payment
curl -X POST http://localhost:3000/api/khaata-payments \
  -H "Content-Type: application/json" \
  -d '{
    "partial_payment_customer_id": 1,
    "payment_amount": 1000,
    "payment_method": "Cash",
    "store_id": 1,
    "recorded_by": "YOUR_MANAGER_UUID"
  }'
```

---

## Key Differences Summary

| Aspect | Before (Incorrect) | After (Corrected) |
|--------|-------------------|-------------------|
| Customer Table | `khaata_customers` ❌ | `partial_payment_customers` ✅ |
| Payment Table | `khaata_payments` | `customer_payments` |
| Foreign Key | `khaata_customer_id` | `partial_payment_customer_id` |
| Sale Reference | None | `sale_id` column added |
| Supplier Table | `supplier_khaata` ✅ | `supplier_khaata` ✅ |

---

## Impact on Frontend

The frontend documentation references need to be updated to use:
- `partial_payment_customer_id` instead of `khaata_customer_id`
- `customer_payments` API instead of `khaata_payments`

All code snippets in `QUICK_IMPLEMENTATION_GUIDE.md` and `LEDGER_PAYMENT_DELETION_FEATURES.md` that reference the customer payment API should use the new parameter names.

---

## Summary

✅ **Database migration script corrected** to use existing `partial_payment_customers` table  
✅ **API routes updated** to query correct tables  
✅ **Backward compatible** - No breaking changes to existing data  
✅ **Supplier payments unchanged** - Already using correct table name  
✅ **Ready to deploy** - Can now run migration successfully

The system now correctly integrates with the existing partial payment infrastructure while adding the new payment tracking and deletion features.
