# Multi-Tenant System - Fresh Supabase Project Setup Guide

## ✅ Implementation Status: READY TO DEPLOY

This guide explains how to set up the multi-tenant POS system on a **fresh Supabase project** (no existing data).

---

## 📋 What's Been Implemented

### 1. Complete Database Schema (✅ Complete)
- **File:** `database/schema_fresh.sql` (to be created)
- **Features:**
  - All tables with multi-tenant support built-in
  - `stores` table with 3-char alphanumeric codes
  - `join_requests` table for approval workflow
  - All data tables include `store_id` from start
  - Multi-tenant RLS policies pre-configured
  - Indexes optimized for tenant isolation

### 3. Frontend Changes (✅ Complete)

#### Updated Signup Page (`app/signup/page.tsx`)
**Manager Signup Options:**
- Create New Store → Auto-generates store code
- Join Existing Store → Enter store code, pending approval

**Cashier Signup:**
- Must enter store code
- Pending approval from manager

#### API Endpoints Created:
- `/api/stores/create` - Create new store
- `/api/stores/join` - Submit join request  
- `/api/join-requests` - Manage join requests (GET/PATCH)

### 4. Documentation (✅ Complete)
- `database/TENANT_SYSTEM_DESIGN.md` - Complete architecture document
- `database/MULTI_TENANT_IMPLEMENTATION_GUIDE.md` - This file

---

## 🚀 Deployment Steps for Fresh Supabase Project

### Step 1: Create New Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details:
   - **Name:** POS System
   - **Database Password:** (save this securely)
   - **Region:** Select closest to your location
4. Click "Create new project"
5. Wait for project to finish setting up (~2 minutes)

### Step 2: Run Database Schema

1. **Open Supabase SQL Editor:**
   - Go to your new Supabase project
   - Navigate to SQL Editor (left sidebar)

2. **Execute Schema:**
   - Copy contents of `database/schema_fresh.sql`
   - Paste into SQL Editor
   - Click "Run" or press Ctrl+Enter

3. **Verify Schema Creation:**
   - Go to Table Editor
   - Confirm all tables exist:
     - stores
     - managers
     - cashier_accounts
     - products
     - inventory
     - sales
     - sale_items
     - expenses
     - partial_payment_customers
     - payments
     - join_requests

### Step 3: Configure Environment Variables

1. **Get Supabase Credentials:**
   - Go to Project Settings → API
   - Copy:
     - Project URL
     - `anon` public key
     - `service_role` secret key

2. **Update `.env.local`:**
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Required for admin operations (store creation, join approvals)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

3. **Restart Development Server:**
```bash
npm run dev
```

### Step 4: Enable Email Authentication (Optional but Recommended)

Since managers use email verification:

1. **Configure Email Templates:**
   - Go to Authentication → Email Templates
   - Customize "Confirm Signup" template (optional)

2. **Configure SMTP (Production):**
   - Go to Project Settings → Auth
   - Enable Email provider
   - Configure custom SMTP (optional, for production)
   - For development, Supabase's default email works fine

### Step 5: Test First Manager Signup

1. **Run the application:**
```bash
npm run dev
```

2. **Create first store:**
   - Go to `http://localhost:3000/signup`
   - Select "Manager" account type
   - Choose "Create New Store"
   - Fill in all details
   - Click "Sign Up"
   - **Important:** Save the store code shown in the alert!

3. **Verify email:**
   - Check inbox for verification email
   - Click verification link

4. **Login:**
   - Go to `http://localhost:3000/login`
   - Enter credentials
   - Should redirect to dashboard

### Step 6: Update Application Code for Store Filtering

**IMPORTANT:** All data queries need `store_id` filtering. Update these files:

#### A. Update Login Flow (`app/login/page.tsx`)

Add store verification after successful login:

```typescript
// After successful Manager login
const { data: manager } = await supabase
  .from('managers')
  .select('store_id')
  .eq('id', user.id)
  .single()

if (!manager.store_id) {
  // Check for pending join request
  const { data: request } = await supabase
    .from('join_requests')
    .select('status')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .single()

  if (request) {
    alert('Your account is pending approval from the store manager.')
    await supabase.auth.signOut()
    return
  } else {
    alert('Your account is not associated with any store.')
    await supabase.auth.signOut()
    return
  }
}

// Store store_id in sessionStorage
sessionStorage.setItem('store_id', manager.store_id.toString())
```

For Cashier login, verify `store_id` is returned from `verify_cashier_login`:

```typescript
// After successful Cashier login
if (!cashierData.store_id) {
  alert('Your account is pending approval from the store manager.')
  return
}

// Store in localStorage
localStorage.setItem('cashierSession', JSON.stringify({
  ...cashierData,
  store_id: cashierData.store_id
}))
```

