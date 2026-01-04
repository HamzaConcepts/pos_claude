# Quick Testing Guide - High Priority Fixes
**Date**: January 1, 2026

## 🚀 Quick Start - Test in 15 Minutes

### Prerequisites
✅ Access to Supabase Dashboard  
✅ Access to POS application  
✅ Manager account for testing

---

## 📝 Test Plan

### **Test 1: Per-Store Sale ID Sequence** (5 minutes)

#### Step 1: Run Migration
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `database/add_per_store_sale_ids.sql`
3. Paste and click "Run"
4. Wait for "Success" message

#### Step 2: Verify Migration
```sql
-- Run this query
SELECT store_id, 
       COUNT(*) as total_sales,
       MIN(sale_number_store) as first,
       MAX(sale_number_store) as last
FROM sales
GROUP BY store_id;
```

**Expected**: Each store should have sequential numbers starting from 1

#### Step 3: Test New Sale
1. Login to your store
2. Go to POS
3. Add products and complete a sale
4. Note the sale ID shown

5. Check in Supabase:
```sql
SELECT sale_number_store, store_id, sale_number 
FROM sales 
ORDER BY created_at DESC 
LIMIT 5;
```

**Expected**: New sale has correct `sale_number_store`

✅ **PASS** if sale numbers are sequential per store  
❌ **FAIL** if numbers are missing or duplicated

---

### **Test 2: Supplier Validation** (5 minutes)

#### Test A: Full Payment (Should Work)
1. Go to Inventory → Add Stock
2. Fill: Name: "Test Product", Cost: $100, Qty: 10
3. Amount Paid: $1000 (full payment)
4. Leave supplier fields EMPTY
5. Click Submit

**Expected**: ✅ Success (no supplier required)

#### Test B: Partial Payment No Supplier (Should Fail)
1. Go to Inventory → Add Stock
2. Fill: Name: "Test Product 2", Cost: $100, Qty: 10
3. Amount Paid: $500 (partial)
4. Leave supplier fields EMPTY
5. Click Submit

**Expected**: ❌ Error: "Supplier information is required when making partial payment"

#### Test C: Partial Payment With Supplier (Should Work)
1. Retry test B
2. Add Supplier Phone: "1234567890"
3. Add Supplier Name: "Test Supplier"
4. Click Submit

**Expected**: ✅ Success, entry in Supplier Khaata

✅ **PASS** if validation works as expected  
❌ **FAIL** if can submit partial payment without supplier

---

### **Test 3: Product Names in Expenses** (5 minutes)

#### Step 1: Create Inventory Expense
1. Go to Inventory → Add Stock
2. Add a product (this creates an expense)
3. Note the product name and SKU

#### Step 2: Check Expenses Page
1. Go to Expenses
2. Find the expense just created
3. Look at the description column

**Expected**: Should show:
```
Inventory Purchase - [Product Name]
Product: Product Name (SKU)
```

#### Step 3: Check Old Expenses
1. Scroll through expenses list
2. Verify old expenses still display correctly
3. No errors or missing data

✅ **PASS** if product info appears below description  
❌ **FAIL** if still showing batch numbers or errors

---

## ✅ Quick Checklist

- [ ] Migration ran successfully
- [ ] All sales have `sale_number_store`
- [ ] New sales get sequential IDs
- [ ] Full payment works without supplier
- [ ] Partial payment requires supplier
- [ ] Product names show in expenses
- [ ] No console errors
- [ ] Mobile view works

---

## 🐛 Troubleshooting

### Migration Failed?
```sql
-- Check for issues
SELECT COUNT(*) FROM sales WHERE sale_number_store IS NULL;

-- If any NULL, the trigger isn't working
-- Check if trigger exists:
SELECT * FROM pg_trigger WHERE tgname = 'trigger_set_sale_number_store';
```

### Supplier Validation Not Working?
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Check browser console for errors

### Product Names Not Showing?
```sql
-- Check if batch_id exists in expenses
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'expenses' AND column_name = 'batch_id';

-- If missing, the expenses aren't linked to batches
```

---

## 📊 Report Results

After testing, report status:

### Fix #1: Per-Store Sale IDs
- [ ] ✅ Working
- [ ] ⚠️ Partial (describe issue)
- [ ] ❌ Not working (describe issue)

### Fix #2: Supplier Validation
- [ ] ✅ Working
- [ ] ⚠️ Partial (describe issue)
- [ ] ❌ Not working (describe issue)

### Fix #3: Product Names
- [ ] ✅ Working
- [ ] ⚠️ Partial (describe issue)
- [ ] ❌ Not working (describe issue)

---

## 📞 Next Steps

**If all tests pass**:
1. Deploy to production
2. Monitor for 24 hours
3. Mark issues as RESOLVED

**If any test fails**:
1. Document the specific failure
2. Check browser console logs
3. Check Supabase logs
4. Review implementation files
5. Request assistance if needed

---

**Happy Testing! 🎉**
