# POS System — Master Logic Document

> **Complete documentation of every financial flow, transaction, and calculation in the system.**
> Last updated: February 14, 2026

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Database Tables & Relationships](#2-database-tables--relationships)
3. [Inventory & Stock Management](#3-inventory--stock-management)
4. [Sales Processing (POS)](#4-sales-processing-pos)
5. [FIFO Stock Deduction](#5-fifo-stock-deduction)
6. [Payment System](#6-payment-system)
7. [Partial Payments & Customer Khaata (Ledger)](#7-partial-payments--customer-khaata-ledger)
8. [Supplier Khaata (Ledger)](#8-supplier-khaata-ledger)
9. [Expenses](#9-expenses)
10. [Inventory Purchases vs Operating Expenses](#10-inventory-purchases-vs-operating-expenses)
11. [Profit & Loss Calculations](#11-profit--loss-calculations)
12. [Dashboard Statistics](#12-dashboard-statistics)
13. [Reports & Export](#13-reports--export)
14. [Sale Deletion & Stock Reversal](#14-sale-deletion--stock-reversal)
15. [Database Triggers (Automated Logic)](#15-database-triggers-automated-logic)
16. [User Roles & Permissions](#16-user-roles--permissions)
17. [Date & Timezone Handling](#17-date--timezone-handling)
18. [Complete Data Flow Diagrams](#18-complete-data-flow-diagrams)

---

## 1. System Architecture Overview

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React, TypeScript |
| Styling | Tailwind CSS (Black & White theme) |
| Backend | Next.js API Routes (`/app/api/`) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Managers) + Custom auth (Cashiers) |
| Timezone | Pakistan Time (PKT, UTC+5) |

**Multi-tenant architecture:** Every table has a `store_id` column. All queries are scoped to the current user's store. Stores are identified by a unique 3-character `store_code`.

**UI Pages:**
- `/dashboard` — Overview with stats
- `/dashboard/pos` — Point of Sale for making sales
- `/dashboard/inventory` — Product management
- `/dashboard/inventory-purchases` — **Stock purchase history (separate from operating expenses)**
- `/dashboard/sales` — Sales history
- `/dashboard/expenses` — **Operating expenses only (rent, utilities, salaries, etc.)**
- `/dashboard/reports` — Financial reports
- `/dashboard/customer-ledger` — Customer dues tracking
- `/dashboard/supplier-ledger` — Supplier dues tracking

---

## 2. Database Tables & Relationships

### Core Tables

| Table | Purpose |
|-------|---------|
| `stores` | Store/business entities (id, store_code, store_name) |
| `managers` | Manager accounts (linked to Supabase Auth UUID) |
| `cashier_accounts` | Cashier login accounts (custom auth with bcrypt) |
| `cashiers` | Cashier employee profiles (salary, commission rate) |
| `products` | Product catalog (SKU, name, category, is_phone, barcode) |
| `stock_batches` | Individual purchase batches (cost, selling price, quantities) |
| `aggregated_stock` | Auto-computed summary per product (weighted avg prices, totals) |
| `categories` | Product categories (with `requires_imei` flag for phones) |
| `subcategories` | Nested under categories |
| `product_imeis` | IMEI tracking for phone products (status: in_stock/sold/returned/defective) |
| `suppliers` | Supplier/vendor records (balance_owed, total_paid) |

### Transaction Tables

| Table | Purpose |
|-------|---------|
| `sales` | Sale records (total, paid, due, discount, payment method/status) |
| `sale_items` | Line items per sale (unit_price, cost_price_snapshot, subtotal) |
| `payments` | Payment records linked to sales (who recorded, amount, method) |
| `expenses` | Expense records (amount, category, payment method) |
| `predefined_expenses` | Expense templates (recurring expenses like rent, utilities) |

### Ledger Tables

| Table | Purpose |
|-------|---------|
| `partial_payment_customers` | Customer debts from partial-pay sales |
| `customer_payments` | Payments received from customers against their debts |
| `supplier_khaata` | Money owed TO suppliers per stock batch |
| `supplier_khaata_payments` | Payments made to suppliers against specific khaata records |
| `supplier_payments` | General payments to suppliers (updates supplier balance) |

### Key Relationships

```
stores ──┬── managers (1:N)
         ├── cashier_accounts (1:N)
         ├── cashiers (1:N)
         ├── products (1:N) ──── stock_batches (1:N) ──── aggregated_stock (1:1 per product+store)
         │                                            └── product_imeis (1:N)
         ├── suppliers (1:N) ──── supplier_khaata (1:N) ──── supplier_khaata_payments (1:N)
         │                   └── supplier_payments (1:N)
         ├── sales (1:N) ──── sale_items (1:N)
         │               ├── payments (1:N)
         │               └── partial_payment_customers (1:1) ──── customer_payments (1:N)
         ├── expenses (1:N)
         └── categories (1:N) ──── subcategories (1:N)
```

---

## 3. Inventory & Stock Management

### 3.1 Product Creation

When a new product is created:
1. A record is inserted into `products` (SKU, name, category, barcode, is_phone flag).
2. No stock exists yet — `aggregated_stock` will be created when the first batch is added.

### 3.2 Stock Batches (The Core Inventory Unit)

Every inventory purchase is recorded as a **stock batch** in `stock_batches`:

| Field | Description |
|-------|-------------|
| `cost_price` | What you paid per unit to the supplier |
| `selling_price` | Target selling price per unit |
| `lowest_negotiable_price` | Minimum acceptable selling price (floor for discounts) |
| `quantity_purchased` | How many units were bought in this batch |
| `quantity_remaining` | How many units are still in stock |
| `is_depleted` | Auto-set to `true` when `quantity_remaining = 0` |
| `is_initial_stock` | `TRUE` = setup stock (NOT an expense), `FALSE` = regular restock (IS an expense) |
| `supplier_id` | Which supplier this batch came from |
| `purchase_date` | When this batch was purchased (used for FIFO ordering) |

**Key Rule:** `is_initial_stock` determines whether an expense is auto-created:
- `TRUE` → No expense created (it's the store's starting inventory)
- `FALSE` → Expense auto-created by database trigger (category: `inventory_restock`)

### 3.3 Aggregated Stock (Auto-Computed Summary)

The `aggregated_stock` table stores **weighted average** prices and total quantities per product per store. It is **never manually updated** — a database trigger recalculates it whenever `stock_batches` changes.

**Weighted Average Calculation:**
```
For all non-depleted batches of a product:

aggregated_cost_price     = SUM(cost_price × quantity_remaining) / SUM(quantity_remaining)
aggregated_selling_price  = SUM(selling_price × quantity_remaining) / SUM(quantity_remaining)
aggregated_lowest_negotiable = SUM(lowest_negotiable × quantity_remaining) / SUM(quantity_remaining)

total_quantity_purchased  = SUM(quantity_purchased)    [across ALL batches]
total_quantity_remaining  = SUM(quantity_remaining)     [across non-depleted batches]
total_quantity_sold       = SUM(quantity_purchased - quantity_remaining)
```

If `total_quantity_remaining = 0`, all average prices reset to 0.

### 3.4 Low Stock Alerts

A product is flagged as low stock when:
```
total_quantity_remaining ≤ low_stock_threshold
```
Default threshold is 10 units. Can be set per product.

### 3.5 IMEI Tracking (Phones)

For products in categories with `requires_imei = true`:
- Each physical unit has an IMEI number stored in `product_imeis`.
- Status lifecycle: `in_stock` → `sold` (when sale is made) → can also be `returned` or `defective`.
- When selling, specific IMEIs must be selected from the POS.
- When a sale is deleted, IMEIs revert to `in_stock`.

### 3.6 Inventory View (Virtual Table)

The `inventory_view` SQL view joins `products`, `aggregated_stock`, `categories`, and `subcategories` to provide a single queryable inventory listing with all relevant data.

---

## 4. Sales Processing (POS)

### 4.1 The Complete Sale Flow

```
Step 1: Add items to cart
     ↓
Step 2: Calculate totals
     ↓
Step 3: Apply discount (if any)
     ↓
Step 4: Determine payment amount & status
     ↓
Step 5: Insert sale record
     ↓
Step 6: Insert sale items (with cost snapshot)
     ↓
Step 7: Record payment
     ↓
Step 8: Create partial payment customer (if applicable)
     ↓
Step 9: Deduct stock via FIFO
     ↓
Step 10: Mark IMEIs as sold (if phones)
```

### 4.2 Price Determination

When an item is added to the cart:
- **Selling Price** = `aggregated_stock.aggregated_selling_price` (weighted average across all active batches)
- **Cost Price Snapshot** = `aggregated_stock.aggregated_cost_price` (captured at time of sale for COGS)
- **Lowest Negotiable** = `aggregated_stock.aggregated_lowest_negotiable` (minimum acceptable price)

### 4.3 Total Calculation

```
Subtotal = SUM(unit_price × quantity) for each item in cart
```

### 4.4 Discount Application

| Discount Type | Formula |
|--------------|---------|
| `percentage` | `discountAmount = subtotal × discount_value / 100` |
| `amount` | `discountAmount = MIN(discount_value, subtotal)` |
| `none` | `discountAmount = 0` |

```
Total Amount = Subtotal - Discount Amount
```

### 4.5 Payment Status Determination

```
Amount Due = Total Amount - Amount Paid

If Amount Due ≤ 0    → "Paid"
If Amount Paid > 0 AND Amount Due > 0  → "Partial"
If Amount Paid = 0   → "Pending"
```

### 4.6 POS Payment Logic (Smart Pricing)

The POS has built-in pricing intelligence:

| Scenario | Action |
|----------|--------|
| `Amount Paid ≥ Total Amount` | Process as Paid immediately |
| `Lowest Negotiable ≤ Amount Paid < Total` | Offer choice: apply discount OR create khaata (partial payment) |
| `Amount Paid < Lowest Negotiable` | Force khaata — requires customer name & phone (≥10 digits) |

### 4.7 Sale Record Fields

| Field | Description |
|-------|-------------|
| `sale_number` | Unique per store (format: `SALE-{store_id}-{timestamp}`) |
| `sale_number_store` | Sequential integer within the store (1, 2, 3...) — auto-assigned by trigger |
| `total_amount` | Final amount after discount |
| `amount_paid` | How much the customer actually paid |
| `amount_due` | Remaining balance |
| `payment_method` | `Cash` or `Digital` |
| `payment_status` | `Paid`, `Partial`, or `Pending` |
| `discount_type` | `percentage`, `amount`, or `none` |
| `discount_value` | The discount value applied |
| `cashier_id` | UUID of manager OR NULL |
| `cashier_ref_id` | Integer ID of cashier employee OR NULL |
| `sale_date` | Timestamp in PKT |
| `customer_name/phone/cnic` | Customer info (for tracking, especially partial payments) |

### 4.8 Sale Items (Line Items)

Each product in a sale creates a `sale_items` record:

| Field | Description |
|-------|-------------|
| `product_id` | Reference to the product |
| `product_sku` | SKU snapshot |
| `product_name` | Name snapshot |
| `quantity` | How many units sold |
| `unit_price` | Selling price per unit at time of sale |
| `cost_price_snapshot` | **Cost price at time of sale** — critical for COGS calculation |
| `subtotal` | `unit_price × quantity` |

**Why `cost_price_snapshot`?** Cost prices change as new batches arrive at different costs. Snapshotting at sale time ensures accurate historical profit calculations. This is the standard accounting practice for COGS.

---

## 5. FIFO Stock Deduction

### How FIFO Works

When a sale is made, stock is deducted using **First In, First Out** — the oldest batch's stock is consumed first.

**Database function: `deduct_stock_fifo(product_id, store_id, quantity, sale_id)`**

```
1. Get all non-depleted batches for this product, ordered by purchase_date ASC (oldest first)
2. For each batch (starting from oldest):
   a. Calculate: deduct_qty = MIN(batch.quantity_remaining, remaining_to_deduct)
   b. Update batch: quantity_remaining -= deduct_qty
   c. If quantity_remaining = 0: set is_depleted = true, depleted_at = NOW()
   d. remaining_to_deduct -= deduct_qty
   e. If remaining_to_deduct = 0: stop
3. Database trigger automatically recalculates aggregated_stock
```

### Example

You have 3 batches of "iPhone Case":
| Batch | Purchase Date | Cost | Qty Remaining |
|-------|---------------|------|---------------|
| B1 | Jan 1 | Rs.100 | 5 |
| B2 | Jan 15 | Rs.120 | 10 |
| B3 | Feb 1 | Rs.110 | 8 |

Customer buys **7 units**:
1. Deduct 5 from B1 (B1 now depleted, qty=0)
2. Deduct 2 from B2 (B2 qty=8 remaining)
3. B3 untouched

After this, `aggregated_stock` recalculates weighted averages using only B2 (qty=8) and B3 (qty=8).

---

## 6. Payment System

### 6.1 Payment Records

Every sale with `amount_paid > 0` creates a `payments` record:

| Field | Description |
|-------|-------------|
| `sale_id` | Which sale this payment is for |
| `amount` | How much was paid |
| `payment_method` | `Cash` or `Digital` |
| `manager_id` | UUID if a manager processed it (NULL otherwise) |
| `cashier_id` | Integer if a cashier processed it (NULL otherwise) |

**Constraint:** Exactly ONE of `manager_id` or `cashier_id` must be set (enforced by database CHECK constraint). This ensures every payment is traceable to who recorded it.

### 6.2 Payment Methods

The system tracks two payment methods across all financial transactions:

| Method | Used In |
|--------|---------|
| **Cash** | Sales, Expenses, Customer Payments, Supplier Payments |
| **Digital** | Sales, Expenses, Customer Payments, Supplier Payments |

Reports break down totals by Cash vs Digital for complete cash flow visibility.

---

## 7. Partial Payments & Customer Khaata (Ledger)

### 7.1 When Partial Payment Occurs

A partial payment happens when the customer pays less than the total amount at the POS:

```
Sale Total: Rs.10,000
Customer Pays: Rs.6,000
Amount Due: Rs.4,000  →  Payment Status = "Partial"
```

This creates:
1. A `sales` record with `payment_status = 'Partial'`, `amount_paid = 6000`, `amount_due = 4000`
2. A `partial_payment_customers` record:
   - `customer_name`, `customer_phone`, `customer_cnic`
   - `total_amount = 10000`
   - `amount_paid = 6000`
   - `amount_remaining = 4000`

### 7.2 Customer Ledger View

The Customer Khaata/Ledger page shows:
- **Aggregated view by customer** (grouped by `customer_phone`)
- Shows total owed, total paid, total remaining across ALL transactions for each customer
- Sorted by highest remaining balance first
- Expandable to show individual transactions per customer

### 7.3 Receiving Customer Dues (FIFO Payment Distribution)

When a customer comes to pay off their debt:

```
1. User enters: customer_phone, payment_amount, payment_method (Cash/Digital)
2. System finds ALL transactions for that customer where amount_remaining > 0
3. Transactions are ordered by created_at ASC (oldest debt first)
4. Payment is distributed across transactions (FIFO):
   - For each transaction (oldest first):
     a. applied = MIN(payment_amount_remaining, transaction.amount_remaining)
     b. transaction.amount_paid += applied
     c. transaction.amount_remaining -= applied
     d. payment_amount_remaining -= applied
     e. Record in customer_payments table
     f. If payment_amount_remaining = 0: stop
5. Validation: payment cannot exceed total remaining balance
```

### Example

Customer "Ali" has 3 outstanding transactions:
| Transaction | Total | Paid | Remaining |
|-------------|-------|------|-----------|
| Sale #1 (Jan 5) | 5,000 | 2,000 | 3,000 |
| Sale #2 (Jan 20) | 8,000 | 5,000 | 3,000 |
| Sale #3 (Feb 1) | 3,000 | 0 | 3,000 |

Ali pays **Rs.5,000**:
1. Apply Rs.3,000 to Sale #1 → Remaining: 0 (fully paid)
2. Apply Rs.2,000 to Sale #2 → Remaining: 1,000
3. Sale #3 untouched → Remaining: 3,000

After payment: Ali still owes Rs.4,000 total.

---

## 8. Supplier Khaata (Ledger)

### 8.1 When Supplier Debt Is Created

When restocking inventory, if the store doesn't pay the supplier in full:

```
Stock Batch Cost: Rs.50,000 (100 units × Rs.500)
Store Pays Supplier: Rs.30,000
Remaining Debt: Rs.20,000  →  Creates supplier_khaata record
```

A `supplier_khaata` record stores:
- `stock_batch_id` — which purchase this debt is from
- `supplier_id`, `supplier_name`, `supplier_phone`
- `total_amount = 50000`
- `amount_paid = 30000`
- `amount_remaining = 20000`

### 8.2 Supplier Ledger View

Shows suppliers aggregated by `supplier_id`:
- Total amount owed across all khaata records
- Total paid so far
- Total remaining balance
- Expandable to see individual transactions (each linked to a stock batch/product)

### 8.3 Paying Supplier Dues

**Per-record payment** (via `supplier_khaata_payments`):
1. Select a specific khaata record
2. Enter payment amount and method (Cash/Digital)
3. Updates that record: `amount_paid += payment`, `amount_remaining -= payment`
4. Records in `supplier_khaata_payments` table

**General supplier payment** (via `supplier_payments`):
1. Enter payment amount for a supplier
2. Updates `suppliers` table: `balance_owed -= amount`, `total_paid += amount`
3. Sets `last_payment_date`

### 8.4 Two Supplier Payment Systems

The system has two distinct but related supplier payment mechanisms:

| System | Table | Purpose |
|--------|-------|---------|
| **Khaata (per-batch)** | `supplier_khaata` + `supplier_khaata_payments` | Tracks debt per specific stock batch purchase |
| **General Ledger** | `suppliers` + `supplier_payments` | Tracks overall balance with supplier |

Both are independent — khaata payments don't auto-update the general supplier balance, giving the manager flexibility in how they track supplier relationships.

---

## 9. Expenses

### 9.1 Expense Categories

| Category | Description | Auto-Creating Trigger? |
|----------|-------------|----------------------|
| `inventory_restock` | Auto-created when stock batch is added (not initial) | **YES** — database trigger |
| `new_product` | Product purchase expenses | Application code |
| `Rent` | Monthly rent | Manual |
| `Utilities` | Electricity, gas, water, internet | Manual |
| `Salaries` | Employee salaries | Manual |
| `Supplies` | Office/store supplies | Manual |
| `Maintenance` | Repairs, maintenance | Manual |
| `Marketing` | Advertising, promotions | Manual |
| `Transportation` | Delivery, travel | Manual |
| `Equipment` | Equipment purchases | Manual |
| `Insurance` | Insurance premiums | Manual |
| `Miscellaneous` | Other expenses | Manual |

### 9.2 Auto-Created Inventory Expenses

When a stock batch is inserted with `is_initial_stock = FALSE`, the database trigger `create_restock_expense` automatically creates an expense:

```sql
INSERT INTO expenses (
  store_id,
  category = 'inventory_restock',
  description = 'Inventory restock - Batch #' || batch_number,
  amount = cost_price × quantity_purchased,
  expense_date = purchase_date
)
```

**Critical Rule:** `is_initial_stock = TRUE` does NOT create an expense. Initial stock is the store's starting capital, not an operating expense.

### 9.3 Expense Exclusion from Operating Costs

**The `new_product` and `inventory_restock` categories are EXCLUDED from operating expenses** in both the dashboard and reports. This is because:

1. These costs are captured as **COGS** (Cost of Goods Sold) through `sale_items.cost_price_snapshot`.
2. Including them in both COGS and operating expenses would **double-count** them.
3. The filter used everywhere: `.not('category', 'in', '("new_product","inventory_restock")')`

### 9.4 Expense Fields

| Field | Description |
|-------|-------------|
| `description` | What the expense is for |
| `amount` | How much was spent |
| `category` | Expense category |
| `payment_method` | `Cash` or `Digital` |
| `expense_date` | When the expense occurred |
| `recorded_by` | UUID of manager who recorded it |
| `reference_id` | Links to related record (e.g., `stock_batch.id` for restock expenses) |
| `marked_for_review` | Cashier can flag for manager review |
| `review_note` | Why it was flagged |

### 9.5 Predefined Expenses

Templates for recurring expenses:
- Managers can create templates (e.g., "Monthly Rent", "Internet Bill")
- Each template has a `default_amount`
- When recording an expense, select a template to auto-fill description, category, and amount
- Saves time for expenses that occur regularly

---

## 10. Inventory Purchases vs Operating Expenses

### 10.1 The UI Separation (Critical Fix - February 2026)

**Problem Identified:** Users reported that profit was dropping when restocking inventory or adding new products. This was caused by the Expenses page incorrectly treating ALL expenses (including inventory purchases) as profit-reducing operating costs.

**Solution:** The UI now separates these two fundamentally different types of transactions:

| Transaction Type | Where to View | How It Affects Profit |
|-----------------|---------------|----------------------|
| **Inventory Purchases** | `/dashboard/inventory-purchases` | **Does NOT reduce profit directly** — Cost is recognized through COGS when items sell |
| **Operating Expenses** | `/dashboard/expenses` | **DOES reduce profit** — These are business running costs |

### 10.2 Two Separate Pages

#### Operating Expenses Page (`/dashboard/expenses`)
- **Shows:** Only true operating costs (Rent, Utilities, Salaries, etc.)
- **Filters:** Excludes `new_product` and `inventory_restock` categories
- **Color Coding:** Red (cost that reduces profit)
- **Calculation:**
```typescript
const operatingExpenses = expenses.filter(e => 
  e.category !== 'new_product' && e.category !== 'inventory_restock'
)
```

#### Inventory Purchases Page (`/dashboard/inventory-purchases`)
- **Shows:** Only inventory investments (`new_product` and `inventory_restock`)
- **Filters:** Includes ONLY `new_product` and `inventory_restock` categories
- **Color Coding:** Blue (asset purchase, not an expense)
- **Info Banner:** "These transactions represent inventory purchases and do not directly affect your profit. The cost is recognized when items are sold (COGS)."
- **Calculation:**
```typescript
const inventoryPurchases = expenses.filter(e =>
  e.category === 'new_product' || e.category === 'inventory_restock'
)
```

### 10.3 Accounting Logic Explained

**Why are inventory purchases NOT expenses?**

1. **Balance Sheet Transaction:** When you buy inventory:
   - **Asset (Inventory) increases** by the purchase amount
   - **Asset (Cash) decreases** by the purchase amount
   - **Net Worth stays the same** (just converted cash to inventory)

2. **Profit Recognition:** The cost becomes an expense (COGS) ONLY when you sell the item:
   ```
   Buy:  Inventory +Rs.1000, Cash -Rs.1000  [No profit impact]
   Sell: Cash +Rs.1500, Inventory -Rs.1000  [Profit = Rs.500]
   ```

3. **Double-Counting Prevention:** If we treated inventory purchase as both:
   - An operating expense (reducing profit by Rs.1000 when purchased)
   - AND COGS (reducing profit by Rs.1000 when sold)
   - Total profit impact would be Rs.2000 instead of the correct Rs.1000

### 10.4 Where Each Category Appears

| Expense Category | Operating Expenses Page | Inventory Purchases Page | Affects Profit Calculations? |
|-----------------|------------------------|-------------------------|---------------------------|
| `inventory_restock` | ❌ No | ✅ Yes | No (cost flows through COGS) |
| `new_product` | ❌ No | ✅ Yes | No (cost flows through COGS) |
| `Rent` | ✅ Yes | ❌ No | Yes (operating cost) |
| `Utilities` | ✅ Yes | ❌ No | Yes (operating cost) |
| `Salaries` | ✅ Yes | ❌ No | Yes (operating cost) |
| `Supplies` | ✅ Yes | ❌ No | Yes (operating cost) |
| `Maintenance` | ✅ Yes | ❌ No | Yes (operating cost) |
| `Marketing` | ✅ Yes | ❌ No | Yes (operating cost) |
| `Transportation` | ✅ Yes | ❌ No | Yes (operating cost) |
| `Equipment` | ✅ Yes | ❌ No | Yes (operating cost) |
| `Insurance` | ✅ Yes | ❌ No | Yes (operating cost) |
| `Miscellaneous` | ✅ Yes | ❌ No | Yes (operating cost) |

### 10.5 Implementation Details

**Files Modified:**
- `app/dashboard/expenses/page.tsx` — Updated to filter out inventory categories
- `app/dashboard/inventory-purchases/page.tsx` — New page created
- `app/api/inventory-purchases/route.ts` — New API endpoint
- `components/Sidebar.tsx` — Added "Stock Purchases" navigation item
- `components/MobileBottomNav.tsx` — Added mobile navigation item

**Filter Used Everywhere:**
```typescript
// All profit calculations use this filter
.not('category', 'in', '("new_product","inventory_restock")')
```

**Locations Using This Filter:**
- `app/api/reports/route.ts` — Expenses report and profit calculations
- `app/api/dashboard-stats/route.ts` — Dashboard operating expenses card
- `app/dashboard/expenses/page.tsx` — Expenses page stats (client-side)

---

## 11. Profit & Loss Calculations

### 11.1 Key Financial Formulas

```
REVENUE        = SUM(sales.total_amount)                  [for the period]

COGS           = SUM(sale_items.cost_price_snapshot × sale_items.quantity)  [for sales in the period]

GROSS PROFIT   = REVENUE - COGS

OPERATING EXPENSES = SUM(expenses.amount)                 [for the period]
                     WHERE category NOT IN ('new_product', 'inventory_restock')

NET PROFIT     = GROSS PROFIT - OPERATING EXPENSES

PROFIT MARGIN  = (NET PROFIT / REVENUE) × 100             [percentage]
```

### 11.2 Understanding the Numbers

| Metric | What It Means |
|--------|--------------|
| **Revenue** | Total money earned from sales (including unpaid partial payments) |
| **COGS** | What the sold products originally cost you (based on snapshot at sale time) |
| **Gross Profit** | How much you made on the products themselves (before operational costs) |
| **Operating Expenses** | Running costs of the business (rent, salaries, utilities — NOT inventory purchases) |
| **Net Profit** | Your actual bottom-line earnings after everything |
| **Profit Margin** | What percentage of revenue is actual profit |

### 11.3 Per-Sale Profit (Sales Page)

Each sale shows individual profit:
```
Sale Cost  = SUM(cost_price_snapshot × quantity)  [for items in this sale]
Sale Profit = total_amount - Sale Cost
```

### 11.4 Inventory Profit Margin (Inventory Page)

Per-product margin displayed in the inventory:
```
Profit Per Unit = aggregated_selling_price - aggregated_cost_price
Margin %        = (Profit Per Unit / aggregated_cost_price) × 100
```

### 11.5 Important Accounting Notes

1. **Revenue counts ALL sales** regardless of payment status. A "Partial" sale of Rs.10,000 where only Rs.6,000 was paid still shows Rs.10,000 as revenue. The remaining Rs.4,000 is an **accounts receivable** (tracked in customer khaata).

2. **COGS uses historical cost snapshots**, not current prices. If you bought items at Rs.100 and later restocked at Rs.120, items sold from the Rs.100 batch use Rs.100 as cost.

3. **Inventory purchases are NOT operating expenses.** They are asset transactions (cash → inventory) and don't affect profit until items sell. See [Section 10](#10-inventory-purchases-vs-operating-expenses) for the complete explanation of the UI separation between inventory purchases and operating expenses.

4. **Discounts reduce revenue.** A Rs.10,000 sale with a 10% discount records `total_amount = 9,000`, so revenue reflects the actual money earned.

---

## 12. Dashboard Statistics

The dashboard displays these metrics, all for the current month unless noted:

### Revenue Card
```
Monthly Revenue = SUM(sales.total_amount) WHERE sale_date >= start of current month
```

### COGS Card
```
Monthly COGS = SUM(si.cost_price_snapshot × si.quantity)
               FOR sale_items si
               WHERE si.sale_id IN (sales for current month)
```

### Gross Profit Card
```
Gross Profit = Monthly Revenue - Monthly COGS
```

### Operating Expenses Card
```
Monthly Expenses = SUM(expenses.amount) WHERE expense_date >= start of month
                   AND category NOT IN ('new_product', 'inventory_restock')

Today's Expenses = same but WHERE expense_date >= start of today
```

### Net Profit Card
```
Net Profit = Gross Profit - Monthly Expenses
```

### Other Dashboard Data

| Widget | Data Source |
|--------|-----------|
| **Orders This Month** | COUNT of sales this month |
| **Top Expense Categories** | Expenses grouped by category, sorted by total (top 3) |
| **Low Stock Alert** | Products where `total_quantity_remaining ≤ low_stock_threshold` |
| **Sales Trend** | Last 7 days daily revenue (bar chart) |
| **Top Products** | Sale items grouped by product_name, sorted by revenue (top 5) |
| **Recent Sales** | Last 5 sales with details |

---

## 13. Reports & Export

### 13.1 Report Types

| Report | Key Metrics |
|--------|------------|
| **Summary** | Revenue, Expenses, Net Profit, Profit Margin, Cash Present, Stock Value, Cash Flow Trend chart |
| **Sales** | Total Revenue, Cash/Digital breakdown, Avg Order Value, Paid/Partial counts, Top Products, Sales table |
| **Expenses** | Total Expenses, Cash/Digital breakdown, By-category breakdown, Expenses table |
| **Inventory** | Total Stock In, Stock Value, Remaining, Sold quantities, Batch details |
| **Profit & Loss** | Revenue, COGS, Gross Profit, Operating Expenses, Net Profit, Profit Margin, P&L Statement |

### 13.2 Report Filters

| Filter | Available For |
|--------|--------------|
| **Date Range** | All reports (Today, This Week, This Month, This Year, Custom) |
| **Period Grouping** | Sales, Expenses (Daily, Weekly, Monthly, Yearly) |
| **Payment Method** | Sales, Expenses (Cash, Digital) |
| **Cashier** | Sales only |
| **Category** | Expenses only |

### 13.3 Cash Present Calculation (Summary Report)

```
Cash Present = Total Cash Sales - Total Cash Expenses

Where:
  Total Cash Sales    = SUM(sales.total_amount) WHERE payment_method = 'Cash'
  Total Cash Expenses = SUM(expenses.amount) WHERE payment_method = 'Cash'
```

This tells you how much cash should physically be in the register/drawer.

### 13.4 Cash Flow Trend (Summary Report)

Daily breakdown showing:
```
For each day in the date range:
  Cash In  = SUM(sales.total_amount) for that day   [all payment methods]
  Cash Out = SUM(expenses.amount) for that day       [all payment methods]
```

Displayed as a line chart with two lines (Cash In vs Cash Out).

### 13.5 CSV Export

Available for all report types. Generates downloadable `.csv` files:

| Report | CSV Columns |
|--------|------------|
| **Sales** | Date, Sale ID, Cashier, Total, Payment Method, Status |
| **Expenses** | Date, Category, Description, Amount, Payment Method |
| **Inventory** | Product, SKU, Purchased, Remaining, Sold, Cost Price |
| **Summary** | Key-value pairs (Total Sales, Revenue, Cash, Digital, Expenses, Net Profit, Margin) |

### 13.6 PDF Export

The "PDF" export generates an **HTML document** that opens in a new browser window and triggers the print dialog (`window.print()`). The user then prints to PDF via the browser.

**Sales PDF includes:**
- Summary cards: Revenue, Cost, Profit, Loaned Amount
- Cash vs Digital transaction breakdown
- Collection summary
- Line-item table of all sales

**Loaned Amount calculation:**
```
Loaned Amount = SUM(partial_payment_customers.amount_remaining)
                FOR sales in the selected period
```

---

## 14. Sale Deletion & Stock Reversal

### What Happens When a Sale Is Deleted

The database trigger `revert_sale_deletion` fires **BEFORE DELETE** on the `sales` table:

```
1. For each sale_item in the deleted sale:
   a. Find stock batches for this product (ordered by purchase_date DESC — most recent first)
   b. Restore quantity_remaining to each batch (reverse FIFO)
   c. Set is_depleted = FALSE, depleted_at = NULL for restored batches
   
2. For phone products:
   a. Set IMEIs back to status = 'in_stock'
   b. Clear sold_at and sale_id
   
3. sale_items are CASCADE deleted automatically
4. aggregated_stock is recalculated by the stock_batches trigger
```

**Important:** Stock reversal uses reverse-FIFO (most recent batches first) to approximate putting items "back" onto the most recently opened batches.

**Only Managers can delete sales.** Cashiers can only mark sales for review.

---

## 15. Database Triggers (Automated Logic)

| Trigger | Table | Event | Action |
|---------|-------|-------|--------|
| `trigger_update_aggregated_stock` | `stock_batches` | AFTER INSERT/UPDATE/DELETE | Recalculates `aggregated_stock` weighted averages and totals |
| `trigger_create_restock_expense` | `stock_batches` | AFTER INSERT | Creates expense record if `is_initial_stock = FALSE` |
| `trigger_revert_sale_deletion` | `sales` | BEFORE DELETE | Restores stock quantities and IMEI statuses |
| `trigger_set_sale_number_store` | `sales` | BEFORE INSERT | Auto-assigns sequential sale_number_store |
| `hash_cashier_password_trigger` | `cashier_accounts` | BEFORE INSERT | Hashes password with bcrypt |
| `update_updated_at_column` | Various | BEFORE UPDATE | Sets `updated_at = CURRENT_TIMESTAMP` |

---

## 16. User Roles & Permissions

### Roles

| Role | Auth Method | Stored In |
|------|------------|-----------|
| **Manager** | Supabase Auth (email/password) | `managers` table (UUID from auth) |
| **Cashier** | Custom auth (phone/name + password, bcrypt) | `cashier_accounts` table (integer ID) |

### Permission Matrix

| Action | Manager | Cashier |
|--------|---------|---------|
| Create/edit/delete users | ✅ | ❌ |
| Create/edit products | ✅ | ✅ |
| Delete products | ✅ | ❌ |
| Process sales (POS) | ✅ | ✅ |
| View sales | ✅ | ❌ |
| Delete sales | ✅ | ❌ |
| Add expenses | ✅ | ✅ |
| Edit/delete expenses | ✅ | ❌ |
| View reports | ✅ | ❌ |
| Export reports | ✅ | ❌ |
| View dashboard | ✅ | ❌ |
| Mark for review | ❌ | ✅ |

### Who Recorded What

Every `payments` and `customer_payments` record tracks who recorded it:
- `manager_id` (UUID) — if a manager made the transaction
- `cashier_id` (integer) — if a cashier made the transaction
- **Exactly one must be set** (database constraint prevents both or neither)

---

## 17. Date & Timezone Handling

All dates use **Pakistan Time (PKT, UTC+5)**:

| Function | Purpose |
|----------|---------|
| `getPKTNow()` | Current PKT timestamp as ISO string |
| `getPKTDate()` | Current PKT date as `YYYY-MM-DD` |
| `formatDateToPKT(utc)` | Convert UTC date to PKT display format |

**Report date ranges:**
- Start date: midnight PKT of the selected start date
- End date: 23:59:59.999 PKT of the selected end date (inclusive)

---

## 18. Complete Data Flow Diagrams

### 18.1 Restocking Flow

```
Manager adds stock batch
         │
         ├─→ stock_batches INSERT
         │         │
         │         ├─→ [TRIGGER] update_aggregated_stock
         │         │     └─→ Recalculates weighted avg prices & quantities
         │         │
         │         └─→ [TRIGGER] create_restock_expense (if NOT initial stock)
         │               └─→ expenses INSERT (category: inventory_restock)
         │
         ├─→ If partial payment to supplier:
         │     └─→ supplier_khaata INSERT (tracks remaining debt)
         │
         └─→ If phone product:
               └─→ product_imeis INSERT (one per IMEI, status: in_stock)
```

### 18.2 Sale Flow

```
Customer selects items at POS
         │
         ├─→ Prices from aggregated_stock (weighted averages)
         │
         ├─→ Applied discount (percentage/amount/none)
         │
         └─→ Payment received
               │
               ├─→ sales INSERT (total, paid, due, status)
               │
               ├─→ sale_items INSERT (per product, with cost_price_snapshot)
               │
               ├─→ payments INSERT (amount, method, recorder)
               │
               ├─→ deduct_stock_fifo() called per item
               │     │
               │     ├─→ stock_batches UPDATE (qty_remaining decreased, FIFO order)
               │     │
               │     └─→ [TRIGGER] update_aggregated_stock (recalculates averages)
               │
               ├─→ If Partial payment:
               │     └─→ partial_payment_customers INSERT
               │
               └─→ If phone product:
                     └─→ product_imeis UPDATE (status: sold, sale_id set)
```

### 18.3 Customer Payment Flow

```
Customer comes to pay dues
         │
         ├─→ Look up by customer_phone
         │
         ├─→ Find all partial_payment_customers with amount_remaining > 0
         │
         ├─→ Distribute payment FIFO (oldest transaction first):
         │     │
         │     ├─→ partial_payment_customers UPDATE (amount_paid ↑, amount_remaining ↓)
         │     │
         │     └─→ customer_payments INSERT (records each payment application)
         │
         └─→ If payment covers a sale completely:
               └─→ sale payment_status could update to 'Paid'
```

### 18.4 Expense Flow

```
User records expense
         │
         ├─→ expenses INSERT (description, amount, category, payment_method)
         │
         └─→ Dashboard/Reports recalculate:
               ├─→ If category is 'new_product' or 'inventory_restock':
               │     └─→ EXCLUDED from operating expenses (tracked via COGS instead)
               │
               └─→ All other categories:
                     └─→ INCLUDED in operating expenses → affects Net Profit
```

### 18.5 Profit Calculation Flow

```
                    ┌──────────────────────┐
                    │   REVENUE            │
                    │   SUM(sales.total)   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   - COGS             │
                    │   SUM(cost_snapshot   │
                    │     × quantity)       │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   = GROSS PROFIT     │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   - OPERATING        │
                    │     EXPENSES         │
                    │   (excl. inventory   │
                    │    categories)       │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   = NET PROFIT       │
                    │                      │
                    │   Margin = Net/Rev   │
                    │            × 100     │
                    └──────────────────────┘
```

### 18.6 Sale Deletion Flow

```
Manager deletes sale
         │
         ├─→ [TRIGGER] revert_sale_deletion (BEFORE DELETE)
         │     │
         │     ├─→ For each sale_item:
         │     │     ├─→ stock_batches UPDATE (qty_remaining restored, reverse-FIFO)
         │     │     └─→ [TRIGGER] update_aggregated_stock (recalculates)
         │     │
         │     └─→ For phone items:
         │           └─→ product_imeis UPDATE (status: in_stock, sale_id cleared)
         │
         ├─→ sale_items CASCADE DELETE
         │
         ├─→ payments CASCADE DELETE
         │
         └─→ Revenue, COGS, Profit all decrease accordingly
```

---

## Appendix A: Complete Table Schema Reference

### sales
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment |
| sale_number | VARCHAR(50) | Unique per store |
| sale_number_store | INTEGER | Sequential within store (auto-assigned) |
| sale_description | VARCHAR(255) | Optional description |
| cashier_id | UUID | Manager who processed (NULL if cashier) |
| cashier_ref_id | INTEGER | Cashier who processed (NULL if manager) |
| total_amount | DECIMAL(10,2) | Final amount after discount |
| payment_method | VARCHAR(20) | 'Cash' or 'Digital' |
| payment_status | VARCHAR(20) | 'Paid', 'Partial', or 'Pending' |
| amount_paid | DECIMAL(10,2) | How much customer paid |
| amount_due | DECIMAL(10,2) | Remaining balance |
| discount_type | VARCHAR(20) | 'percentage', 'amount', or 'none' |
| discount_value | DECIMAL(10,2) | Discount value applied |
| sale_date | TIMESTAMP | When sale was made (PKT) |
| store_id | INTEGER FK | Which store |
| customer_id | INTEGER FK | Link to partial_payment_customers |
| customer_name | VARCHAR(100) | Customer name |
| customer_phone | VARCHAR(20) | Customer phone |
| customer_cnic | VARCHAR(20) | Customer CNIC |
| marked_for_review | BOOLEAN | Cashier flagged for manager |
| review_reason | TEXT | Why it was flagged |

### sale_items
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment |
| sale_id | INTEGER FK | Parent sale |
| product_id | INTEGER FK | Product reference |
| product_sku | VARCHAR(50) | SKU snapshot |
| product_name | VARCHAR(100) | Name snapshot |
| quantity | INTEGER | Units sold (>0) |
| unit_price | DECIMAL(10,2) | Selling price per unit |
| cost_price_snapshot | DECIMAL(10,2) | Cost price at time of sale |
| subtotal | DECIMAL(10,2) | unit_price × quantity |

### stock_batches
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment |
| product_id | INTEGER FK | Product reference |
| store_id | INTEGER FK | Store reference |
| supplier_id | INTEGER FK | Supplier (optional) |
| batch_number | VARCHAR(50) | Generated batch code |
| purchase_date | TIMESTAMPTZ | When batch was purchased |
| cost_price | DECIMAL(10,2) | Purchase cost per unit |
| selling_price | DECIMAL(10,2) | Target selling price |
| lowest_negotiable_price | DECIMAL(10,2) | Min acceptable price |
| quantity_purchased | INTEGER | Units purchased |
| quantity_remaining | INTEGER | Units remaining (0 ≤ remaining ≤ purchased) |
| is_depleted | BOOLEAN | TRUE when remaining = 0 |
| is_initial_stock | BOOLEAN | TRUE = no expense created |

### expenses
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment |
| description | VARCHAR(255) | What the expense is for |
| amount | DECIMAL(10,2) | Expense amount |
| category | VARCHAR(50) | Expense category |
| payment_method | VARCHAR(20) | 'Cash' or 'Digital' |
| expense_date | DATE | When expense occurred |
| recorded_by | UUID | Manager who recorded |
| store_id | INTEGER FK | Store reference |
| reference_id | INTEGER | Links to stock_batch for restock expenses |
| marked_for_review | BOOLEAN | Cashier flagged |

### partial_payment_customers
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment |
| sale_id | INTEGER FK | Related sale |
| customer_name | VARCHAR(100) | Customer name |
| customer_cnic | VARCHAR(20) | CNIC number |
| customer_phone | VARCHAR(20) | Phone number (used for aggregation) |
| total_amount | DECIMAL(10,2) | Sale total |
| amount_paid | DECIMAL(10,2) | Paid so far |
| amount_remaining | DECIMAL(10,2) | Still owed |
| store_id | INTEGER FK | Store reference |

### supplier_khaata
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment |
| stock_batch_id | INTEGER FK | Related stock purchase |
| supplier_id | INTEGER FK | Supplier reference |
| supplier_name | VARCHAR(100) | Name snapshot |
| supplier_phone | VARCHAR(20) | Phone snapshot |
| total_amount | DECIMAL(10,2) | Total batch cost |
| amount_paid | DECIMAL(10,2) | Paid to supplier so far |
| amount_remaining | DECIMAL(10,2) | Still owed to supplier |
| store_id | INTEGER FK | Store reference |

---

## Appendix B: Summary of What Changes What

| Action | Revenue | COGS | Expenses | Gross Profit | Net Profit | Stock |
|--------|---------|------|----------|-------------|------------|-------|
| **Make a sale** | ↑ | ↑ | — | Changes | Changes | ↓ |
| **Delete a sale** | ↓ | ↓ | — | Changes | Changes | ↑ |
| **Add stock (initial)** | — | — | — | — | — | ↑ |
| **Add stock (restock)** | — | — | ❌ NO | — | ✅ NO | ↑ |
| **Record expense** | — | — | ↑ | — | ↓ | — |
| **Customer pays dues** | — | — | — | — | — | — |
| **Pay supplier** | — | — | — | — | — | — |
| **Apply discount** | ↓ (lower total) | — | — | ↓ | ↓ | — |

**Critical Notes:**
- **Inventory restocks/purchases DO NOT affect profit.** They create an expense record for audit purposes (visible on Inventory Purchases page), but this expense is excluded from all profit calculations. The cost is recognized through COGS when items sell.
- Customer due payments and supplier payments don't affect profit calculations — they only update the ledger balances.
- Revenue is recognized at the time of sale regardless of payment status.

---

*This document covers the complete financial and operational logic of the POS system. Every number change, every transaction, and every automated trigger is documented here.*