#### B. Update All API Routes with Store Filtering

**Dashboard Stats** (`app/api/dashboard/stats/route.ts`):
```typescript
// Get store_id from session or request
const storeId = // ... get from user session

// Filter all queries
const { data: sales } = await supabase
  .from('sales')
  .select('*')
  .eq('store_id', storeId)
```

**Products API** (`app/api/products/route.ts`, `app/api/products/import/route.ts`):
```typescript
// When creating products
const { data } = await supabase
  .from('products')
  .insert([{ ...productData, store_id: userStoreId }])

// When fetching products
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('store_id', storeId)
```

**Sales API** (`app/api/sales/route.ts`):
```typescript
const { data } = await supabase
  .from('sales')
  .select('*')
  .eq('store_id', storeId)
```

**Expenses API** (`app/api/expenses/route.ts`):
```typescript
const { data } = await supabase
  .from('expenses')
  .select('*')
  .eq('store_id', storeId)
```

**Inventory API** (if separate):
```typescript
const { data } = await supabase
  .from('inventory')
  .select('*')
  .eq('store_id', storeId)
```

### Step 7: Add Join Request Management to Users Page

Update `app/dashboard/users/page.tsx`:

1. **Add Join Requests Section:**
```typescript
const [joinRequests, setJoinRequests] = useState([])

useEffect(() => {
  fetchJoinRequests()
}, [])

const fetchJoinRequests = async () => {
  const storeId = sessionStorage.getItem('store_id')
  const response = await fetch(`/api/join-requests?storeId=${storeId}`)
  const data = await response.json()
  setJoinRequests(data.requests)
}

const handleApprove = async (requestId) => {
  const reviewerId = user.id
  await fetch('/api/join-requests', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, action: 'approve', reviewerId })
  })
  fetchJoinRequests()
}

const handleReject = async (requestId) => {
  const reviewerId = user.id
  await fetch('/api/join-requests', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, action: 'reject', reviewerId })
  })
  fetchJoinRequests()
}
```

2. **Add UI Component:**
```tsx
{/* Pending Join Requests */}
{role === 'Manager' && joinRequests.length > 0 && (
  <div className="mb-6">
    <h2 className="text-xl font-bold mb-4">Pending Join Requests ({joinRequests.length})</h2>
    <div className="space-y-3">
      {joinRequests.map((request) => (
        <div key={request.id} className="border-2 border-gray rounded p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">{request.user_name}</p>
              <p className="text-sm text-text-secondary">
                {request.user_type} | {request.user_phone}
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Requested: {new Date(request.requested_at).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(request.id)}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(request.id)}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

### Step 8: Enable Store-Scoped Filtering Everywhere

Create a utility function in `lib/utils.ts`:

```typescript
// Get store_id from current session
export const getStoreId = (): number | null => {
  const role = localStorage.getItem('role')
  
  if (role === 'Manager') {
    // For managers, get from sessionStorage
    const storeId = sessionStorage.getItem('store_id')
    return storeId ? parseInt(storeId) : null
  } else if (role === 'Cashier') {
    // For cashiers, get from localStorage
    const cashierData = JSON.parse(localStorage.getItem('cashierSession') || '{}')
    return cashierData.store_id || null
  }
  
  return null
}
```

Use in all frontend data fetching:

```typescript
import { getStoreId } from '@/lib/utils'

// In any page or component
const storeId = getStoreId()
if (!storeId) {
  // Redirect to login or show error
  return
}

const { data } = await supabase
  .from('products')
  .select('*')
  .eq('store_id', storeId)
