# Testing the Partial Payment Feature

## Prerequisites

1. **Apply Database Migration**
   - Open Supabase SQL Editor
   - Run the script: `database/add_partial_payment_customers.sql`
   - Verify table exists: `SELECT * FROM partial_payment_customers;`

2. **Start Development Server**
   ```bash
   npm run dev
   ```

## Test Scenarios

### Test 1: Full Payment (No Changes)

**Purpose**: Ensure normal flow still works

**Steps:**
1. Login to POS system
2. Add product(s) to cart (e.g., Total: $50.00)
3. Enter amount paid: $50.00 (or more)
4. Click "Complete Sale"
5. ✅ Should process normally without partial payment prompt
6. ✅ Receipt should show "Paid" status
7. ✅ Sales history shows "Paid" badge (black)

---

### Test 2: Partial Payment - Accept Flow

**Purpose**: Test successful partial payment with customer info

**Steps:**
1. Add product(s) to cart (Total: $100.00)
2. Enter amount paid: $60.00
3. Click "Complete Sale"
4. ✅ Confirmation dialog appears showing:
   - Total: $100.00
   - Paid: $60.00
   - Due: $40.00
5. Click "OK" to proceed
6. ✅ Customer information modal appears
7. Fill in details:
   - Name: "Test Customer"
   - CNIC: "12345-1234567-1"
   - Phone: "0300-1234567"
8. Click "Confirm Sale"
9. ✅ Receipt displays:
   - Payment Status: Partial ⚠️ (in red)
   - Customer information box (red border)
   - Amount Due: $40.00 (instead of Change)
10. Go to Sales page
11. ✅ Sale shows "Partial ⚠️" badge (red)
12. Click to expand row
13. ✅ Customer details visible in red-bordered box

---

### Test 3: Partial Payment - Cancel Flow

**Purpose**: Ensure user can cancel partial payment

**Steps:**
1. Add product(s) to cart (Total: $80.00)
2. Enter amount paid: $30.00
3. Click "Complete Sale"
4. ✅ Confirmation dialog appears
5. Click "Cancel"
6. ✅ Modal closes
7. ✅ Error message: "Insufficient payment..."
8. ✅ Cart remains unchanged
9. User can adjust amount or proceed again

---

### Test 4: Validation - Missing Customer Info

**Purpose**: Test validation for required fields

**Steps:**
1. Add product(s) to cart
2. Enter partial payment amount
3. Accept partial payment prompt
4. In customer modal, try:
   - Leave Name empty → Click Confirm
   - ✅ Alert: "All customer fields are required..."
   - Enter Name, leave CNIC empty → Click Confirm
   - ✅ Alert: "All customer fields are required..."
   - Enter Name and CNIC (less than 13 chars) → Click Confirm
   - ✅ Alert: "Please enter a valid CNIC (13 digits)"
   - Enter all fields with phone < 10 chars → Click Confirm
   - ✅ Alert: "Please enter a valid phone number"

---

### Test 5: Validation - Invalid CNIC/Phone

**Purpose**: Test format validation

**Steps:**
1. Trigger partial payment modal
2. Try invalid formats:
   - CNIC: "123" (too short)
   - ✅ Alert on submit
   - Phone: "123" (too short)
   - ✅ Alert on submit
3. Try valid formats:
   - CNIC: "1234567890123" (13 digits)
   - Phone: "0300123456" (10+ digits)
   - ✅ Should process successfully

---

### Test 6: Receipt Printing

**Purpose**: Verify receipt display and printing

**Steps:**
1. Complete a partial payment sale
2. On receipt screen:
   - ✅ Customer info visible
   - ✅ Amount due shown (not change)
   - ✅ Red warning indicators
3. Click "Print Receipt"
4. ✅ Print preview includes all customer info
5. Click "New Sale"
6. ✅ Returns to POS with empty cart

---

### Test 7: Sales History Filtering

**Purpose**: Test partial payment in filters

**Steps:**
1. Go to Sales page
2. Use "Payment Status" filter
3. Select "Partial"
4. ✅ Shows only partial payment sales
5. ✅ All have red "Partial ⚠️" badges
6. Expand any partial payment sale
7. ✅ Customer information displayed
8. ✅ Amount remaining clearly visible

---

### Test 8: Multiple Partial Payments

**Purpose**: Test multiple partial payment sales

**Steps:**
1. Create 3 partial payment sales with different customers:
   - Customer A: $100 total, $60 paid, $40 due
   - Customer B: $200 total, $150 paid, $50 due
   - Customer C: $80 total, $20 paid, $60 due
2. Go to Sales page
3. ✅ All three show as "Partial"
4. Expand each one
5. ✅ Correct customer info for each
6. ✅ Correct amount remaining for each

---

### Test 9: Mobile Responsive View

**Purpose**: Test on mobile devices/small screens

**Steps:**
1. Resize browser to mobile width (or use mobile device)
2. Navigate to POS page
3. ✅ Partial payment modal fits screen
4. ✅ All input fields accessible
5. Complete partial payment sale
6. Go to Sales page
7. ✅ Partial payment indicator visible on mobile
8. ✅ Expand row shows customer info
9. ✅ All details readable and properly formatted

---

### Test 10: API Verification

**Purpose**: Verify database records

**Steps:**
1. Complete a partial payment sale
2. Note the sale number
3. Open Supabase Dashboard
4. Run query:
   ```sql
   SELECT s.*, ppc.*
   FROM sales s
   LEFT JOIN partial_payment_customers ppc ON s.id = ppc.sale_id
   WHERE s.payment_status = 'Partial'
   ORDER BY s.sale_date DESC
   LIMIT 5;
   ```
5. ✅ Verify:
   - Sale record exists with payment_status = 'Partial'
   - Customer record exists in partial_payment_customers
   - sale_id matches between tables
   - All customer fields populated
   - amount_remaining = total_amount - amount_paid

---

## Expected Issues & Solutions

### Issue 1: Modal doesn't appear
- **Check**: Browser console for JavaScript errors
- **Solution**: Refresh page, clear cache

### Issue 2: Customer info not saving
- **Check**: Database migration ran successfully
- **Solution**: Run `add_partial_payment_customers.sql` again

### Issue 3: Receipt not showing customer info
- **Check**: API response includes partial_payment_customers
- **Solution**: Verify GET /api/sales includes the join

### Issue 4: Validation not working
- **Check**: Browser console for validation errors
- **Solution**: Ensure state updates properly

---

## Success Criteria

✅ All test scenarios pass
✅ No TypeScript errors
✅ No console errors
✅ Database records created correctly
✅ Visual indicators display properly
✅ Mobile responsive works
✅ Validation prevents invalid data
✅ Full payment flow unaffected

---

## After Testing

1. **Push to Production**
   - Commit all changes
   - Run migration on production database
   - Deploy to Vercel

2. **Monitor**
   - Check error logs
   - Verify customer records populating
   - Test with real users

3. **Document**
   - Add to user manual
   - Train staff on partial payment flow
   - Create customer payment tracking procedures
