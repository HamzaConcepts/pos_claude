# Payment Method Fix - Stock Batches

## Issue Identified
When adding products from initial stock, the payment method selector was causing database constraint violations.

## Root Cause
The database has a CHECK constraint on the `stock_batches` table that only allows two values for `payment_method`:
- `'Cash'`
- `'Digital'`

```sql
payment_method VARCHAR(20) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'Digital'))
```

If the value was sent as:
- `undefined`
- `null`
- Empty string `""`
- Any other value (like `"cash"` lowercase or `"credit"`)

The database would reject the insert with a constraint violation error.

## Solution Implemented

### File: `app/api/stock-batches/route.ts`

**Added two layers of validation:**

1. **Explicit validation** - Check if payment_method is one of the allowed values:
```typescript
if (payment_method && !['Cash', 'Digital'].includes(payment_method)) {
  return NextResponse.json(
    { success: false, error: 'Payment method must be either "Cash" or "Digital"' },
    { status: 400 }
  )
}
```

2. **Sanitization** - Ensure the value is always valid before inserting:
```typescript
const validPaymentMethod = payment_method === 'Digital' ? 'Digital' : 'Cash'
```

This ensures:
- If `'Digital'` is sent → stores `'Digital'`
- If anything else (including undefined, null, 'Cash', etc.) → stores `'Cash'` (default)

3. **Database insert** - Use the validated value:
```typescript
payment_method: validPaymentMethod, // Store payment method (validated)
```

## UI Component Status
The UI component (`components/AddStockModal.tsx`) is already correct:
- Default value: `'Cash'`
- Dropdown options: `'Cash'` and `'Digital'`
- These match the database constraints exactly

## Testing Recommendations

Test the following scenarios:

### Test 1: Normal Cash Payment
1. Add a product with initial stock
2. Leave payment method as "Cash" (default)
3. **Expected**: Stock batch created successfully

### Test 2: Digital Payment
1. Add a product with initial stock
2. Change payment method to "Digital (Bank Transfer)"
3. **Expected**: Stock batch created successfully with payment_method='Digital'

### Test 3: Partial Payment with Cash
1. Add a product with initial stock
2. Cost: Rs. 10,000
3. Quantity: 10
4. Total: Rs. 100,000
5. Amount Paid: Rs. 50,000
6. Payment Method: Cash
7. Add supplier info
8. **Expected**: 
   - Stock batch created
   - Supplier Khaata entry created with remaining Rs. 50,000

### Test 4: Full Payment Digital
1. Add a product with initial stock
2. Cost: Rs. 5,000
3. Quantity: 5
4. Total: Rs. 25,000
5. Amount Paid: Rs. 25,000
6. Payment Method: Digital
7. **Expected**: Stock batch created, no Khaata entry (fully paid)

## Database Schema Verification

The following tables have payment_method fields with the same constraint:
- ✅ `stock_batches` - **FIXED**
- ✅ `sales` - Already has validation in API
- ✅ `expenses` - Uses default 'Cash' with OR operator
- ✅ `supplier_payments` - Has same constraint
- ✅ `partial_payment_history` - Has same constraint
- ✅ `cashier_sales` - Has same constraint

## Related Files
- `app/api/stock-batches/route.ts` - **Modified**
- `components/AddStockModal.tsx` - Already correct
- `database/COMPLETE_SCHEMA.sql` - Reference schema

## Migration Notes
No database migration needed. This is a code-level fix that ensures proper values are always sent to match existing database constraints.

## Error Messages
Users will now see clear error messages if an invalid payment method is somehow sent:
```
Payment method must be either "Cash" or "Digital"
```

Instead of a cryptic database constraint violation error.

---

**Status:** ✅ Fixed
**Date:** January 21, 2026
**Impact:** Low (affects only edge cases where invalid data was sent)
