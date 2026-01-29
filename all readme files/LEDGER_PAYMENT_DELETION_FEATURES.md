# Ledger Payment & Deletion Features Implementation Guide
**Date:** December 26, 2025

## Overview

This document describes the new features added to the POS system:

1. **Separate Customer & Supplier Ledger Tabs** - Clean separation of customer and supplier ledgers
2. **Pay Dues Functionality** - Record payments against customer/supplier dues with notes
3. **Sale Deletion (Manager Only)** - Delete sales with automatic stock reversion
4. **Expense Deletion (Manager Only)** - Delete expense records
5. **Mark for Review (Cashier)** - Cashiers can flag sales for manager review

---

## 🗄️ Database Migration

### Step 1: Run the Migration Script

Execute the following SQL script in your Supabase SQL Editor:

```bash
database/add_ledger_and_deletion_features.sql
```

This script will:
- Create `khaata_payments` table for tracking customer dues payments
- Create `supplier_khaata_payments` table for tracking supplier dues payments
- Add `marked_for_review`, `review_reason`, `marked_by_cashier_id`, `marked_at` columns to `sales` table
- Create trigger `revert_sale_deletion()` to automatically restore stock when a sale is deleted
- Set up RLS policies for the new tables

### What the Trigger Does

When a sale is deleted:
1. **Stock is automatically restored** to the original batches (FIFO reverse order)
2. **Product IMEIs are unmarked** as sold and returned to `in_stock` status
3. **Sale items, payments, and partial payment records** are cascade deleted

---

## 📂 New API Endpoints

### 1. Customer Ledger Payments

**Endpoint:** `/api/khaata-payments`

#### GET - Fetch payment history
```typescript
GET /api/khaata-payments?store_id=1&customer_id=5
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "khaata_customer_id": 5,
      "customer_name": "John Doe",
      "customer_phone": "03001234567",
      "payment_amount": 5000.00,
      "payment_method": "Cash",
      "notes": "Partial payment for iPhone",
      "payment_date": "2025-12-26T10:30:00Z",
      "recorded_by": "uuid...", // or cashier_id
      "store_id": 1
    }
  ]
}
```

#### POST - Record a new payment
```typescript
POST /api/khaata-payments
Body: {
  "khaata_customer_id": 5,
  "payment_amount": 5000,
  "payment_method": "Cash", // or "Digital"
  "notes": "Partial payment received",
  "store_id": 1,
  "recorded_by": "uuid...", // Manager UUID
  "cashier_id": null // Or cashier ID if cashier records it
}
```

**Validations:**
- Payment amount must be > 0
- Payment amount cannot exceed remaining balance
- Either `recorded_by` or `cashier_id` must be provided

**Side Effects:**
- Updates `khaata_customers` table: `amount_paid` and `amount_remaining`
- Creates payment record in `khaata_payments` table

---

### 2. Supplier Ledger Payments

**Endpoint:** `/api/supplier-khaata-payments`

#### GET - Fetch payment history
```typescript
GET /api/supplier-khaata-payments?store_id=1&supplier_id=3
```

#### POST - Record a new payment
```typescript
POST /api/supplier-khaata-payments
Body: {
  "supplier_khaata_id": 10,
  "payment_amount": 15000,
  "payment_method": "Cash",
  "notes": "Payment for stock batch #B001",
  "store_id": 1,
  "recorded_by": "uuid...",
  "cashier_id": null
}
```

**Validations:** Same as customer payments

**Side Effects:**
- Updates `supplier_khaata` table: `amount_paid` and `amount_remaining`
- Creates payment record in `supplier_khaata_payments` table

---

### 3. Sale Deletion (Manager Only)

**Endpoint:** `/api/sales/[id]`

#### DELETE - Delete a sale
```typescript
DELETE /api/sales/123?manager_id=uuid...&store_id=1
```

**Authorization:** Only managers can delete sales

**What happens:**
1. ✅ Verifies manager belongs to the store
2. ✅ Fetches sale details
3. ✅ Deletes the sale (trigger handles stock reversion)
4. ✅ Returns success message

Response:
```json
{
  "success": true,
  "message": "Sale deleted successfully. Stock has been restored.",
  "data": {
    "id": 123,
    "sale_number": "SALE-20251226-001"
  }
}
```

**Error Cases:**
- 403: Manager authentication required
- 403: Manager doesn't belong to store
- 404: Sale not found
- 500: Database error

---

### 4. Mark Sale for Review (Cashier Feature)

**Endpoint:** `/api/sales/[id]` (PATCH method)

#### PATCH - Mark for review
```typescript
PATCH /api/sales/123
Body: {
  "action": "mark_for_review",
  "cashier_id": 5,
  "review_reason": "Customer wants to return this item"
}
```

Response:
```json
{
  "success": true,
  "message": "Sale marked for review successfully",
  "data": { /* updated sale */ }
}
```

#### PATCH - Unmark review (Manager)
```typescript
PATCH /api/sales/123
Body: {
  "action": "unmark_review"
}
```

---

### 5. Expense Deletion (Manager Only)

**Endpoint:** `/api/expenses/[id]`

#### DELETE - Delete an expense
```typescript
DELETE /api/expenses/45?manager_id=uuid...&store_id=1
```

**Authorization:** Only managers can delete expenses

Response:
```json
{
  "success": true,
  "message": "Expense deleted successfully",
  "data": {
    "id": 45,
    "description": "Office supplies",
    "amount": 2500.00
  }
}
```

---

## 🎨 Frontend Implementation Status

### Current Ledger Page (`app/dashboard/khaata/page.tsx`)

