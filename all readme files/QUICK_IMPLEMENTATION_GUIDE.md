# Quick Implementation Guide - Ledger & Deletion Features

## 🚀 Quick Start (5 Steps)

### Step 1: Run Database Migration (2 minutes)

1. Open Supabase Dashboard → SQL Editor
2. Copy content from `database/add_ledger_and_deletion_features.sql`
3. Paste and run the script
4. Verify successful execution (no errors)

### Step 2: Verify API Routes (Already Created ✅)

These files have been created for you:
- ✅ `app/api/khaata-payments/route.ts` - Customer payment API
- ✅ `app/api/supplier-khaata-payments/route.ts` - Supplier payment API
- ✅ `app/api/sales/[id]/route.ts` - DELETE & PATCH methods added
- ✅ `app/api/expenses/[id]/route.ts` - DELETE method added

### Step 3: Test Backend APIs (5 minutes)

Use this test checklist to verify APIs work before updating UI:

```bash
# Test Customer Payment (use Postman or curl)
POST http://localhost:3000/api/khaata-payments
{
  "khaata_customer_id": 1,
  "payment_amount": 1000,
  "payment_method": "Cash",
  "notes": "Test payment",
  "store_id": 1,
  "recorded_by": "YOUR_MANAGER_UUID"
}

# Test Sale Deletion (Manager only)
DELETE http://localhost:3000/api/sales/1?manager_id=YOUR_MANAGER_UUID&store_id=1

# Test Mark for Review (Cashier)
PATCH http://localhost:3000/api/sales/1
{
  "action": "mark_for_review",
  "cashier_id": 1,
  "review_reason": "Customer wants refund"
}

# Test Expense Deletion (Manager only)
DELETE http://localhost:3000/api/expenses/1?manager_id=YOUR_MANAGER_UUID&store_id=1
```

### Step 4: Get Current User Context

First, you need helper functions to check user roles. Add this to `lib/supabase.ts` if not already present:

```typescript
// Check if current user is a manager
export const isManager = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser()
  return !!user // If user exists from auth, they're a manager
}

// Get manager ID
export const getManagerId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || null
}

// Check if current session is cashier
export const isCashier = (): boolean => {
  const session = localStorage.getItem('user_session')
  return !!session
}

// Get cashier ID
export const getCashierId = (): number | null => {
  const session = localStorage.getItem('user_session')
  if (session) {
    const parsed = JSON.parse(session)
    return parsed.id || null
  }
  return null
}
```

### Step 5: Update Frontend Pages

Now update the following pages with the new features:

---

## 📄 Page-by-Page Updates

### A. Khaata/Ledger Page (`app/dashboard/khaata/page.tsx`)

**What's Already There:**
- ✅ Tabbed interface (customers/suppliers)
- ✅ Aggregated views by customer/supplier
- ✅ Expandable transaction details

**What to Add:**

1. **Import user helpers**
```typescript
import { getManagerId, getCashierId, isManager, isCashier } from '@/lib/supabase'
```

2. **Add state for Pay Dues modal**
```typescript
const [showPayDuesModal, setShowPayDuesModal] = useState(false)
const [selectedForPayment, setSelectedForPayment] = useState<any>(null)
const [paymentFormData, setPaymentFormData] = useState({
  payment_amount: '',
  payment_method: 'Cash',
  notes: ''
})
```

3. **Add "Pay Dues" button to aggregated customer row** (around line 600)

Find the customer table row and add a new action button:

```typescript
// In the customer table's action column
<button
  onClick={() => {
    setSelectedForPayment({
      type: 'customer',
      id: customer.transactions[0].id, // Use first transaction's ID
      name: customer.customer_name,
      phone: customer.customer_phone,
      remaining: customer.amount_remaining
    })
    setShowPayDuesModal(true)
  }}
  className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
  disabled={customer.amount_remaining <= 0}
>
  Pay Dues
</button>
```

4. **Add "Pay Dues" button to aggregated supplier row** (around line 750)

Similar to customer, add to supplier table's action column.

5. **Add Pay Dues Modal** (before closing return)

