# Supplier Khaata System Implementation

## Overview
The Supplier Khaata System tracks partial payments made to suppliers when purchasing inventory. When adding products or restocking, users can specify how much they've paid to the supplier. If the payment is less than the total cost, the remaining balance is automatically tracked in the Supplier Khaata.

## Key Features

### 1. **Payment Tracking on Stock Addition**
- When adding new products (AddStockModal) or restocking (RestockModal), users enter the amount paid to supplier
- Real-time calculation of remaining balance
- Visual indicators:
  - ✅ Green box: Full payment made
  - ⚠️ Yellow box: Partial payment - will be tracked in Supplier Khaata
  - ❌ Red box: Amount paid exceeds total (validation error)

### 2. **Automatic Supplier Khaata Creation**
- When `amount_paid < total_amount`, a record is automatically created in `supplier_khaata` table
- Links to the stock batch for full traceability
- Stores supplier information (name, phone) for easy reference

### 3. **Aggregated Supplier View**
- Groups all transactions by supplier
- Shows total amounts owed across all purchases
- Expandable rows to see individual transaction details
- Search functionality by supplier name or phone

### 4. **Payment Management**
- Edit payment amounts for existing records
- Add notes to track payment details
- Delete records when needed
- Real-time calculation of remaining balance

## Database Schema

### supplier_khaata Table
```sql
CREATE TABLE supplier_khaata (
  id SERIAL PRIMARY KEY,
  stock_batch_id INTEGER NOT NULL,
  supplier_id INTEGER NOT NULL,
  supplier_name VARCHAR(100) NOT NULL,
  supplier_phone VARCHAR(20),
  supplier_contact VARCHAR(255),
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  amount_remaining NUMERIC(10, 2) NOT NULL CHECK (amount_remaining >= 0),
  store_id INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_supplier_khaata_stock_batch 
    FOREIGN KEY (stock_batch_id) REFERENCES stock_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_supplier_khaata_supplier 
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  CONSTRAINT fk_supplier_khaata_store 
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);
```

### Indexes
- `idx_supplier_khaata_store_id` - Fast filtering by store
- `idx_supplier_khaata_supplier_id` - Quick lookup by supplier
- `idx_supplier_khaata_stock_batch_id` - Link to stock batches
- `idx_supplier_khaata_supplier_phone` - Search by phone number

## Implementation Files

### Database
- `database/add_supplier_khaata.sql` - Migration script to create table, indexes, triggers, and RLS policies

### API Routes
- `app/api/supplier-khaata/route.ts` - CRUD endpoints for supplier khaata records
  - GET: Fetch all records for a store (with optional supplier filter)
  - POST: Create new khaata record
  - PATCH: Update payment amount and notes
  - DELETE: Remove a record

- `app/api/stock-batches/route.ts` - Updated to handle supplier payments
  - Accepts `amount_paid`, `supplier_name`, `supplier_phone` in POST request
  - Automatically creates supplier_khaata record when payment is partial

### Frontend Components

#### Modals (Updated)
- `components/AddStockModal.tsx`
  - Added `amount_paid` field in step 3
  - Visual payment status indicator
  - Validation to prevent overpayment
  - Passes payment data to stock-batches API

- `components/RestockModal.tsx`
  - Added `amount_paid` field after quantity
  - Real-time total amount display
  - Payment status indicator (full/partial/overpaid)
  - Validation and error handling

#### Pages
- `app/dashboard/supplier-khaata/page.tsx`
  - Displays all supplier khaata records
  - Aggregated view by supplier
  - Expandable transaction details
  - Search functionality
  - Edit payment modal
  - Delete confirmation modal

#### Navigation
- `components/Sidebar.tsx`
  - Added "Supplier Khaata" link with TruckIcon
  - Positioned after "Customer Khaata"

## User Flow

### Adding New Product with Partial Payment
1. Navigate to Inventory → Add Stock
2. Fill in product details (steps 1-2)
3. In step 3:
   - Enter quantity
   - Enter supplier phone (auto-searches existing suppliers)
   - System calculates total: `cost_price × quantity`
   - Enter amount paid to supplier
   - If amount < total, yellow warning shows: "Remaining will be tracked in Supplier Khaata"
