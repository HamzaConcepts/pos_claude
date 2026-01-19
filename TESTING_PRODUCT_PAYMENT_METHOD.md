# Quick Testing Guide - Product Addition & Payment Method

## Before Testing
1. Run the database migration:
   - Open Supabase SQL Editor
   - Copy and paste contents of `database/add_payment_method_and_product_details.sql`
   - Execute the migration

## Test 1: Add New Product with Cash Payment

### Steps:
1. Navigate to **Inventory** page
2. Click **Add Product** button
3. Fill in:
   - Category: Select any category
   - Product Name: "Test Phone Model X"
   - Cost Price: 50000
   - Selling Price: 60000
   - Lowest Negotiable: 55000
   - Quantity: 5
   - Supplier Phone: Enter any number
   - Amount Paid: 250000 (full payment)
   - **Payment Method: Cash** ← Check this is visible and selected
4. Submit

### Expected Results:
- ✓ Product created successfully
- ✓ Go to **Expenses** page
- ✓ See entry: "New Product: Test Phone Model X (Qty: 5)"
- ✓ Amount: Rs. 250,000
- ✓ Payment Method: **Cash**
- ✓ Category: new_product (not inventory_restock)

---

## Test 2: Add New Product with Digital Payment

### Steps:
1. Navigate to **Inventory** page
2. Click **Add Product** button
3. Fill in:
   - Category: Select any category
   - Product Name: "Test Laptop XYZ"
   - Cost Price: 80000
   - Selling Price: 95000
   - Lowest Negotiable: 88000
   - Quantity: 3
   - Supplier Phone: Enter any number
   - Amount Paid: 240000 (full payment)
   - **Payment Method: Digital (Bank Transfer)** ← Select this
4. Submit

### Expected Results:
- ✓ Product created successfully
- ✓ Go to **Expenses** page
- ✓ See entry: "New Product: Test Laptop XYZ (Qty: 3)"
- ✓ Amount: Rs. 240,000
- ✓ Payment Method: **Digital**
- ✓ Category: new_product

---

## Test 3: Restock Existing Product with Cash

### Steps:
1. Navigate to **Inventory** page
2. Click **Restock** button
3. Search for any existing product (e.g., the phone you just added)
4. Fill in:
   - Cost Price: 51000
   - Selling Price: 61000
   - Lowest Negotiable: 56000
   - Quantity: 10
   - Amount Paid: 510000 (full payment)
   - **Payment Method: Cash** ← Select this
5. Submit

### Expected Results:
- ✓ Stock restocked successfully
- ✓ Go to **Expenses** page
- ✓ See entry: "Restock: Test Phone Model X - Batch #[number] (Qty: 10)"
- ✓ Amount: Rs. 510,000
- ✓ Payment Method: **Cash**
- ✓ Category: inventory_restock (not new_product)

---

## Test 4: Restock with Digital Payment

### Steps:
1. Navigate to **Inventory** page
2. Click **Restock** button
3. Search for any existing product
4. Fill in:
   - Cost Price: 82000
   - Selling Price: 96000
   - Lowest Negotiable: 89000
   - Quantity: 5
   - Amount Paid: 410000 (full payment)
   - **Payment Method: Digital (Bank Transfer)** ← Select this
5. Submit

### Expected Results:
- ✓ Stock restocked successfully
- ✓ Go to **Expenses** page
- ✓ See entry: "Restock: [Product Name] - Batch #[number] (Qty: 5)"
- ✓ Amount: Rs. 410,000
- ✓ Payment Method: **Digital**
- ✓ Category: inventory_restock

---

## Test 5: Partial Payment (Supplier Khaata)

### Steps:
1. Navigate to **Inventory** page
2. Click **Add Product** button
3. Fill in product details
4. For payment:
   - Total Amount: 500,000 (e.g., 50,000 × 10)
   - Amount Paid: 300,000 (partial)
   - **Payment Method: Cash**
   - Supplier Info: Required for partial payment
5. Submit

### Expected Results:
- ✓ Product created successfully
- ✓ Expense created with payment method: Cash
- ✓ Remaining 200,000 added to Supplier Khaata
- ✓ Go to **Supplier Ledger** to verify pending payment

---

## Test 6: Payment Method in Reports

### Steps:
1. Navigate to **Overview** or **Reports** page
2. Check if payment method breakdown is visible:
   - Cash In/Out
   - Digital In/Out

### Expected Results:
- ✓ Cash and Digital transactions shown separately
- ✓ Correct totals for each payment method
- ✓ Filter by payment method works (if implemented)

---

## Troubleshooting

### Issue: Payment Method dropdown not visible
**Solution:** 
- Refresh the page
- Clear browser cache
- Verify frontend changes were deployed

### Issue: Expense shows "Inventory restock - Batch #" instead of product name
**Solution:**
- Verify database migration was run
- Check if trigger was created successfully
- Run this query in Supabase:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_create_restock_expense';
```

### Issue: Payment method not showing in expenses
**Solution:**
- Verify `payment_method` column exists in both tables:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'stock_batches' AND column_name = 'payment_method';

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'expenses' AND column_name = 'payment_method';
```

### Issue: Old expenses don't have product names
**Solution:**
- Run the DO block in the migration to update old records
- Or wait for new entries (old ones won't be updated automatically)

---

## Verification Checklist

After all tests, verify:
- [ ] New products show as "New Product: [name]" in expenses
- [ ] Restocks show as "Restock: [name] - Batch #[number]" in expenses
- [ ] Cash payment method is recorded correctly
- [ ] Digital payment method is recorded correctly
- [ ] Payment method visible in expense listings
- [ ] Partial payments work with payment method tracking
- [ ] Supplier Khaata tracks payment method for dues
- [ ] Reports show cash vs digital breakdown

---

## Success Criteria

All tests pass if:
1. ✅ Add Product creates "New Product" expense entry
2. ✅ Restock creates "Restock" expense entry
3. ✅ Payment method (Cash/Digital) is selectable in both modals
4. ✅ Payment method is stored and displayed correctly
5. ✅ Product names appear in expense descriptions
6. ✅ Quantities appear in expense descriptions

If all criteria are met, the implementation is successful! 🎉