The existing khaata page already has:
- ✅ Tabbed interface for customers and suppliers (set as `activeTab` state)
- ✅ Search functionality
- ✅ Expandable transaction rows
- ✅ Edit and delete functionality for individual records

### What Needs to be Updated

Now you need to update the frontend to integrate the new features:

#### 1. Add "Pay Dues" Button

In the ledger tables (both customer and supplier), add a "Pay Dues" button in the actions column for each aggregated row:

```tsx
<button
  onClick={() => handlePayDues(customer)} // or supplier
  className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
>
  Pay Dues
</button>
```

#### 2. Create Pay Dues Modal

Add a new modal component that:
- Shows customer/supplier name and current balance
- Has input fields for:
  - Payment amount (with validation against remaining balance)
  - Payment method (Cash/Digital dropdown)
  - Notes (textarea)
- Calls the appropriate API endpoint

#### 3. Sales Page Updates (`app/dashboard/sales/page.tsx`)

**For Managers:**
- Add a "Delete" button in the actions column
- Show confirmation dialog before deletion
- Call `DELETE /api/sales/[id]` with manager_id and store_id

**For Cashiers:**
- Add "Mark for Review" button
- Show modal with textarea for review reason
- Call `PATCH /api/sales/[id]` with action="mark_for_review"

**For Both:**
- Add visual indicator (badge) for sales marked for review
- Display review reason when hovering or in expanded view

#### 4. Expenses Page Updates (`app/dashboard/expenses/page.tsx`)

**For Managers:**
- Add a "Delete" button in the actions column
- Show confirmation dialog before deletion
- Call `DELETE /api/expenses/[id]` with manager_id and store_id

**For Cashiers:**
- Hide delete button (view only)

---

## 🔐 Role-Based Access Control

### Manager Permissions
- ✅ View all ledgers
- ✅ Record payments for customers and suppliers
- ✅ Delete sales (with stock reversion)
- ✅ Delete expenses
- ✅ View and unmark sales marked for review
- ✅ Edit customer/supplier information

### Cashier Permissions
- ✅ View all ledgers
- ✅ Record payments (if implemented in UI)
- ❌ **Cannot delete sales**
- ❌ **Cannot delete expenses**
- ✅ **Can mark sales for review** with reason
- ✅ Edit payment records (existing feature)

---

## 🧪 Testing Checklist

### Database Migration
- [ ] Run migration script successfully
- [ ] Verify new tables created: `khaata_payments`, `supplier_khaata_payments`
- [ ] Verify new columns added to `sales` table
- [ ] Verify trigger `revert_sale_deletion` exists

### Customer Payment Feature
- [ ] Record a payment for a customer
- [ ] Verify `amount_paid` and `amount_remaining` updated correctly
- [ ] Verify payment record created in `khaata_payments`
- [ ] Try to pay more than remaining balance (should fail)

### Supplier Payment Feature
- [ ] Record a payment for a supplier
- [ ] Verify `amount_paid` and `amount_remaining` updated correctly
- [ ] Verify payment record created in `supplier_khaata_payments`

### Sale Deletion (Manager)
- [ ] Manager can delete a sale
- [ ] Stock is restored correctly (check `stock_batches.quantity_remaining`)
- [ ] IMEIs are unmarked (status back to `in_stock`)
- [ ] Sale items are cascade deleted
- [ ] Partial payment records are cascade deleted

### Sale Deletion (Cashier Protection)
- [ ] Cashier sees no delete button on sales page
- [ ] API returns 403 if cashier tries to call DELETE endpoint

### Mark for Review Feature
- [ ] Cashier can mark a sale for review
- [ ] Review reason is saved
- [ ] Manager can see the marked sales
- [ ] Manager can unmark after reviewing

### Expense Deletion (Manager)
- [ ] Manager can delete an expense
- [ ] Expense is removed from database

### Expense Deletion (Cashier Protection)
- [ ] Cashier sees no delete button on expenses page
- [ ] API returns 403 if cashier tries to call DELETE endpoint

---

## 📝 Next Steps

1. **Run the database migration** in Supabase SQL Editor
2. **Update the frontend** to add the Pay Dues buttons and modals
3. **Update Sales page** to add delete button for managers and mark for review for cashiers
4. **Update Expenses page** to add delete button for managers only
5. **Test thoroughly** with both manager and cashier accounts
6. **Deploy** to production when all tests pass

---

## 🚨 Important Notes

### Stock Reversion Logic

The trigger `revert_sale_deletion()` attempts to restore stock in **reverse FIFO order** (most recent batches first). This may not perfectly restore the exact original state if:
- Multiple sales have occurred since
- Batches have been modified or deleted

However, it ensures stock quantities are accurately restored and available for future sales.

### Payment Validation

The API enforces that:
- Payment amounts are positive
- Payments don't exceed remaining balance
- Either manager or cashier is recorded (but not both)

### Cascade Deletions

When a sale is deleted:
- `sale_items` → Cascade deleted
- `payments` → Cascade deleted
- `partial_payment_customers` → Cascade deleted
- Stock → Restored via trigger

---

## 📞 Support

If you encounter any issues during implementation:
1. Check Supabase logs for SQL errors
2. Review browser console for frontend errors
3. Verify API responses using browser dev tools
4. Ensure all required parameters are being passed

---

## Summary

This implementation adds powerful management features while maintaining strict role-based access control. Managers have full control to delete incorrect entries while preserving data integrity through automatic stock reversion. Cashiers can flag problematic sales for manager review without the ability to delete data themselves.

The payment tracking system provides a complete audit trail of all dues payments for both customers and suppliers, with notes for record-keeping.
