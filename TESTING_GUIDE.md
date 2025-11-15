# Testing Guide - Phase 2 Features

## Prerequisites

1. **Supabase Setup**
   - Database schema must be applied (`database/schema.sql`)
   - At least one user account created
   - Sample products added (recommended)

2. **Environment Variables**
   - `.env.local` configured with Supabase credentials
   - Server running on http://localhost:3001 (or 3000)

## Quick Start Testing (5 Minutes)

### Step 1: Login
1. Open http://localhost:3001
2. Login with your test account (e.g., manager@pos.com)

### Step 2: Add Products (2 minutes)
1. Click "Inventory" in sidebar
2. Click "Add Product" button
3. Create 3-5 test products:

   **Product 1:**
   - Name: Wireless Mouse
   - SKU: MS-001
   - Price: 29.99
   - Cost: 15.00
   - Stock: 50
   - Category: Electronics

   **Product 2:**
   - Name: USB Cable
   - SKU: CAB-001
   - Price: 9.99
   - Cost: 4.00
   - Stock: 8 (This will show as low stock!)
   - Threshold: 10
   - Category: Accessories

   **Product 3:**
   - Name: Keyboard
   - SKU: KB-001
   - Price: 49.99
   - Cost: 25.00
   - Stock: 30
   - Category: Electronics

### Step 3: Test POS System (2 minutes)
1. Click "POS" in sidebar
2. Search for "Wireless Mouse"
3. Click on it to add to cart
4. Add more products
5. Select "Cash" as payment method
6. Enter amount: 100.00
7. Click "Complete Sale"
8. View the receipt
9. Click "Print Receipt" (optional)
10. Click "New Sale" to reset

### Step 4: Check Dashboard (1 minute)
1. Click "Dashboard" in sidebar
2. Verify:
   - Today's sales shows your sale
   - Low stock alert appears (USB Cable)
   - Recent sales shows your transaction
   - Sales trend updated
   - Top products shows your items

### Step 5: View Sales History
1. Click "Sales" in sidebar
2. See your completed sale in the list
3. Check sale number, date, and amount

## Detailed Feature Testing

### Inventory Management

#### Add Product Testing
✅ Test validation:
- Leave name empty (should show error)
- Enter negative price (should show error)
- Use duplicate SKU (should show error)

✅ Test categories:
- Create products with different categories
- Use category filter dropdown
- Verify only matching products show

✅ Test low stock:
- Create product with stock < threshold
- Check "Low Stock Only" checkbox
- Verify low stock badge appears

#### Edit Product Testing
✅ Click edit icon on any product
✅ Change price and stock quantity
✅ Save and verify changes persist
✅ Try changing SKU to existing one (should error)

#### Delete Product Testing
✅ Click delete icon
✅ Confirm deletion prompt
✅ Verify product removed from list

#### Search Testing
✅ Type product name in search box
✅ Type SKU in search box
✅ Verify instant filtering
✅ Clear search and verify all products return

### POS System

#### Cart Management Testing
✅ Add product to empty cart
✅ Add same product again (quantity increases)
✅ Add different products
✅ Use +/- buttons to adjust quantity
✅ Try to exceed stock (should show alert)
✅ Remove item from cart
✅ Clear entire cart (with confirmation)

#### Payment Testing
✅ **Exact Payment:**
- Total: $50.00
- Paid: $50.00
- Change: $0.00
- Should process successfully

✅ **Overpayment:**
- Total: $50.00
- Paid: $100.00
- Change: $50.00
- Should show change amount

✅ **Underpayment:**
- Total: $50.00
- Paid: $30.00
- Should show error message

✅ **Payment Methods:**
- Test with "Cash" selected
- Test with "Digital" selected
- Verify method saved in sale record

#### Receipt Testing
✅ Complete a sale
✅ Verify receipt shows:
- Sale number (unique)
- Current date/time
- Your name as cashier
- All items with quantities
- Correct total
- Paid amount
- Change amount
✅ Click "Print Receipt" (opens print dialog)
✅ Click "New Sale" (resets to POS screen)

#### Stock Validation Testing
✅ Add product to cart with quantity = stock
✅ Try to add one more (should alert "insufficient stock")
✅ Complete sale
✅ Go back to inventory
✅ Verify stock decreased correctly

### Dashboard

#### Statistics Testing
✅ Make a sale
✅ Refresh dashboard
✅ Verify today's sales increased
✅ Verify monthly sales increased
✅ Check low stock count
✅ Verify net profit calculation

