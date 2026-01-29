# Inventory Enhancement - Testing Guide

## 🎯 What's Been Implemented

### Phase 1: Database Schema ✅
- **New Tables Created:**
  - `suppliers` - Store supplier information with unique phone numbers
  - `stock_batches` - Track individual stock purchases (FIFO)
  - `product_imeis` - Track IMEI numbers for phone products
  
- **Products Table Enhanced:**
  - `cost_price` - Purchase price (hidden from public)
  - `target_price` - Regular selling price
  - `min_sale_price` - Minimum negotiable price
  - `average_price` - Auto-calculated weighted average
  - `is_phone` - Flag for phone category products
  - `category_id`, `subcategory_id` - Links to categories

- **Database Functions:**
  - `generate_batch_number()` - Auto-generates batch numbers
  - `update_product_average_price()` - Calculates weighted average
  - `deduct_stock_fifo()` - Handles FIFO stock deduction
  - Auto-triggers to update average price when batches change

### Phase 2: API Endpoints ✅
- **`/api/suppliers`** - Supplier CRUD with phone search
- **`/api/stock-batches`** - Batch management and FIFO tracking
- **`/api/imeis`** - IMEI tracking for phone products

### Phase 5: Add Stock Modal ✅
- **Multi-Step Form:**
  1. Product info (category → subcategory → name)
  2. Pricing (C.P, T.P, M.S.P)
  3. Stock & Supplier (quantity, supplier search)
  4. IMEI numbers (conditional, only for phones)

### Phase 7: Inventory Display ✅
- **Updated Table Columns:**
  - Target Price, Min Price, Avg Price
  - Cost price hidden from view
  - Batch information in expanded view

---

## 🧪 Testing Checklist

### 1. Database Migration
- [x] Run `database/inventory_enhancement_migration.sql` in Supabase SQL Editor
- [ ] Verify all tables created successfully
- [ ] Check that existing products have migrated data

### 2. Add Stock - Basic Product
**Steps:**
1. Go to Inventory page
2. Click "Add Stock" button
3. **Step 1 - Product Info:**
   - Select a category (non-phone)
   - Select subcategory (if available)
   - Enter product name: "Test Product 1"
   - Add description (optional)
   - Click "Next"

4. **Step 2 - Pricing:**
   - Cost Price: `100.00`
   - Target Price: `150.00`
   - Min Sale Price: `130.00`
   - Click "Next"

5. **Step 3 - Supplier:**
   - Quantity: `10`
   - Supplier Phone: `1234567890`
   - Supplier Name: `Test Supplier` (if new)
   - Click "Add Stock"

**Expected Results:**
- ✅ Product created successfully
- ✅ Stock batch created with quantity 10
- ✅ Supplier created (or existing one used)
- ✅ Product shows in inventory list
- ✅ Table displays: Target Price $150, Min Price $130, Avg Price hidden (same as target)

### 3. Add Stock - Phone Product with IMEI
**Steps:**
1. Click "Add Stock"
2. **Step 1:**
   - Select "Phone" or "Mobile" category
   - Enter product name: "Test Phone"
   - Click "Next"

3. **Step 2:**
   - Cost Price: `200.00`
   - Target Price: `300.00`
   - Min Sale Price: `250.00`
   - Click "Next"

4. **Step 3:**
   - Quantity: `3`
   - Supplier Phone: `1234567890` (reuse or new)
   - Click "Next"

5. **Step 4 - IMEI Numbers:**
   - Enter 3 unique IMEI numbers (e.g., `123456789012345`, `123456789012346`, `123456789012347`)
   - Click "Add Stock"

**Expected Results:**
- ✅ 4-step process (includes IMEI step)
- ✅ Product created with `is_phone = true`
- ✅ 3 IMEIs stored in database
- ✅ All IMEIs marked as "in_stock"

### 4. Supplier Autocomplete
**Steps:**
1. Click "Add Stock"
2. Navigate to Step 3 (Supplier)
3. Start typing phone number of existing supplier (e.g., `1234`)

**Expected Results:**
- ✅ Dropdown appears with matching suppliers
- ✅ Shows supplier name and phone
- ✅ Clicking selects and auto-fills

### 5. Validation Tests
**Test invalid inputs:**

**Pricing Validation:**
- [ ] Try Min Price > Target Price → Should show error
- [ ] Try negative prices → Should show error
- [ ] Try leaving required fields empty → Should block next step

**IMEI Validation (for phones):**
- [ ] Enter fewer IMEIs than quantity → Should show error
- [ ] Enter duplicate IMEI → Should show error
- [ ] Leave IMEI fields empty → Should show error

**Supplier Validation:**
- [ ] Try adding duplicate phone number → Should reuse existing supplier

### 6. Inventory Display Verification
**Check the updated table:**
- [ ] Cost price is NOT visible in main table
- [ ] Target Price column shows correct values
- [ ] Min Price column shows correct values
- [ ] Avg Price only shows when different from target (with blue badge)
- [ ] Stock quantity is accurate

**Check expanded view:**
- [ ] Shows all pricing fields
- [ ] Batch section appears for multi-batch products
- [ ] Batches sorted by purchase date (oldest first)
- [ ] Profit margin calculated with average price
- [ ] Stock value uses average price

---

## 🐛 Known Issues to Watch For

1. **Store ID Context:** Make sure you're logged in properly so `getStoreId()` works
2. **Category Detection:** Phone category detection is case-insensitive, looks for "phone" or "mobile" in category name
3. **Batch Number Generation:** Auto-generated as `PROD-YYYYMMDD-NNN`
4. **RLS Policies:** Ensure you're testing with correct user permissions

---

## 🔄 What Still Needs Implementation

### Not Yet Implemented:
- **FIFO Deduction on Sales** - When products are sold, stock should deduct from oldest batch first
- **IMEI Selection on Sales** - When selling phones, should select specific IMEI and mark as sold
- **Restock Modal Integration** - Current restock modal needs to use new batch system

---

## 📝 Quick Database Queries

```sql
-- Check suppliers
SELECT * FROM suppliers WHERE store_id = YOUR_STORE_ID;

-- Check stock batches
SELECT * FROM stock_batches WHERE store_id = YOUR_STORE_ID ORDER BY purchase_date DESC;

-- Check IMEIs
SELECT * FROM product_imeis WHERE store_id = YOUR_STORE_ID;

-- Check products with new price fields
SELECT id, name, cost_price, target_price, min_sale_price, average_price, is_phone 
FROM products 
WHERE store_id = YOUR_STORE_ID;
```

---

**Ready to test! Report back with any issues you encounter.** 🚀
