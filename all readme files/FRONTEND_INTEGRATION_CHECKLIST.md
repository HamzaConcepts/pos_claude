# Frontend Store ID Integration Checklist

This document tracks the remaining frontend pages that need to be updated to include `store_id` filtering for multi-tenant support.

## ✅ COMPLETED

### Backend APIs (Step 6B)
- ✅ `/api/dashboard/stats` - Added store_id parameter and filtering
- ✅ `/api/products` (GET/POST) - Added store_id parameter and filtering
- ✅ `/api/products/import` - Added store_id parameter and filtering
- ✅ `/api/sales` (GET/POST) - Added store_id parameter and filtering
- ✅ `/api/expenses` (GET/POST) - Added store_id parameter and filtering
- ✅ `/api/users` - Added store_id parameter and filtering
- ✅ `/api/join-requests` - Already had store filtering

### Authentication (Step 6A)
- ✅ `app/login/page.tsx` - Verifies store_id before allowing login
- ✅ Session Management - Stores store_id in sessionStorage/localStorage

### User Management (Step 7)
- ✅ `app/dashboard/users/page.tsx` - Join request management UI added
  - Fetches pending join requests
  - Approve/Reject functionality
  - Filters users by store_id

---

## 🔄 PENDING FRONTEND UPDATES

All remaining pages need to be updated to:
1. Import `getStoreId` from `@/lib/supabase`
2. Call `getStoreId()` to retrieve the store ID
3. Pass `store_id` parameter to API calls
4. Handle case where store_id is null (redirect to login)

### 1. Dashboard Page (HIGH PRIORITY)
**File**: `app/dashboard/page.tsx`

**API Calls to Update**:
- `fetch('/api/dashboard/stats')` → `fetch('/api/dashboard/stats?store_id=${storeId}')`

**Implementation Pattern**:
```typescript
import { getStoreId } from '@/lib/supabase'

const fetchStats = async () => {
  const storeId = getStoreId()
  if (!storeId) {
    // Redirect to login or show error
    return
  }
  
  const response = await fetch(`/api/dashboard/stats?store_id=${storeId}`)
  // ... rest of code
}
```

---

### 2. Inventory Page (HIGH PRIORITY)
**File**: `app/dashboard/inventory/page.tsx`

**API Calls to Update**:
- `fetch('/api/products')` → `fetch('/api/products?store_id=${storeId}')`
- `fetch('/api/products/import', { body })` → Include `store_id` in body
- Any product creation/update calls

**Implementation Pattern**:
```typescript
// GET products
const storeId = getStoreId()
fetch(`/api/products?store_id=${storeId}`)

// POST/Import products
fetch('/api/products/import', {
  method: 'POST',
  body: JSON.stringify({ 
    products: csvData,
    store_id: storeId 
  })
})
```

---

### 3. POS Page (HIGH PRIORITY)
**File**: `app/dashboard/pos/page.tsx`

**API Calls to Update**:
- `fetch('/api/products')` → `fetch('/api/products?store_id=${storeId}')`
- `fetch('/api/sales', { body })` → Include `store_id` in body
- Any sales creation calls

**Implementation Pattern**:
```typescript
// GET products for POS
const storeId = getStoreId()
fetch(`/api/products?store_id=${storeId}`)

// POST sale
fetch('/api/sales', {
  method: 'POST',
  body: JSON.stringify({
    ...saleData,
    store_id: storeId
  })
})
```

---

### 4. Expenses Page (HIGH PRIORITY)
**File**: `app/dashboard/expenses/page.tsx`

**API Calls to Update**:
- `fetch('/api/expenses')` → `fetch('/api/expenses?store_id=${storeId}')`
- `fetch('/api/expenses', { body })` → Include `store_id` in body

**Implementation Pattern**:
```typescript
// GET expenses
const storeId = getStoreId()
fetch(`/api/expenses?store_id=${storeId}`)

// POST expense
fetch('/api/expenses', {
  method: 'POST',
  body: JSON.stringify({
    ...expenseData,
    store_id: storeId
  })
})
```

---

### 5. Sales History Page (MEDIUM PRIORITY)
**File**: `app/dashboard/sales/page.tsx`

**API Calls to Update**:
- `fetch('/api/sales')` → `fetch('/api/sales?store_id=${storeId}')`
- Any sales report/filter calls

**Implementation Pattern**:
```typescript
const storeId = getStoreId()
fetch(`/api/sales?store_id=${storeId}`)
```

---

## 🔧 HELPER FUNCTION REFERENCE

The `getStoreId()` helper is already implemented in `lib/supabase.ts`:

```typescript
export function getStoreId(): number | null {
  // Check sessionStorage (for managers)
  const sessionStoreId = sessionStorage.getItem('store_id')
  if (sessionStoreId) {
    return parseInt(sessionStoreId)
  }

  // Check localStorage (for cashiers)
  const userSession = localStorage.getItem('user_session')
  if (userSession) {
    try {
      const session = JSON.parse(userSession)
      if (session.store_id) {
        return session.store_id
      }
    } catch (e) {
      console.error('Error parsing user session:', e)
    }
  }

  return null
}
```

---

## 📋 VALIDATION CHECKLIST

After updating each page, verify:
- [ ] `getStoreId()` is imported
- [ ] Store ID is retrieved at the start of data fetching
- [ ] GET requests include `?store_id=${storeId}` parameter
- [ ] POST/PATCH requests include `store_id` in request body
- [ ] Null store_id case is handled (redirect or error message)
- [ ] No errors in browser console
- [ ] Data is correctly filtered to current store

---

## 🧪 TESTING PLAN

Once all pages are updated:

1. **Create Two Test Stores**
   - Store A (code: TST)
   - Store B (code: DEV)

2. **Test Data Isolation**
   - Login to Store A
   - Add products, sales, expenses
   - Login to Store B
   - Verify Store A data is NOT visible
   - Add different products, sales, expenses
   - Login back to Store A
   - Verify only Store A data is visible

3. **Test Join Requests**
   - Create new manager account
   - Submit join request to Store A
   - Login as Store A manager
   - Approve join request
   - Verify new manager can see Store A data

4. **Test Session Persistence**
   - Login as manager
   - Refresh page
   - Verify store_id persists (sessionStorage)
   - Login as cashier
   - Refresh page
   - Verify store_id persists (localStorage)

---

## 🚀 DEPLOYMENT CHECKLIST

Before deploying:
- [ ] All 5 frontend pages updated
- [ ] All API routes require store_id
- [ ] Multi-tenant testing completed
- [ ] No data leakage between stores verified
- [ ] Join request workflow tested
- [ ] Environment variables set in Vercel
- [ ] Database schema deployed to production Supabase
- [ ] Initial store created with first manager

---

## 📖 IMPLEMENTATION ORDER

Recommended order for updating pages:

1. ✅ **Users Page** (COMPLETED)
2. **Dashboard Page** (Shows stats - critical for testing)
3. **Inventory Page** (Product management - core functionality)
4. **POS Page** (Sales creation - core functionality)
5. **Expenses Page** (Expense tracking)
6. **Sales History Page** (Reporting)

This order ensures critical pages are updated first, allowing incremental testing.