#### Sales Trend Testing
✅ View last 7 days chart
✅ Verify today shows your sale
✅ Previous days show $0 or existing sales
✅ Bar widths reflect relative amounts

#### Top Products Testing
✅ Make sales with different products
✅ Verify ranking by revenue
✅ Top revenue product shows #1
✅ Verify revenue amounts correct

#### Recent Sales Testing
✅ Recent sales list shows latest 5
✅ Click "View All Sales" link
✅ Should navigate to Sales page

#### Low Stock Alert Testing
✅ Yellow alert banner appears when products are low
✅ Shows count of low stock items
✅ Click "View Inventory" button
✅ Should navigate to inventory with filter

### Sales History

#### Sales List Testing
✅ All completed sales appear
✅ Most recent at top
✅ Correct sale numbers
✅ Dates formatted properly
✅ Cashier names shown
✅ Totals displayed correctly
✅ Payment methods shown with icons
✅ Status badges colored correctly

## Edge Cases to Test

### Inventory
- [ ] Create product with 0 stock
- [ ] Create product with very large numbers
- [ ] Create product with special characters in name
- [ ] Edit product while another user is viewing
- [ ] Delete product that's in an active cart (should complete sale first)

### POS
- [ ] Empty cart checkout (should block)
- [ ] Zero payment amount (should block)
- [ ] Add 100 items to cart (should handle gracefully)
- [ ] Complete sale while logged out (should redirect to login)
- [ ] Rapid clicking on "Complete Sale" (should prevent duplicate sales)

### Dashboard
- [ ] View dashboard with no sales (should show $0.00)
- [ ] View dashboard with no products (should show "well stocked")
- [ ] Check stats at midnight (verify date rollover)

## Performance Testing

### Load Time Testing
✅ Dashboard loads < 1 second
✅ Inventory page loads < 1 second
✅ Product search results instant (< 100ms)
✅ Cart updates instant
✅ Sale processing < 2 seconds

### Stress Testing
- [ ] Add 100+ products to inventory
- [ ] Create 50+ sales
- [ ] Search with rapid typing
- [ ] Switch between pages rapidly

## Browser Compatibility

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Mobile Testing

Test on mobile device or responsive mode:
- [ ] Inventory table scrolls horizontally
- [ ] Product modal is usable
- [ ] POS screen is functional
- [ ] Cart items display correctly
- [ ] Dashboard cards stack vertically
- [ ] Hamburger menu works

## Expected Behavior Checklist

### ✅ Success Scenarios
- Products can be created with valid data
- Products can be edited and deleted
- Sales can be completed with sufficient payment
- Inventory automatically updates after sale
- Dashboard reflects real-time data
- All pages are responsive
- No console errors

### ❌ Error Scenarios (Should Handle Gracefully)
- Duplicate SKU shows user-friendly error
- Insufficient stock prevents sale
- Underpayment shows clear message
- Empty cart blocks checkout
- Invalid prices show validation errors
- Network errors show retry option

## Troubleshooting

### Issue: Products not showing in inventory
**Solution:** 
1. Check browser console for errors
2. Verify Supabase connection
3. Check RLS policies in Supabase
4. Ensure user is authenticated

### Issue: Sale not completing
**Solution:**
1. Check if amount paid >= total
2. Verify all products have sufficient stock
3. Check browser console for API errors
4. Confirm cashier_id is set correctly

### Issue: Dashboard shows $0.00
**Solution:**
1. Make at least one sale
2. Refresh the page
3. Check date filters (may be looking at wrong period)
4. Verify API endpoint is accessible

### Issue: Stock not updating after sale
**Solution:**
1. Check API logs for errors
2. Verify products table has correct permissions
3. Ensure sale completed successfully
4. Refresh inventory page

## Test Data Cleanup

To reset for fresh testing:
```sql
-- Delete all sales (cascades to sale_items)
DELETE FROM sales;

-- Reset product stock
UPDATE products SET stock_quantity = 100;

-- Or delete all products and start over
DELETE FROM products;
```

## Success Criteria

Phase 2 testing is successful when:
- ✅ All inventory CRUD operations work
- ✅ POS system completes sales successfully
- ✅ Stock automatically decreases after sale
- ✅ Dashboard shows accurate real-time data
- ✅ Sales history displays all transactions
- ✅ No console errors during normal use
- ✅ Responsive design works on mobile
- ✅ All validation prevents invalid data

---

**Testing Time Estimate:** 15-20 minutes for complete testing
**Quick Smoke Test:** 5 minutes for basic functionality

Happy Testing! 🎉
