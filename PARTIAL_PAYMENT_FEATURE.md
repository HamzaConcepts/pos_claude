# Partial Payment Feature

## Overview

The POS system now supports partial payments with comprehensive customer tracking. When a customer cannot pay the full amount, the system collects their information and tracks the outstanding balance.

## How It Works

### 1. During Sale Process

When the cashier enters an amount that is less than the total:

1. **Confirmation Dialog**: System shows a confirmation prompt with:
   - Total amount
   - Amount paid
   - Amount due
   - Option to proceed with partial payment

2. **Customer Information Modal**: If user confirms, a modal appears requesting:
   - **Customer Name** (required)
   - **Customer CNIC** (required, 13+ digits)
   - **Customer Phone** (required, 10+ digits)

3. **Validation**: System validates all fields before processing

4. **Sale Creation**: Creates sale with:
   - `payment_status = 'Partial'`
   - Customer record in `partial_payment_customers` table
   - Link between sale and customer via `sale_id`

### 2. Database Structure

#### New Table: `partial_payment_customers`

```sql
CREATE TABLE partial_payment_customers (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    customer_name VARCHAR(100) NOT NULL,
    customer_cnic VARCHAR(20),
    customer_phone VARCHAR(20),
    total_amount DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL,
    amount_remaining DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- `sale_id`: Links to the sales table
- `customer_name`: Full name of the customer
- `customer_cnic`: National ID card number (13-15 digits)
- `customer_phone`: Contact number
- `total_amount`: Original sale total
- `amount_paid`: Amount paid at time of sale
- `amount_remaining`: Outstanding balance

### 3. Visual Indicators

#### Receipt Display

For partial payments, the receipt shows:
- Red warning badge: `Payment Status: Partial ⚠️`
- Customer information box (red border):
  - Customer Name
  - CNIC
  - Phone Number
  - Amount Remaining (in red, large text)
- Payment details show "Amount Due" instead of "Change"

#### Sales History

In the sales list:
- Red badge with warning emoji: `Partial ⚠️`
- Expandable row shows customer details in red-bordered box
- Clear visibility of outstanding balance

### 4. API Changes

#### POST /api/sales

**New Request Field:**
```typescript
{
  // ... existing fields
  partial_payment_customer?: {
    customer_name: string
    customer_cnic: string
    customer_phone: string
  }
}
```

**Validation:**
- If `payment_status === 'Partial'`, customer info is required
- All three customer fields must be provided
- CNIC must be at least 13 characters
- Phone must be at least 10 characters

#### GET /api/sales

**Response includes:**
```typescript
{
  // ... existing sale fields
  partial_payment_customers: [{
    id: number
    customer_name: string
    customer_cnic: string
    customer_phone: string
    amount_remaining: number
    // ... other fields
  }]
}
```

### 5. Business Logic

#### Payment Status Calculation

```typescript
const paymentStatus =
  dueAmount <= 0 ? 'Paid' :       // Full payment or overpayment
  paidAmount > 0 ? 'Partial' :    // Some payment made
  'Pending'                        // No payment made
```

#### Customer Record Creation

Only created when:
- `payment_status === 'Partial'`
- Customer information is provided and validated
- Sale is successfully created

## Usage Examples

### Example 1: Partial Payment Flow

**Scenario**: Customer orders $100 worth of items but only has $60

1. Cashier adds items to cart (Total: $100.00)
2. Cashier enters amount paid: $60.00
3. Cashier clicks "Complete Sale"
4. System shows: "Payment is $40.00 short. Would you like to proceed with partial payment?"
5. Cashier clicks OK
6. Modal appears requesting customer information
7. Cashier enters:
   - Name: "John Doe"
   - CNIC: "12345-1234567-1"
   - Phone: "0300-1234567"
8. System processes sale and shows receipt with customer info and $40 due
9. Sale appears in history with red "Partial ⚠️" badge

### Example 2: Full Payment (No Changes)

**Scenario**: Customer pays full amount or more

1. Cashier adds items to cart (Total: $100.00)
2. Cashier enters amount paid: $100.00 (or more)
3. Cashier clicks "Complete Sale"
4. System processes normally without partial payment flow
5. Receipt shows change (if overpaid)
6. Sale marked as "Paid" in history

## Installation for Existing Databases

If you already have the POS system installed:

1. Run the migration script in Supabase SQL Editor:
   ```bash
   database/add_partial_payment_customers.sql
   ```

2. Verify table creation:
   ```sql
   SELECT * FROM partial_payment_customers LIMIT 1;
   ```

## Future Enhancements

Potential additions:
1. **Payment History**: Track additional payments made by customer
2. **Customer Dashboard**: View all customers with outstanding balances
3. **Payment Reminders**: Send SMS/email reminders for outstanding balances
4. **Partial Payment Reports**: Generate reports of all partial payments
5. **Credit Limit**: Set maximum credit per customer
6. **Payment Plans**: Schedule payment installments

## Technical Notes

### Type Definitions

Added to `lib/types.ts`:
```typescript
export interface PartialPaymentCustomer {
  id: number
  sale_id: number
  customer_name: string
  customer_cnic: string | null
  customer_phone: string | null
  total_amount: number
  amount_paid: number
  amount_remaining: number
  created_at: string
  updated_at: string
}
```

### Component Changes

**Files Modified:**
- `app/dashboard/pos/page.tsx`: Added partial payment modal and logic
- `app/dashboard/sales/page.tsx`: Added customer info display in expanded rows
- `app/api/sales/route.ts`: Added partial payment customer handling
- `database/schema.sql`: Added `partial_payment_customers` table
- `lib/types.ts`: Added `PartialPaymentCustomer` interface

### State Management

New state in POS component:
```typescript
const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false)
const [partialPaymentData, setPartialPaymentData] = useState({
  customerName: '',
  customerCnic: '',
  customerPhone: ''
})
```

## Support

For issues or questions about the partial payment feature:
1. Check the migration script ran successfully
2. Verify customer information is being collected
3. Check API responses include `partial_payment_customers` data
4. Ensure validation rules are working (13+ digit CNIC, 10+ digit phone)
