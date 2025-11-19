# Payment Recorder Tracking - Implementation Guide

## Overview
The payments table now tracks who recorded each payment (manager or cashier) and displays their name in the sales history.

## Database Changes

### Schema Update
The `payments` table has been updated to support both manager and cashier recorders:

```sql
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES sales(id),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
    payment_method VARCHAR(20),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    manager_id UUID,        -- For managers (Supabase Auth UUID)
    cashier_id INTEGER,      -- For cashiers (cashier_accounts.id)
    store_id INTEGER NOT NULL REFERENCES stores(id),
    CHECK ((manager_id IS NOT NULL AND cashier_id IS NULL) OR 
           (manager_id IS NULL AND cashier_id IS NOT NULL))
);
```

**Key Points:**
- `manager_id`: Stores manager UUID (from Supabase Auth)
- `cashier_id`: Stores cashier ID (from cashier_accounts table)
- **Constraint**: Exactly one of these fields must be set (not both, not neither)

### Migration
Run the migration to update existing databases:

```bash
# Connect to your Supabase database and run:
psql -h <your-db-host> -U postgres -d postgres -f database/migrations/add_cashier_id_to_payments.sql
```

Or execute via Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `database/migrations/add_cashier_id_to_payments.sql`
3. Click "Run"

## Code Changes

### Sales API (`/app/api/sales/route.ts`)

#### Payment Creation (POST)
When a sale is completed, a payment record is created:

```typescript
// Create payment record with cashier_id
const { error: paymentError } = await supabaseAdmin
  .from('payments')
  .insert([{
    sale_id: sale.id,
    amount: paidAmount,
    payment_method,
    payment_date: new Date().toISOString(),
    cashier_id: cashier_id,  // Cashier who processed the sale
    store_id: parseInt(store_id),
  }])
```

**Note:** Currently only cashiers process sales. For manager-processed sales, use `manager_id` instead of `cashier_id`.

#### Fetching Payment Recorder Names (GET)
The API now fetches and displays who recorded each payment:

```typescript
// Fetch payments with sales
.select(`
  *,
  sale_items (*),
  partial_payment_customers (*),
  payments (*)
`)

// Fetch cashier and manager names separately
const managerIds = [...new Set(allPayments.map(p => p.manager_id).filter(Boolean))]
const cashierIds = [...new Set(allPayments.map(p => p.cashier_id).filter(Boolean))]

// Query both tables
const managers = await supabaseAdmin.from('managers').select('id, full_name').in('id', managerIds)
const cashiers = await supabaseAdmin.from('cashier_accounts').select('id, full_name').in('id', cashierIds)

// Add recorded_by_name to each payment
payment.recorded_by_name = managerMap.get(payment.manager_id) || cashierMap.get(payment.cashier_id) || 'Unknown'
```

### Sales History Page (`/app/dashboard/sales/page.tsx`)

#### Payment History Display
When a sale is expanded, it now shows a "Payment History" section:

```tsx
{(sale as any).payments && (sale as any).payments.length > 0 && (
  <div className="mb-3">
    <div className="flex items-center gap-2 text-sm font-bold mb-2">
      <DollarSign size={16} />
      Payment History ({(sale as any).payments.length})
    </div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Method</th>
          <th>Recorded By</th>  {/* Shows manager/cashier name */}
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {(sale as any).payments.map((payment: any) => (
          <tr>
            <td>{new Date(payment.payment_date).toLocaleString()}</td>
            <td>{payment.payment_method}</td>
            <td>{payment.recorded_by_name || 'Unknown'}</td>
            <td>${payment.amount.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}
```

## Usage

### Viewing Payment Recorder
1. Go to **Sales** page
2. Click on any sale to expand it
3. Scroll down to see **Payment History** section
4. The "Recorded By" column shows the manager or cashier name

### Data Flow
1. **Sale Created**: Cashier completes a sale via POS
2. **Payment Recorded**: Payment record created with `cashier_id`
3. **Display**: Sales API fetches payment with recorder name
4. **UI**: Payment history shows "Recorded By: [Cashier Name]"

## Future Enhancements

### Manager-Recorded Payments
If managers should be able to record payments (e.g., for adjustments):

```typescript
// In payment creation logic
const isManager = sessionStorage.getItem('user_type') === 'manager'
const paymentData = {
  sale_id: sale.id,
  amount: paidAmount,
  payment_method,
  payment_date: new Date().toISOString(),
  store_id: parseInt(store_id),
}

if (isManager) {
  paymentData.manager_id = sessionStorage.getItem('user_id') // Manager UUID
} else {
  paymentData.cashier_id = cashier_id // Cashier ID
}
```

### Partial Payment Tracking
For customers making multiple payments:
- Each payment creates a separate record in `payments` table
- All payments link to same `sale_id`
- Payment history shows all payments over time
- "Recorded By" tracks who processed each payment

## Testing

### Test Cases
1. **Cashier Sale**: Create sale as cashier → Verify payment shows cashier name
2. **Expanded View**: Expand sale → Verify "Payment History" section appears
3. **Multiple Payments**: Make partial payments → Verify all appear in history
4. **Name Display**: Check that "Recorded By" shows actual cashier name, not ID

### Sample Data Check
```sql
-- View payments with recorder names
SELECT 
  p.id,
  p.sale_id,
  p.amount,
  p.payment_method,
  COALESCE(m.full_name, c.full_name, 'Unknown') as recorded_by_name
FROM payments p
LEFT JOIN managers m ON p.manager_id = m.id
LEFT JOIN cashier_accounts c ON p.cashier_id = c.id
ORDER BY p.payment_date DESC;
```

## Troubleshooting

### Payment Not Showing Recorder Name
- **Check API Response**: Inspect network tab for `recorded_by_name` field
- **Verify Database**: Ensure migration was applied successfully
- **Check IDs**: Verify `cashier_id` or `recorded_by` is set correctly

### "Unknown" Displayed
- **Cashier Not Found**: Check that cashier ID exists in `cashier_accounts` table
- **Manager Not Found**: Check that manager UUID exists in `managers` table
- **Data Type Mismatch**: Ensure cashier IDs are integers, manager IDs are UUIDs

### Constraint Violation
If you get "payments_recorder_check" error:
- Ensure exactly one of `manager_id` or `cashier_id` is set
- Don't set both fields
- Don't leave both fields NULL

## Summary
This implementation provides full payment tracking with recorder identification, supporting both managers and cashiers. All payment history is visible in the sales detail view with clear attribution.
