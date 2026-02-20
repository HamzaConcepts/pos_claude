# POS Database Schema — Deep Audit & Production Readiness Report

**Date:** February 16, 2026  
**Scope:** Full analysis of `schema.sql` (4012 lines, 25 tables, 3 views, 14 functions, 15 triggers, 50+ RLS policies)  
**Objective:** Identify unnecessary links, incorrect logic, bad connections, and provide an actionable roadmap toward production readiness.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [CRITICAL — Data Integrity Issues](#2-critical--data-integrity-issues)
3. [HIGH — Security Vulnerabilities](#3-high--security-vulnerabilities)
4. [HIGH — Architectural Flaws](#4-high--architectural-flaws)
5. [MEDIUM — Redundant & Duplicate Structures](#5-medium--redundant--duplicate-structures)
6. [MEDIUM — Missing Constraints & Foreign Keys](#6-medium--missing-constraints--foreign-keys)
7. [LOW — Inconsistencies & Code Smell](#7-low--inconsistencies--code-smell)
8. [Index Audit — Duplicates & Gaps](#8-index-audit--duplicates--gaps)
9. [Trigger & Function Audit](#9-trigger--function-audit)
10. [RLS Policy Audit](#10-rls-policy-audit)
11. [Production Readiness Checklist](#11-production-readiness-checklist)
12. [Recommended Migration SQL](#12-recommended-migration-sql)

---

## 1. Executive Summary

The schema is functional and supports a multi-tenant POS system with FIFO inventory, partial payments, supplier khaata (credit ledger), quotations, and role-based access. However, it has accumulated significant technical debt through iterative development. **38 distinct issues** were identified across 6 severity categories:

| Severity | Count | Impact |
|----------|-------|--------|
| CRITICAL | 5 | Data loss risk, race conditions, financial inaccuracy |
| HIGH - Security | 5 | Unauthorized data access possible |
| HIGH - Architecture | 4 | Confusing dual systems, unmaintainable code |
| MEDIUM | 12 | Data staleness, missing constraints |
| LOW | 7 | Inconsistencies, naming conventions |
| Index Issues | 12+ duplicate indexes | Wasted storage, slower writes |

---

## 2. CRITICAL — Data Integrity Issues

### 2.1 Race Condition in `get_next_sale_number()`

**Location:** Function `get_next_sale_number(p_store_id)`  
**Problem:** Uses `SELECT COALESCE(MAX(sale_number_store), 0) + 1` without row-level locking. Two concurrent sales in the same store can compute the same number. The UNIQUE constraint `unique_sale_number_per_store` will catch it — but one transaction will **error out and fail silently**.

**Impact:** Lost sales, customer-facing errors during high-traffic periods.

**Fix:**
```sql
CREATE OR REPLACE FUNCTION get_next_sale_number(p_store_id INTEGER) RETURNS INTEGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  -- Use advisory lock per store to prevent races
  PERFORM pg_advisory_xact_lock(p_store_id);
  
  SELECT COALESCE(MAX(sale_number_store), 0) + 1
  INTO next_number
  FROM sales
  WHERE store_id = p_store_id;
  
  RETURN next_number;
END;
$$ LANGUAGE plpgsql;
```

### 2.2 Race Condition in Quotation Sequence Generation

**Location:** `quotation_sequences` table (used by API route `quotations/route.ts`)  
**Problem:** The sequence update (`UPDATE ... SET last_sequence = last_sequence + 1`) and read happen in separate statements in the application layer without `SELECT ... FOR UPDATE`. Concurrent quotation creation can produce duplicate numbers.

**Fix:** Application code should use `UPDATE quotation_sequences SET last_sequence = last_sequence + 1 WHERE store_id = $1 AND year = $2 RETURNING last_sequence` in a single atomic statement, or use `pg_advisory_xact_lock`.

### 2.3 Orphaned Function Reference: `update_product_average_price()`

**Location:** Function `trigger_update_average_price()`  
**Problem:** The trigger function body calls `PERFORM update_product_average_price(NEW.product_id)` — but **this function does not exist** anywhere in the schema. If the trigger fires, it will throw a runtime error.

**Impact:** Any batch update that fires this trigger will fail.

**Fix:** Either remove the trigger or create the referenced function. Since `update_aggregated_stock()` already handles price recalculation, this trigger is likely dead code:
```sql
DROP TRIGGER IF EXISTS trigger_update_average_price ON stock_batches;
DROP FUNCTION IF EXISTS trigger_update_average_price();
```

### 2.4 Cascade Deletion Destroys Financial Records

**Location:** Multiple FK constraints  
**Problem:** Several CASCADE DELETE chains can destroy critical financial data:

| Parent Deleted | Cascading Deletes |
|----------------|-------------------|
| `sales` deleted | → `partial_payment_customers` deleted (debt records lost!) → `customer_payments` deleted (payment history lost!) |
| `stock_batches` deleted | → `supplier_khaata` deleted (supplier debt records lost!) → `supplier_khaata_payments` deleted |
| `products` deleted | → `stock_batches` deleted → triggers `create_restock_expense` AND `update_aggregated_stock` in cascade |

**Impact:** Deleting a sale erases who owes money and what they've paid. This is a financial data loss risk.

**Fix:** For financial records, use `ON DELETE RESTRICT` or soft-delete patterns:
```sql
-- Change partial_payment_customers to RESTRICT 
ALTER TABLE partial_payment_customers 
  DROP CONSTRAINT partial_payment_customers_sale_id_fkey,
  ADD CONSTRAINT partial_payment_customers_sale_id_fkey 
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT;

-- Or better: add is_deleted flag to sales, never hard-delete
ALTER TABLE sales ADD COLUMN deleted_at TIMESTAMPTZ;
```

### 2.5 `revert_sale_deletion` Trigger — Edge Cases

**Location:** Trigger function `revert_sale_deletion()`  
**Problem:** When restoring stock on sale deletion, it iterates batches in `purchase_date DESC` order (LIFO reverse). The restore calculation uses `LEAST(remaining_qty, quantity_purchased - quantity_remaining)`. If a batch was already fully stocked (`quantity_remaining = quantity_purchased`), the restorable amount is 0, but the loop continues uselessly. More critically — if new batches were added after the sale, stock could be "restored" to the wrong batches, making inventory inaccurate.

**Impact:** Inventory counts may become incorrect after sale deletion if products were restocked between the sale and the deletion.

---

## 3. HIGH — Security Vulnerabilities

### 3.1 `anon` Role Has Full Access to All Tables

**Location:** All GRANT statements at the bottom of the schema  
**Problem:** Every table, sequence, and function has `GRANT ALL ON ... TO "anon"`. The anonymous role can read and write all data if RLS is bypassed or misconfigured on any table.

**Impact:** An unauthenticated API caller could potentially access or modify data in tables that don't have RLS enabled.

**Fix:**
```sql
-- Revoke ALL from anon on sensitive tables
REVOKE ALL ON TABLE sales, expenses, payments, partial_payment_customers, 
  customer_payments, supplier_khaata, supplier_khaata_payments, 
  owner_withdrawals, managers, cashier_accounts, stock_batches
FROM anon;

-- Only grant what's needed (usually just signup-related tables)
GRANT SELECT, INSERT ON cashier_accounts TO anon;  -- for signup
GRANT SELECT, INSERT ON managers TO anon;           -- for signup
GRANT SELECT, INSERT ON join_requests TO anon;      -- for join flow
GRANT SELECT ON stores TO anon;                       -- for store lookup
```

### 3.2 `verify_cashier_login` Exposes Data to `anon`

**Location:** Function `verify_cashier_login()`  
**Problem:** Function is `SECURITY DEFINER` (runs as the function owner, bypassing RLS) and is `GRANT ALL TO anon`. An unauthenticated user can call this function with arbitrary identifiers and, by timing attack or error analysis, enumerate cashier accounts.

**Fix:** Rate limiting at the application layer. Consider adding a `failed_login_attempts` column to `cashier_accounts` and locking accounts after N failures.

### 3.3 Missing RLS on `supplier_payments` Table

**Location:** `supplier_payments` table  
**Problem:** RLS is **not enabled** on `supplier_payments`. No `ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY` exists. All authenticated and anon users can read/write ALL supplier payment records across all stores.

**Fix:**
```sql
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_payments_store_isolation" ON supplier_payments
  USING (store_id IN (
    SELECT store_id FROM managers WHERE id = auth.uid()
  ));
```

### 3.4 Quotation RLS Policies — Wide Open

**Location:** Policies on `quotations`, `quotation_items`, `quotation_audit_logs`, `quotation_sequences`  
**Problem:** All four quotation tables have `USING (true) WITH CHECK (true)` policies — meaning ANY authenticated user (or anon, given the grants) can access ALL quotations across ALL stores. The policies say "Service role full access" but they actually apply to all roles.

**Note:** This is partially mitigated because the app uses `supabaseAdmin` (service role key) in API routes, bypassing RLS entirely. But it means:
- Direct Supabase client calls from the browser can access any store's quotations
- If any quotation-related RLS is ever relied upon, it won't work

**Fix:**
```sql
-- Replace the open policies with proper store-scoped policies
DROP POLICY "Service role full access on quotations" ON quotations;
CREATE POLICY "quotations_store_isolation" ON quotations
  USING (store_id = get_user_store_id())
  WITH CHECK (store_id = get_user_store_id());
-- Repeat for quotation_items, quotation_audit_logs, quotation_sequences
```

### 3.5 `hash_cashier_password` Trigger — Only on INSERT

**Location:** Trigger `hash_cashier_password_trigger`  
**Problem:** The trigger only fires on INSERT (`BEFORE INSERT`). If a cashier's password is updated with a plain-text value via `UPDATE`, it will be stored **unhashed** in the database.

**Fix:**
```sql
DROP TRIGGER hash_cashier_password_trigger ON cashier_accounts;
CREATE TRIGGER hash_cashier_password_trigger 
  BEFORE INSERT OR UPDATE ON cashier_accounts
  FOR EACH ROW 
  WHEN (NEW.password_hash IS DISTINCT FROM OLD.password_hash)
  EXECUTE FUNCTION hash_cashier_password();
```

---

## 4. HIGH — Architectural Flaws

### 4.1 Dual Cashier Tables: `cashier_accounts` vs `cashiers`

**Problem:** Two completely separate tables track cashiers:

| Column | `cashier_accounts` | `cashiers` |
|--------|-------------------|------------|
| Purpose | Authentication (login) | Staff info (commission, salary) |
| `full_name` | ✅ VARCHAR(100) | ✅ TEXT |
| `phone_number` | ✅ VARCHAR(11) | ✅ TEXT |
| `store_id` | ✅ nullable | ✅ NOT NULL |
| `is_active` | ✅ | ✅ |
| Unique Key | `phone_number` (global!) | None |
| Authentication | `password_hash` | ❌ No auth |
| Financials | ❌ | `commission_rate`, `salary` |

**Issues:**
1. **No FK between them** — A cashier can exist in `cashier_accounts` but not in `cashiers`, and vice versa. Data is guaranteed to drift.
2. **Naming collision** — `expenses.recorded_by_cashier_id` points to `cashier_accounts`, while `expenses.cashier_ref_id` points to `cashiers`. Which is the "real" cashier?
3. **Phone uniqueness** — `cashier_accounts.phone_number` is globally unique (not per-store), but `cashiers` has no uniqueness constraint.

**Recommended fix:** Merge into a single table with an optional `password_hash` column (NULL = no login access), or add a FK from `cashier_accounts` to `cashiers.id`.

### 4.2 Legacy `products.category` Column (VARCHAR) Still Exists

**Location:** `products` table  
**Problem:** Products have BOTH:
- `category VARCHAR(50)` — old free-text category, still indexed (`idx_products_category`)
- `category_id INTEGER REFERENCES categories(id)` — proper FK to normalized categories table

The `inventory_view` correctly uses `category_id` to join to `categories`, but the old `category` column remains, creating confusion about which is authoritative.

**Fix:**
```sql
-- After verifying no code reads from products.category
DROP INDEX idx_products_category;
ALTER TABLE products DROP COLUMN category;
```

### 4.3 Dual Sale Number Systems

**Location:** `sales` table  
**Problem:** Two separate sale number columns with two separate UNIQUE constraints:
- `sale_number VARCHAR(50)` — free-text, with `UNIQUE(sale_number, store_id)` constraint
- `sale_number_store INTEGER NOT NULL` — auto-generated sequential, with `UNIQUE(store_id, sale_number_store)` constraint

Both are indexed separately (`idx_sales_number_store` and `idx_sales_store_number`). The `sale_number` appears to be legacy; `sale_number_store` is the one actively used by the trigger `set_sale_number_store`.

**Fix:** Evaluate if `sale_number` is still read in the codebase. If only `sale_number_store` is used, deprecate `sale_number` or make it a computed/generated column.

### 4.4 Dual Logo URL Columns

**Location:** `stores.logo_url` AND `receipt_settings.logo_url`  
**Problem:** Two places to store a logo URL. The application logic falls back: `receipt_settings.logo_url || stores.logo_url`. 

**Recommendation:** This is a minor architectural issue but causes confusion. Decide on one source of truth. `stores.logo_url` is the better location since it's more general, and `receipt_settings.show_logo` can control whether it appears on receipts.

---

## 5. MEDIUM — Redundant & Duplicate Structures

### 5.1 Denormalized Name/Phone in Payment Tables

These tables store `supplier_name`/`supplier_phone` or `customer_name`/`customer_phone` directly despite having FK references:

| Table | Denormalized Columns | FK Available |
|-------|---------------------|--------------|
| `supplier_khaata` | `supplier_name`, `supplier_phone`, `supplier_contact` | `supplier_id → suppliers` |
| `supplier_khaata_payments` | `supplier_name`, `supplier_phone` | `supplier_khaata_id → supplier_khaata → suppliers` |
| `customer_payments` | `customer_name`, `customer_phone` | `partial_payment_customer_id → partial_payment_customers` |
| `sales` | `customer_name`, `customer_phone`, `customer_cnic` | `customer_id → partial_payment_customers` |

**Impact:** If a supplier or customer updates their name/phone in the `suppliers`/`partial_payment_customers` table, all the denormalized copies remain stale.

**Assessment:** The `sales` table denormalization is **intentional** (marked with comments "for quick reference") and acceptable — it's a snapshot of the customer at the time of sale. The `supplier_khaata` and payment tables should join to their parent tables instead.

### 5.2 Three Cashier References in `expenses`

The `expenses` table has three separate ways to record which cashier created an expense:

| Column | Type | FK Points To | Purpose |
|--------|------|--------------|---------|
| `recorded_by_cashier_id` | INTEGER | `cashier_accounts(id)` | Auth table reference |
| `cashier_ref_id` | INTEGER | `cashiers(id)` | Staff table reference |
| `marked_by` | VARCHAR(255) | ❌ No FK! | Free-text name string |

**Problem:** Redundant and confusing. Which column should the app read? The VARCHAR `marked_by` could contain anything.

**Fix:** Consolidate to one cashier reference column, add a proper FK for `marked_by`:
```sql
ALTER TABLE expenses DROP COLUMN marked_by;
-- Use cashier_ref_id exclusively for cashier identification
```

### 5.3 `partial_payment_customers` — Misleading Name

**Problem:** This table is used for ALL customer records (including fully-paid ones), not just partial payment customers. The comment on `sales.customer_id` says: "Reference to partial_payment_customers table (for tracking all customer sales, not just partial payments)."

**Impact:** Makes the schema confusing for new developers.

**Recommendation:** Rename to `customers` or `customer_ledger`.

---

## 6. MEDIUM — Missing Constraints & Foreign Keys

### 6.1 Missing Foreign Key Constraints

These UUID/INTEGER columns reference other tables but have **no FK constraint**, meaning orphaned references can exist:

| Table.Column | Type | Should Reference |
|-------------|------|------------------|
| `expenses.recorded_by` | UUID | `managers(id)` or `auth.users(id)` |
| `sales.cashier_id` | UUID | `auth.users(id)` (or should this be removed in favor of `cashier_ref_id`?) |
| `payments.manager_id` | UUID | `managers(id)` |
| `payments.cashier_id` | INTEGER | `cashier_accounts(id)` or `cashiers(id)` |
| `customer_payments.recorded_by` | UUID | `managers(id)` |
| `customer_payments.cashier_id` | INTEGER | `cashier_accounts(id)` |
| `quotations.created_by` | UUID | `managers(id)` |
| `quotations.finalized_by` | UUID | `managers(id)` |
| `quotations.deleted_by` | UUID | `managers(id)` |
| `quotation_audit_logs.user_id` | UUID | `managers(id)` |
| `quotation_audit_logs.cashier_id` | INTEGER | `cashier_accounts(id)` |
| `join_requests.reviewed_by` | UUID | `managers(id)` |
| `initial_customer_entries.created_by` | UUID | `managers(id)` |
| `initial_supplier_entries.created_by` | UUID | `managers(id)` |
| `supplier_khaata_payments.recorded_by` | UUID | `managers(id)` |
| `supplier_khaata_payments.cashier_id` | INTEGER | `cashier_accounts(id)` |

**Note on UUID FKs:** In Supabase, referencing `auth.users(id)` is possible but can be tricky with cascading. Referencing `managers(id)` is safer since managers have UUIDs matching `auth.users`.

### 6.2 Missing Mutual Exclusion Constraints

The `expenses` table has `recorded_by` (UUID, manager) and `recorded_by_cashier_id` (INTEGER, cashier) but **no CHECK constraint** ensuring exactly one is set. Compare with `payments` which correctly has:
```sql
CONSTRAINT payments_recorder_check CHECK (
  (recorded_by IS NOT NULL AND cashier_id IS NULL) OR 
  (recorded_by IS NULL AND cashier_id IS NOT NULL)
)
```

Tables missing this pattern: `expenses`, `quotation_audit_logs`.

### 6.3 Missing NOT NULL on Critical Columns

| Table.Column | Current | Should Be |
|-------------|---------|-----------|
| `expenses.category` | nullable VARCHAR(50) | NOT NULL (every expense needs a category) |
| `stock_batches.batch_number` | nullable VARCHAR(50) | NOT NULL (generated by function) |
| `stock_batches.selling_price` | nullable NUMERIC(10,2) | NOT NULL DEFAULT 0 (used in weighted avg, NULL causes issues) |
| `products.category_id` | nullable INTEGER | NOT NULL (every product should have a category) |
| `cashier_accounts.store_id` | nullable INTEGER | NOT NULL (cashier must belong to a store) |

### 6.4 `cashier_accounts.phone_number` — Globally Unique (Should Be Per-Store)

**Location:** `UNIQUE(phone_number)` on `cashier_accounts`  
**Problem:** Two different stores cannot have a cashier with the same phone number. In production, this means an employee who works at two stores (or a phone number reused across independent businesses) would fail to register.

**Fix:**
```sql
ALTER TABLE cashier_accounts DROP CONSTRAINT cashier_accounts_phone_number_key;
ALTER TABLE cashier_accounts ADD CONSTRAINT cashier_accounts_store_phone_unique 
  UNIQUE (store_id, phone_number);
```

### 6.5 `products.barcode` — Globally Unique (Should Be Per-Store)

**Location:** `CREATE UNIQUE INDEX idx_products_barcode ON products (barcode) WHERE (barcode IS NOT NULL)`  
**Problem:** A barcode cannot be shared across stores. If Store A and Store B both sell "Samsung Galaxy S25" with the same manufacturer barcode, one of them will fail to add it.

**Fix:**
```sql
DROP INDEX idx_products_barcode;
CREATE UNIQUE INDEX idx_products_barcode ON products (store_id, barcode) WHERE (barcode IS NOT NULL);
```

---

## 7. LOW — Inconsistencies & Code Smell

### 7.1 Inconsistent Timestamp Types

The schema mixes `timestamp without time zone` (aka `timestamp`) and `timestamp with time zone` (aka `timestamptz`) with no clear pattern:

| Uses `timestamptz` | Uses `timestamp` |
|--------------------|-----------------|
| `sales.sale_date` | `expenses.created_at` |
| `stock_batches.created_at` | `customer_payments.payment_date` |
| `product_imeis.created_at` | `partial_payment_customers.created_at` |
| `quotations.created_at` | `categories.created_at` |
| `cashiers.created_at` | `cashier_accounts.created_at` |
| `suppliers.created_at` | `managers.created_at` |

**Impact:** Can cause incorrect time comparisons across tables, especially if the Supabase instance timezone changes or users are in different timezones.

**Recommendation:** Standardize ALL timestamps to `TIMESTAMPTZ`. PostgreSQL best practice is to always use `timestamptz`.

### 7.2 Missing `updated_at` / `created_at` on Several Tables

| Table | Missing Column |
|-------|---------------|
| `sales` | `created_at` (only has `sale_date`) |
| `payments` | `updated_at` |
| `customer_payments` | `updated_at` |
| `expenses` | `updated_at` |
| `owner_withdrawals` | `updated_at` |

### 7.3 Inconsistent `updated_at` Trigger Functions

Five different functions do the same thing (set `updated_at = CURRENT_TIMESTAMP` or `NOW()`):
1. `update_updated_at_column()` — used by products, categories, subcategories
2. `update_aggregated_stock_timestamp()` — only for aggregated_stock
3. `update_predefined_expenses_updated_at()` — only for predefined_expenses
4. `update_supplier_khaata_updated_at()` — only for supplier_khaata
5. `update_quotation_updated_at()` — for quotations and quotation_items
6. `update_receipt_settings_updated_at()` — for receipt_settings

**Recommendation:** Use a single `update_updated_at_column()` function for all tables.

### 7.4 `generate_store_code()` — Limited Scale

Only generates 3-character alphanumeric codes (36^3 = 46,656 combinations). With VARCHAR(3) constraint on `stores.store_code`, the system cannot scale beyond ~46K stores.

**Fix for growth:** Change to 6-character codes or use a different identifier strategy.

### 7.5 Mixed Naming Conventions for FK Columns

| Pattern | Examples |
|---------|----------|
| `_id` suffix | `store_id`, `product_id`, `sale_id` ✅ |
| `_ref_id` suffix | `cashier_ref_id` (in sales), `cashier_ref_id` (in expenses) |
| `recorded_by` | `recorded_by` (UUID), `recorded_by_cashier_id` (INT) |
| `recorded_by_manager_id` | Only in `supplier_payments` |
| `created_by` | In quotations, stores, initial entries |

**Recommendation:** Standardize on `{role}_{table}_id` pattern: `manager_id`, `cashier_account_id`, `cashier_staff_id`.

### 7.6 `supplier_payments` Missing Recorder Constraint

Unlike `payments`, `customer_payments`, and `supplier_khaata_payments` which all have recorder mutual exclusion checks, `supplier_payments` has `recorded_by_manager_id` and `recorded_by_cashier_id` with no CHECK constraint ensuring only one is set.

### 7.7 `quotation_items.quantity` is NUMERIC(10,3) — 3 Decimal Places

All other quantity fields (`sale_items.quantity`, `stock_batches.quantity_purchased`, etc.) are INTEGER. Having fractional quantities only in quotations but not in sales means a quotation with quantity 2.5 cannot be converted to a sale.

---

## 8. Index Audit — Duplicates & Gaps

### 8.1 Duplicate Indexes (Same Columns, Wasted Space)

Each duplicate index costs storage and slows INSERT/UPDATE operations with zero query benefit:

| Index A | Index B | Columns | Action |
|---------|---------|---------|--------|
| `idx_products_sku` | `idx_products_sku_store` | Both: `(sku, store_id)` | Drop one |
| `idx_sale_items_product` | `idx_sale_items_product_id` | Both: `(product_id)` | Drop one |
| `idx_sale_items_sale` | `idx_sale_items_sale_id` | Both: `(sale_id)` | Drop one |
| `idx_payments_sale` | `idx_payments_sale_id` | Both: `(sale_id)` | Drop one |
| `idx_partial_payment_sale` | `idx_partial_payment_sale_id` | Both: `(sale_id)` | Drop one |

### 8.2 Redundant Indexes (Prefix Covered by Composite)

These single-column indexes are unnecessary because a composite index with the same leading column already exists:

| Redundant Index | Covered By | Action |
|-----------------|-----------|--------|
| `idx_aggregated_stock_product_id` (product_id) | `idx_aggregated_stock_product_store` (product_id, store_id) | Drop |
| `idx_categories_store_id` (store_id) | `idx_categories_store` (store_id, name) | Drop |
| `idx_subcategories_category_id` (category_id) | `idx_subcategories_category` (category_id, name) | Drop |
| `idx_cashiers_store_id` (store_id) | `idx_cashiers_store_active` (store_id, is_active) | Drop |
| `idx_payments_cashier_id` (cashier_id) | `idx_payments_cashier` (cashier_id, store_id) | Drop |
| `idx_batches_supplier` (supplier_id) | `idx_stock_batches_supplier` (supplier_id, store_id) | Drop |
| `idx_imeis_imei` (imei_number) | `idx_product_imeis_number` (imei_number, store_id) | Drop |

### 8.3 Missing Indexes

| Table | Query Pattern | Suggested Index |
|-------|--------------|-----------------|
| `supplier_payments` | Filter by store + date range | `(store_id, payment_date DESC)` |
| `customer_payments` | Filter by store + payment_method | `(store_id, payment_method)` |
| `expenses` | Filter by store + category + date | `(store_id, category, expense_date DESC)` — composite |
| `quotations` | Filter by store + quotation_number | `(store_id, quotation_number)` |

### 8.4 Cleanup SQL for Duplicate Indexes

```sql
-- Exact duplicates (safe to drop immediately)
DROP INDEX IF EXISTS idx_products_sku;         -- kept: idx_products_sku_store
DROP INDEX IF EXISTS idx_sale_items_product;    -- kept: idx_sale_items_product_id
DROP INDEX IF EXISTS idx_sale_items_sale;       -- kept: idx_sale_items_sale_id
DROP INDEX IF EXISTS idx_payments_sale;         -- kept: idx_payments_sale_id
DROP INDEX IF EXISTS idx_partial_payment_sale;  -- kept: idx_partial_payment_sale_id

-- Prefix-redundant (safe to drop)
DROP INDEX IF EXISTS idx_aggregated_stock_product_id; -- covered by product_store
DROP INDEX IF EXISTS idx_categories_store_id;          -- covered by store+name
DROP INDEX IF EXISTS idx_subcategories_category_id;    -- covered by category+name
DROP INDEX IF EXISTS idx_cashiers_store_id;            -- covered by store+active
DROP INDEX IF EXISTS idx_payments_cashier_id;          -- covered by cashier+store
DROP INDEX IF EXISTS idx_batches_supplier;             -- covered by supplier+store
DROP INDEX IF EXISTS idx_imeis_imei;                   -- covered by imei+store
```

**Estimated savings:** ~12 indexes × avg 8KB per 1000 rows = significant for tables with 100K+ rows.

---

## 9. Trigger & Function Audit

### 9.1 Trigger Summary & Issues

| Trigger | Table | Event | Issue? |
|---------|-------|-------|--------|
| `hash_cashier_password_trigger` | `cashier_accounts` | BEFORE INSERT | ⚠️ Missing UPDATE (Section 3.5) |
| `trigger_create_restock_expense` | `stock_batches` | AFTER INSERT | ✅ Works correctly |
| `trigger_update_aggregated_stock` | `stock_batches` | AFTER INSERT/UPDATE/DELETE | ✅ Core FIFO logic, works well |
| `trigger_revert_sale_deletion` | `sales` | BEFORE DELETE | ⚠️ Edge cases (Section 2.5) |
| `trigger_set_sale_number_store` | `sales` | BEFORE INSERT | ⚠️ Race condition (Section 2.1) |
| `trigger_quotation_item_updated_at` | `quotation_items` | BEFORE UPDATE | ⚠️ Uses `update_quotation_updated_at()` — wrong function for items |
| `update_aggregated_stock_updated_at` | `aggregated_stock` | BEFORE UPDATE | 🔄 Redundant — `update_aggregated_stock()` already sets updated_at |

### 9.2 `update_aggregated_stock()` — Double Timestamp Update

The `update_aggregated_stock()` function explicitly sets `updated_at = CURRENT_TIMESTAMP` in its UPSERT. Then the `update_aggregated_stock_updated_at` trigger ALSO fires on UPDATE to set `updated_at = CURRENT_TIMESTAMP`. This is harmless but wasteful — the trigger runs needlessly on every aggregated_stock update.

**Fix:** Drop the redundant trigger:
```sql
DROP TRIGGER IF EXISTS update_aggregated_stock_updated_at ON aggregated_stock;
```

### 9.3 `create_restock_expense()` — Missing Manager/Cashier Reference

The trigger creates expense records but doesn't set `recorded_by` or `recorded_by_cashier_id`. These expenses have no audit trail of who added the stock. The expense just appears as if created by nobody.

### 9.4 Missing Trigger: `hash_cashier_password` on UPDATE

Covered in Section 3.5, but worth highlighting — password changes via UPDATE will store plain text.

---

## 10. RLS Policy Audit

### 10.1 Three Inconsistent Store-Isolation Patterns

The schema uses three different mechanisms for store isolation in RLS policies:

**Pattern A — `get_user_store_id()` function:**
Used by: `products`, `sales`, `sale_items`, `payments`, `partial_payment_customers`, `expenses`, `owner_withdrawals`
```sql
USING (store_id = get_user_store_id())
```
- Only works for Supabase Auth users (managers)
- Cashiers authenticated via DB-level bcrypt are NOT covered

**Pattern B — Direct manager lookup:**
Used by: `cashiers`, `categories`, `subcategories`, `predefined_expenses`, `join_requests`, `receipt_settings`
```sql
USING (store_id IN (SELECT store_id FROM managers WHERE id = auth.uid()))
```
- Similar to Pattern A but inline
- Also only works for managers

**Pattern C — `stores.created_by` lookup:**
Used by: `customer_payments`, `supplier_khaata`, `supplier_khaata_payments`
```sql
USING (store_id IN (SELECT id FROM stores WHERE created_by = auth.uid()))
```
- Only the **store creator** (original manager) can access data!
- Other managers who joined the same store are EXCLUDED
- This is likely a **bug** — it should use Pattern A or B

**Pattern D — Union of managers + cashier_accounts:**
Used by: `stock_batches`, `product_imeis`, `suppliers`
```sql
USING (store_id IN (
  SELECT store_id FROM managers WHERE id = auth.uid()
  UNION
  SELECT store_id FROM cashier_accounts WHERE id::text = (auth.jwt() ->> 'sub')
))
```
- Most comprehensive — covers both managers and cashiers
- But inconsistent with other tables

### 10.2 Tables with RLS Enabled but Missing Policies

| Table | RLS Enabled | Has Policies | Issue |
|-------|------------|-------------|-------|
| `supplier_payments` | ❌ NOT enabled | ❌ None | **Wide open** (Section 3.3) |
| `aggregated_stock` | ❌ NOT enabled | ❌ None | Stock data visible to all |
| `initial_customer_entries` | ❌ NOT enabled | ❌ None | Migration data visible |
| `initial_supplier_entries` | ❌ NOT enabled | ❌ None | Migration data visible |

### 10.3 Recommendation

Standardize ALL RLS policies on Pattern D (union of managers + cashier_accounts) for consistency, and apply to ALL tables with `store_id`.

---

## 11. Production Readiness Checklist

### Must-Fix Before Production (Blockers)

- [ ] **Fix race conditions** in `get_next_sale_number()` and quotation sequences (Section 2.1, 2.2)
- [ ] **Remove or fix** `trigger_update_average_price()` — calls a non-existent function (Section 2.3)
- [ ] **Fix `hash_cashier_password` trigger** to fire on UPDATE (Section 3.5)
- [ ] **Enable RLS on `supplier_payments`** (Section 3.3)
- [ ] **Fix Pattern C RLS policies** (customer_payments, supplier_khaata) to use `get_user_store_id()` instead of `stores.created_by` (Section 10.1)
- [ ] **Revoke `GRANT ALL` from `anon`** on financial tables (Section 3.1)
- [ ] **Fix CASCADE deletes** on financial records — use RESTRICT or soft-delete (Section 2.4)
- [ ] **Fix global uniqueness** on `cashier_accounts.phone_number` and `products.barcode` — scope to store (Section 6.4, 6.5)

### Should-Fix (High Value)

- [ ] **Clean up duplicate indexes** — drop 12 redundant indexes (Section 8.4)
- [ ] **Drop legacy `products.category` column** (Section 4.2)
- [ ] **Merge or link** `cashier_accounts` and `cashiers` tables (Section 4.1)
- [ ] **Add missing FKs** for UUID columns (Section 6.1)
- [ ] **Add recorder CHECK constraint** to `expenses` table (Section 6.2)
- [ ] **Standardize timestamps** to `timestamptz` (Section 7.1)

### Nice-to-Have (Tech Debt Cleanup)

- [ ] Consolidate 5 `updated_at` trigger functions into 1 (Section 7.3)
- [ ] Remove `sale_number` column if only `sale_number_store` is used (Section 4.3)
- [ ] Rename `partial_payment_customers` to `customers` (Section 5.3)
- [ ] Clean up denormalized name/phone in supplier_khaata tables (Section 5.1)
- [ ] Decide on single logo URL source of truth (Section 4.4)
- [ ] Scale `generate_store_code()` beyond 3 chars (Section 7.4)

---

## 12. Recommended Migration SQL

Below is a migration script covering the **Must-Fix** items. Apply in a single transaction during a maintenance window.

```sql
-- ============================================================
-- PRODUCTION READINESS MIGRATION
-- Run inside a transaction. Test on a staging DB first.
-- ============================================================

BEGIN;

-- 1. Fix race condition in sale number generation
CREATE OR REPLACE FUNCTION get_next_sale_number(p_store_id INTEGER) 
RETURNS INTEGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(p_store_id);
  SELECT COALESCE(MAX(sale_number_store), 0) + 1
  INTO next_number
  FROM sales
  WHERE store_id = p_store_id;
  RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- 2. Remove broken trigger that calls non-existent function
DROP TRIGGER IF EXISTS trigger_update_average_price ON stock_batches;
DROP FUNCTION IF EXISTS trigger_update_average_price();

-- 3. Fix password hashing trigger to cover UPDATEs
DROP TRIGGER IF EXISTS hash_cashier_password_trigger ON cashier_accounts;
CREATE TRIGGER hash_cashier_password_trigger 
  BEFORE INSERT OR UPDATE OF password_hash ON cashier_accounts
  FOR EACH ROW 
  EXECUTE FUNCTION hash_cashier_password();

-- 4. Enable RLS on supplier_payments
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplier_payments_store_isolation" ON supplier_payments
  USING (store_id IN (
    SELECT store_id FROM managers WHERE id = auth.uid()
    UNION
    SELECT store_id FROM cashier_accounts 
    WHERE id::text = (auth.jwt() ->> 'sub')
  ));

-- 5. Fix customer_payments RLS (Pattern C → Pattern A)
DROP POLICY IF EXISTS "customer_payments_select_policy" ON customer_payments;
DROP POLICY IF EXISTS "customer_payments_insert_policy" ON customer_payments;
DROP POLICY IF EXISTS "customer_payments_update_policy" ON customer_payments;
DROP POLICY IF EXISTS "customer_payments_delete_policy" ON customer_payments;

CREATE POLICY "customer_payments_select" ON customer_payments 
  FOR SELECT USING (store_id = get_user_store_id());
CREATE POLICY "customer_payments_insert" ON customer_payments 
  FOR INSERT WITH CHECK (store_id = get_user_store_id());
CREATE POLICY "customer_payments_update" ON customer_payments 
  FOR UPDATE USING (store_id = get_user_store_id());
CREATE POLICY "customer_payments_delete" ON customer_payments 
  FOR DELETE USING (store_id = get_user_store_id());

-- 6. Fix supplier_khaata RLS (Pattern C → Pattern A)
DROP POLICY IF EXISTS "supplier_khaata_select_policy" ON supplier_khaata;
DROP POLICY IF EXISTS "supplier_khaata_insert_policy" ON supplier_khaata;
DROP POLICY IF EXISTS "supplier_khaata_update_policy" ON supplier_khaata;
DROP POLICY IF EXISTS "supplier_khaata_delete_policy" ON supplier_khaata;

CREATE POLICY "supplier_khaata_select" ON supplier_khaata 
  FOR SELECT USING (store_id = get_user_store_id());
CREATE POLICY "supplier_khaata_insert" ON supplier_khaata 
  FOR INSERT WITH CHECK (store_id = get_user_store_id());
CREATE POLICY "supplier_khaata_update" ON supplier_khaata 
  FOR UPDATE USING (store_id = get_user_store_id());
CREATE POLICY "supplier_khaata_delete" ON supplier_khaata 
  FOR DELETE USING (store_id = get_user_store_id());

-- 7. Fix supplier_khaata_payments RLS
DROP POLICY IF EXISTS "supplier_khaata_payments_select_policy" ON supplier_khaata_payments;
DROP POLICY IF EXISTS "supplier_khaata_payments_insert_policy" ON supplier_khaata_payments;
DROP POLICY IF EXISTS "supplier_khaata_payments_update_policy" ON supplier_khaata_payments;
DROP POLICY IF EXISTS "supplier_khaata_payments_delete_policy" ON supplier_khaata_payments;

CREATE POLICY "supplier_khaata_payments_select" ON supplier_khaata_payments 
  FOR SELECT USING (store_id = get_user_store_id());
CREATE POLICY "supplier_khaata_payments_insert" ON supplier_khaata_payments 
  FOR INSERT WITH CHECK (store_id = get_user_store_id());
CREATE POLICY "supplier_khaata_payments_update" ON supplier_khaata_payments 
  FOR UPDATE USING (store_id = get_user_store_id());
CREATE POLICY "supplier_khaata_payments_delete" ON supplier_khaata_payments 
  FOR DELETE USING (store_id = get_user_store_id());

-- 8. Fix global uniqueness → per-store uniqueness
ALTER TABLE cashier_accounts DROP CONSTRAINT IF EXISTS cashier_accounts_phone_number_key;
ALTER TABLE cashier_accounts ADD CONSTRAINT cashier_accounts_store_phone_unique 
  UNIQUE (store_id, phone_number);

DROP INDEX IF EXISTS idx_products_barcode;
CREATE UNIQUE INDEX idx_products_barcode ON products (store_id, barcode) 
  WHERE (barcode IS NOT NULL);

-- 9. Revoke excessive anon permissions on financial tables
REVOKE ALL ON TABLE sales FROM anon;
REVOKE ALL ON TABLE sale_items FROM anon;
REVOKE ALL ON TABLE expenses FROM anon;
REVOKE ALL ON TABLE payments FROM anon;
REVOKE ALL ON TABLE partial_payment_customers FROM anon;
REVOKE ALL ON TABLE customer_payments FROM anon;
REVOKE ALL ON TABLE supplier_khaata FROM anon;
REVOKE ALL ON TABLE supplier_khaata_payments FROM anon;
REVOKE ALL ON TABLE supplier_payments FROM anon;
REVOKE ALL ON TABLE owner_withdrawals FROM anon;
REVOKE ALL ON TABLE stock_batches FROM anon;
REVOKE ALL ON TABLE aggregated_stock FROM anon;
REVOKE ALL ON TABLE product_imeis FROM anon;

-- 10. Change critical CASCADE deletes to RESTRICT
ALTER TABLE partial_payment_customers 
  DROP CONSTRAINT IF EXISTS partial_payment_customers_sale_id_fkey;
ALTER TABLE partial_payment_customers 
  ADD CONSTRAINT partial_payment_customers_sale_id_fkey 
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT;

ALTER TABLE supplier_khaata 
  DROP CONSTRAINT IF EXISTS fk_supplier_khaata_stock_batch;
ALTER TABLE supplier_khaata 
  ADD CONSTRAINT fk_supplier_khaata_stock_batch 
    FOREIGN KEY (stock_batch_id) REFERENCES stock_batches(id) ON DELETE RESTRICT;

-- 11. Drop duplicate indexes
DROP INDEX IF EXISTS idx_products_sku;
DROP INDEX IF EXISTS idx_sale_items_product;
DROP INDEX IF EXISTS idx_sale_items_sale;
DROP INDEX IF EXISTS idx_payments_sale;
DROP INDEX IF EXISTS idx_partial_payment_sale;
DROP INDEX IF EXISTS idx_aggregated_stock_product_id;
DROP INDEX IF EXISTS idx_categories_store_id;
DROP INDEX IF EXISTS idx_subcategories_category_id;
DROP INDEX IF EXISTS idx_cashiers_store_id;
DROP INDEX IF EXISTS idx_payments_cashier_id;
DROP INDEX IF EXISTS idx_batches_supplier;
DROP INDEX IF EXISTS idx_imeis_imei;

-- 12. Drop redundant aggregated_stock timestamp trigger
DROP TRIGGER IF EXISTS update_aggregated_stock_updated_at ON aggregated_stock;
DROP FUNCTION IF EXISTS update_aggregated_stock_timestamp();

COMMIT;
```

> **WARNING:** Test this migration on a staging/development database first. The `REVOKE` statements will break any code that uses the `anon` key to access these tables directly. The CASCADE → RESTRICT changes will cause errors if code tries to delete sales/stock_batches that have child records — ensure the application handles this gracefully with soft-delete patterns.

---

## Appendix: Entity Relationship Overview

```
stores (1)
  ├── managers (N)           — UUID PK (auth.users)
  ├── cashier_accounts (N)   — INT PK (local auth)
  ├── cashiers (N)           — INT PK (staff info) ⚠️ No link to cashier_accounts
  ├── categories (N)
  │     └── subcategories (N)
  ├── products (N)
  │     ├── aggregated_stock (1)  — computed from batches
  │     ├── stock_batches (N)     — FIFO tracking
  │     │     └── supplier_khaata (N) — credit/debt per batch
  │     │           └── supplier_khaata_payments (N)
  │     └── product_imeis (N)     — for phone products
  ├── suppliers (N)
  │     └── supplier_payments (N)
  ├── sales (N)
  │     ├── sale_items (N)
  │     ├── payments (N)
  │     └── partial_payment_customers (N)
  │           └── customer_payments (N)
  ├── expenses (N)
  ├── quotations (N)
  │     ├── quotation_items (N)
  │     └── quotation_audit_logs (N)
  ├── owner_withdrawals (N)
  ├── receipt_settings (1)
  ├── predefined_expenses (N)
  ├── join_requests (N)
  ├── initial_customer_entries (N)
  └── initial_supplier_entries (N)
```

---

*This audit covers the schema as of February 16, 2026. Re-audit recommended after applying the migration and before any production deployment.*