4. Submit form
5. Stock batch created + Supplier khaata record auto-created

### Restocking Existing Product
1. Navigate to Inventory → Restock Product
2. Select product
3. Enter pricing and quantity
4. System shows total amount
5. Enter amount paid
6. Visual indicator shows payment status
7. Submit - creates stock batch and supplier khaata if partial payment

### Viewing Supplier Accounts
1. Navigate to Supplier Khaata from sidebar
2. See aggregated list of suppliers with pending payments
3. Click on supplier row to expand
4. View individual transactions with product details
5. Edit payment amounts as needed
6. Track all outstanding balances

### Updating Payment
1. In Supplier Khaata page, expand a supplier
2. Click "Edit" button on a transaction
3. Modal shows:
   - Current total amount
   - Current remaining balance
   - Input to update amount paid
   - Notes field
4. Update amount paid
5. System recalculates remaining balance
6. Save changes

## Business Logic

### Payment Calculation
```typescript
total_amount = cost_price × quantity_purchased
amount_remaining = total_amount - amount_paid

if (amount_remaining > 0) {
  // Create supplier_khaata record
}
```

### Validation Rules
- `amount_paid >= 0` (cannot be negative)
- `amount_paid <= total_amount` (cannot overpay)
- `amount_remaining` is auto-calculated
- Supplier must exist or be created first

### Aggregation Logic
```typescript
// Group by supplier_id
aggregated = {
  total_amount: SUM(all transactions for supplier),
  amount_paid: SUM(all payments made),
  amount_remaining: SUM(all pending amounts),
  transaction_count: COUNT(records)
}
```

## Security (RLS Policies)

All RLS policies ensure users can only access records for their own store:

```sql
-- SELECT: View only your store's records
WHERE store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())

-- INSERT: Create only for your store
WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))

-- UPDATE: Modify only your store's records
USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))

-- DELETE: Remove only your store's records
USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()))
```

## Testing Checklist

- [ ] Run migration: `database/add_supplier_khaata.sql`
- [ ] Test adding new product with full payment (should NOT create khaata record)
- [ ] Test adding new product with partial payment (should create khaata record)
- [ ] Test restocking with partial payment
- [ ] Verify aggregated view groups suppliers correctly
- [ ] Test search functionality (by name and phone)
- [ ] Test edit payment (update amount, add notes)
- [ ] Test delete functionality
- [ ] Verify remaining balance calculations are accurate
- [ ] Test RLS policies (users can only see their store's data)

## Future Enhancements

1. **Payment History**: Track multiple payments per khaata record
2. **Reminders**: Alert when payments are overdue
3. **Export**: Generate supplier account statements (PDF/CSV)
4. **Filters**: Filter by date range, amount owed, supplier
5. **Dashboard Widget**: Show total amount owed to suppliers
6. **SMS Integration**: Send payment reminders to suppliers

## Migration Steps

### 1. Apply Database Migration
```bash
# Run this in Supabase SQL Editor
cat database/add_supplier_khaata.sql
```

### 2. Verify Tables Created
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'supplier_khaata';
```

### 3. Test API Endpoints
```bash
# GET all records
GET /api/supplier-khaata?store_id=1

# POST new record
POST /api/supplier-khaata
{
  "stock_batch_id": 1,
  "supplier_id": 1,
  "supplier_name": "ABC Suppliers",
  "total_amount": 50000,
  "amount_paid": 30000,
  "store_id": 1
}
```

### 4. Test UI Flow
1. Navigate to Inventory → Add Stock
2. Enter product details
3. Enter partial payment
4. Verify record created in Supplier Khaata page

## Support

For issues or questions:
1. Check database migration was applied successfully
2. Verify RLS policies are active
3. Check browser console for API errors
4. Review server logs for backend errors

---

**Implementation Date**: December 7, 2025  
**Version**: 1.0  
**Status**: ✅ Complete