```typescript
{/* Pay Dues Modal */}
{showPayDuesModal && selectedForPayment && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded border border-gray-200 max-w-md w-full p-5">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Pay Dues - {selectedForPayment.name}
      </h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
        <p className="text-sm text-gray-900">
          <strong>Current Balance:</strong> Rs. {selectedForPayment.remaining.toLocaleString()}
        </p>
      </div>

      <div className="space-y-4 mb-5">
        <div>
          <label className="block mb-1 font-medium text-xs text-gray-700">
            Payment Amount <span className="text-red-600">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={selectedForPayment.remaining}
            value={paymentFormData.payment_amount}
            onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_amount: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
            placeholder="Enter amount"
          />
          {paymentFormData.payment_amount && (
            <p className="text-sm text-gray-600 mt-1">
              New Balance: Rs. {(selectedForPayment.remaining - parseFloat(paymentFormData.payment_amount || '0')).toLocaleString()}
            </p>
          )}
        </div>

        <div>
          <label className="block mb-1 font-medium text-xs text-gray-700">
            Payment Method
          </label>
          <select
            value={paymentFormData.payment_method}
            onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
          >
            <option value="Cash">Cash</option>
            <option value="Digital">Digital</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium text-xs text-gray-700">
            Notes
          </label>
          <textarea
            value={paymentFormData.notes}
            onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-cyan-600"
            placeholder="Add any notes about this payment..."
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => {
            setShowPayDuesModal(false)
            setSelectedForPayment(null)
            setPaymentFormData({ payment_amount: '', payment_method: 'Cash', notes: '' })
            setError('')
          }}
          className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handlePayDues}
          disabled={!paymentFormData.payment_amount || parseFloat(paymentFormData.payment_amount) <= 0}
          className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Record Payment
        </button>
      </div>
    </div>
  </div>
)}
```

6. **Add handlePayDues function**

```typescript
const handlePayDues = async () => {
  if (!selectedForPayment) return

  try {
    setError('')
    const amount = parseFloat(paymentFormData.payment_amount)
    
    if (amount <= 0) {
      setError('Payment amount must be greater than 0')
      return
    }
    
    if (amount > selectedForPayment.remaining) {
      setError('Payment amount cannot exceed remaining balance')
      return
    }

    const storeId = getStoreId()
    const managerId = await getManagerId()
    const cashierId = getCashierId()

    const endpoint = selectedForPayment.type === 'customer' 
      ? '/api/khaata-payments'
      : '/api/supplier-khaata-payments'

    const payload = {
      [selectedForPayment.type === 'customer' ? 'khaata_customer_id' : 'supplier_khaata_id']: selectedForPayment.id,
      payment_amount: amount,
      payment_method: paymentFormData.payment_method,
      notes: paymentFormData.notes.trim() || null,
      store_id: storeId,
      recorded_by: managerId,
      cashier_id: cashierId
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const result = await response.json()

    if (result.success) {
      setShowPayDuesModal(false)
      setSelectedForPayment(null)
      setPaymentFormData({ payment_amount: '', payment_method: 'Cash', notes: '' })
      
      // Refresh the appropriate list
      if (selectedForPayment.type === 'customer') {
        fetchCustomers()
      } else {
        fetchSuppliers()
      }
    } else {
      setError(result.error || 'Failed to record payment')
    }
  } catch (err) {
    setError('Failed to record payment')
  }
}
```

---

### B. Sales Page (`app/dashboard/sales/page.tsx`)

**What to Add:**

1. **Import helpers and add state**
```typescript
import { getManagerId, getCashierId, isManager as checkIsManager } from '@/lib/supabase'

const [isManagerUser, setIsManagerUser] = useState(false)
const [showMarkReviewModal, setShowMarkReviewModal] = useState(false)
const [selectedSaleForReview, setSelectedSaleForReview] = useState<any>(null)
const [reviewReason, setReviewReason] = useState('')
```

2. **Check user role on mount**
```typescript
useEffect(() => {
  checkUserRole()
}, [])

const checkUserRole = async () => {
  const isManager = await checkIsManager()
  setIsManagerUser(isManager)
}
```

3. **Add action buttons in sales table** (find the table row, add to actions column)

```typescript
<div className="flex gap-2">
  {/* Existing edit button */}
  
  {/* Mark for Review (Cashier only) */}
  {!isManagerUser && !sale.marked_for_review && (
    <button
      onClick={() => {
        setSelectedSaleForReview(sale)
        setShowMarkReviewModal(true)
      }}
      className="p-1.5 hover:bg-yellow-100 rounded transition-colors text-yellow-600"
      title="Mark for Review"
    >
      <Flag size={16} />
    </button>
  )}
  
  {/* Delete (Manager only) */}
  {isManagerUser && (
    <button
      onClick={() => handleDeleteSale(sale.id)}
      className="p-1.5 hover:bg-red-100 rounded transition-colors text-red-600"
      title="Delete Sale"
    >
      <Trash2 size={16} />
    </button>
  )}
</div>

{/* Show review badge if marked */}
{sale.marked_for_review && (
  <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
    🚩 Marked for Review
  </span>
)}
```