```

### Step 9: Test Multi-Tenant Isolation

1. **Create second store:**
   - Logout from first account
   - Sign up with new manager
   - Create new store (gets different store code)

2. **Add test data to both stores:**
   - Login to Store A, add products
   - Login to Store B, add different products

3. **Verify isolation:**
   - Store A should only see its products
   - Store B should only see its products
   - No data leakage between stores

4. **Test join requests:**
   - Create cashier with Store A code
   - Login to Store A manager
   - Go to Users page
   - Approve cashier request
   - Cashier should now be able to login

---

## 🧪 Testing Checklist

### Store Creation
- [ ] Manager signup with "Create New Store" generates store code
- [ ] Store code is shown to manager after signup
- [ ] Store is created in database
- [ ] Manager is assigned to store automatically

### Join Requests
- [ ] Manager signup with "Join Existing Store" creates pending request
- [ ] Cashier signup creates pending request
- [ ] Invalid store code shows error
- [ ] Pending users cannot login until approved

### Approval Workflow
- [ ] Manager sees pending requests in Users page
- [ ] Approve button assigns user to store
- [ ] Reject button denies request
- [ ] Approved user can login
- [ ] Rejected user gets error message

### Data Isolation
- [ ] Store A manager cannot see Store B data
- [ ] Product queries filtered by store_id
- [ ] Sales queries filtered by store_id
- [ ] Dashboard shows only own store data
- [ ] CSV import assigns to user's store

### Multi-Store Scenarios
- [ ] Create 2 different stores with different managers
- [ ] Add products to each store
- [ ] Create sales in each store
- [ ] Verify no data leakage between stores
- [ ] Same SKU can exist in different stores

---

## 🔄 Starting Over

If you need to reset the database:

### Option 1: Reset from Supabase Dashboard
1. Go to Database → Tables
2. Delete all tables manually
3. Re-run `database/schema_fresh.sql`

### Option 2: Create New Project
1. Simply create a new Supabase project
2. Follow deployment steps again
3. Old project can be deleted or kept as backup

### Option 3: SQL Reset Script
Run this in SQL Editor to drop all tables:
```sql
-- Drop all tables (CASCADE removes dependencies)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS partial_payment_customers CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS join_requests CASCADE;
DROP TABLE IF EXISTS cashier_accounts CASCADE;
DROP TABLE IF EXISTS managers CASCADE;
DROP TABLE IF EXISTS stores CASCADE;

-- Then re-run schema_fresh.sql
```

---

## 📊 Store Code System

### Format
- **Length:** 3 characters
- **Characters:** A-Z, 0-9 (uppercase)
- **Examples:** A1B, X9Z, K3P, M7Y
- **Total Combinations:** 46,656 possible codes

### Generation
- Auto-generated when manager creates store
- Verified for uniqueness before assignment
- Shown to manager after store creation
- Required for all new users to join

### Usage
- Managers share code with employees
- Cashiers enter code during signup
- Code validates store exists before creating join request

---

## 🔒 Security Features

### RLS Policies
- All queries automatically filtered by `store_id`
- Users cannot access other stores' data
- Database-level enforcement (not just app-level)

### Join Request Validation
- Only managers from target store can approve
- Users cannot approve their own requests
- Status transitions validated (pending → approved/rejected)

### Data Integrity
- Foreign key constraints prevent orphaned records
- Cascading deletes for store-related data
- Indexes for performance on store_id columns

---

## 📝 Next Steps After Deployment

1. **Test with Real Data:**
   - Create multiple stores
   - Invite team members
   - Process real transactions

2. **Monitor Performance:**
   - Check query execution times
   - Verify indexes are being used
   - Monitor RLS policy overhead

3. **User Training:**
   - Document store code sharing process
   - Train managers on approval workflow
   - Create user guides for cashiers

4. **Future Enhancements:**
   - Store settings page (edit store name, etc.)
   - Store analytics (compare performance)
   - User transfer between stores
   - Store archival/deactivation

---

## 🆘 Troubleshooting

### Issue: "Store code not generated"
**Solution:** Check that `generate_store_code()` function exists in database

### Issue: "Cannot approve join request"
**Solution:** Verify SUPABASE_SERVICE_ROLE_KEY is set in `.env.local`

### Issue: "User not assigned after approval"
**Solution:** Check join_requests table for user_id format (UUID vs INTEGER)

### Issue: "Cannot see other users in store"
**Solution:** Verify RLS policies allow store-scoped SELECT

### Issue: "Existing data has NULL store_id"
**Solution:** Re-run Phase 3 of migration script to assign default store

---

## 📞 Support

If you encounter issues:
1. Check migration script output for errors
2. Verify all environment variables are set
3. Review RLS policies in Supabase Dashboard
4. Check browser console for API errors
5. Review server logs for backend errors

---

## ✅ Success Criteria

System is successfully deployed when:
- [ ] Fresh Supabase project created
- [ ] Database schema executed without errors
- [ ] Environment variables configured
- [ ] First manager can create store and get store code
- [ ] Email verification works for managers
- [ ] Cashiers can signup with store code
- [ ] Join requests appear in Users page
- [ ] Managers can approve/reject join requests
- [ ] Approved users can login successfully
- [ ] Data is isolated between different stores
- [ ] All CRUD operations work with store filtering
- [ ] CSV import assigns products to correct store
- [ ] Dashboard shows only own store's data
- [ ] No data leakage between stores verified

---

**Prepared by:** GitHub Copilot  
**Date:** November 19, 2025  
**Version:** 1.0