4. **Add delete handler**
```typescript
const handleDeleteSale = async (saleId: number) => {
  if (!confirm('Are you sure you want to delete this sale? Stock will be restored.')) return

  try {
    const managerId = await getManagerId()
    const storeId = getStoreId()
    
    const response = await fetch(`/api/sales/${saleId}?manager_id=${managerId}&store_id=${storeId}`, {
      method: 'DELETE'
    })

    const result = await response.json()

    if (result.success) {
      alert('Sale deleted successfully. Stock has been restored.')
      fetchSales()
    } else {
      alert('Error: ' + result.error)
    }
  } catch (err) {
    alert('Failed to delete sale')
  }
}
```

5. **Add mark for review modal and handler**
```typescript
const handleMarkForReview = async () => {
  if (!selectedSaleForReview || !reviewReason.trim()) return

  try {
    const cashierId = getCashierId()
    
    const response = await fetch(`/api/sales/${selectedSaleForReview.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mark_for_review',
        cashier_id: cashierId,
        review_reason: reviewReason.trim()
      })
    })

    const result = await response.json()

    if (result.success) {
      setShowMarkReviewModal(false)
      setSelectedSaleForReview(null)
      setReviewReason('')
      fetchSales()
    } else {
      alert('Error: ' + result.error)
    }
  } catch (err) {
    alert('Failed to mark sale for review')
  }
}

// Add modal JSX (similar to Pay Dues modal structure)
{showMarkReviewModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    {/* Modal content with textarea for review_reason */}
  </div>
)}
```

---

### C. Expenses Page (`app/dashboard/expenses/page.tsx`)

**What to Add:**

1. **Import and check role**
```typescript
import { getManagerId, isManager as checkIsManager } from '@/lib/supabase'

const [isManagerUser, setIsManagerUser] = useState(false)

useEffect(() => {
  checkUserRole()
}, [])

const checkUserRole = async () => {
  const isManager = await checkIsManager()
  setIsManagerUser(isManager)
}
```

2. **Add delete button (manager only)**
```typescript
{isManagerUser && (
  <button
    onClick={() => handleDeleteExpense(expense.id)}
    className="p-1.5 hover:bg-red-100 rounded transition-colors text-red-600"
    title="Delete Expense"
  >
    <Trash2 size={16} />
  </button>
)}
```

3. **Add delete handler**
```typescript
const handleDeleteExpense = async (expenseId: number) => {
  if (!confirm('Are you sure you want to delete this expense?')) return

  try {
    const managerId = await getManagerId()
    const storeId = getStoreId()
    
    const response = await fetch(`/api/expenses/${expenseId}?manager_id=${managerId}&store_id=${storeId}`, {
      method: 'DELETE'
    })

    const result = await response.json()

    if (result.success) {
      alert('Expense deleted successfully')
      fetchExpenses()
    } else {
      alert('Error: ' + result.error)
    }
  } catch (err) {
    alert('Failed to delete expense')
  }
}
```

---

## ✅ Testing Checklist

After implementing frontend changes:

### Test as Manager:
- [ ] Can see "Pay Dues" button on ledgers
- [ ] Can record customer payment
- [ ] Can record supplier payment
- [ ] Can see delete button on sales
- [ ] Can delete a sale
- [ ] Verify stock is restored after deletion
- [ ] Can see delete button on expenses
- [ ] Can delete an expense
- [ ] Can see sales marked for review
- [ ] Can unmark reviewed sales

### Test as Cashier:
- [ ] Can see "Pay Dues" button on ledgers
- [ ] Can record payments (if UI allows)
- [ ] **Cannot** see delete button on sales
- [ ] **Cannot** see delete button on expenses
- [ ] Can see "Mark for Review" button on sales
- [ ] Can mark a sale for review with reason
- [ ] Marked sale shows flag/badge

---

## 🎯 Summary

**Backend:** ✅ Complete (APIs ready)  
**Database:** ⚠️ Needs migration  
**Frontend:** ⚠️ Needs updates (follow steps above)

**Time Estimate:** 2-3 hours to fully implement and test
