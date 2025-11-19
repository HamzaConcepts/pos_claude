# Multi-Tenant Store System - Design Document

## Overview
This document outlines the complete multi-tenant implementation for the POS system, allowing multiple stores to use the same database with complete data isolation.

## Store Code System

### Store Code Format
- **Length:** 3 characters
- **Characters:** Alphanumeric (A-Z, 0-9)
- **Examples:** A1B, X9Z, K3P, M7Y
- **Uniqueness:** Each code is unique across all stores
- **Generation:** Auto-generated when manager creates new store

### Code Generator Algorithm
```sql
-- Function to generate random 3-character alphanumeric code
-- Ensures uniqueness by checking against existing codes
CREATE OR REPLACE FUNCTION generate_store_code()
RETURNS VARCHAR(3) AS $$
DECLARE
    code VARCHAR(3);
    chars VARCHAR(36) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    is_unique BOOLEAN := FALSE;
BEGIN
    WHILE NOT is_unique LOOP
        code := '';
        -- Generate 3 random characters
        FOR i IN 1..3 LOOP
            code := code || substr(chars, floor(random() * 36 + 1)::integer, 1);
        END LOOP;
        
        -- Check if code already exists
        SELECT NOT EXISTS (SELECT 1 FROM stores WHERE store_code = code) INTO is_unique;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;
```

## Database Schema Changes

### New Tables

#### 1. stores
```sql
CREATE TABLE stores (
    id SERIAL PRIMARY KEY,
    store_code VARCHAR(3) UNIQUE NOT NULL,
    store_name VARCHAR(100) NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
```

#### 2. join_requests
```sql
CREATE TABLE join_requests (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- Can be UUID (manager) or INTEGER as TEXT (cashier)
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('Manager', 'Cashier')),
    user_name VARCHAR(100) NOT NULL,
    user_phone VARCHAR(11) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP,
    notes TEXT
);
```

### Modified Tables (Add store_id)

All data tables will have `store_id` added:
- managers
- cashier_accounts
- products
- inventory
- sales
- expenses
- partial_payment_customers
- payments

```sql
-- Example for managers table
ALTER TABLE managers ADD COLUMN store_id INTEGER REFERENCES stores(id);

-- Make store_id NOT NULL after data migration
ALTER TABLE managers ALTER COLUMN store_id SET NOT NULL;

-- Add index for performance
CREATE INDEX idx_managers_store_id ON managers(store_id);
```

## User Workflows

### Manager Signup Flow

1. **Account Creation:**
   - Manager enters: Store Name, Manager Name, Phone, Email, Password
   - Choice: "Create New Store" OR "Join Existing Store"

2. **Option A: Create New Store**
   - System generates unique 3-char store code
   - Creates store record with manager as creator
   - Creates manager account with store_id
   - Shows store code to manager (save for cashiers)
   - Manager can immediately login

3. **Option B: Join Existing Store**
   - Manager enters store code
   - System validates code exists
   - Creates join request with status 'pending'
   - Creates manager account (without store access yet)
   - Manager receives "Pending Approval" message
   - Cannot access system until store owner approves

### Cashier Signup Flow

1. **Account Creation:**
   - Cashier enters: Name, Phone, Password
   - Required: Store Code (3 characters)

2. **Join Request:**
   - System validates store code exists
   - Creates cashier account
   - Creates join request with status 'pending'
   - Cashier receives "Pending Approval" message
   - Cannot login until manager approves

### Login Flow Changes

1. **Authentication:**
   - User enters Name/Phone + Password
   - System authenticates credentials

2. **Store Verification:**
   - Check if user has store_id assigned
   - If no store_id: Check for pending join request
   - If pending: Show "Account pending approval" message
   - If rejected: Show "Access denied" message
   - If approved but no store_id: Data sync issue

3. **Session Setup:**
   - Load store_id into session
   - All subsequent queries filter by store_id
   - User sees only their store's data

## Join Request Management

### Manager's Users Page

**Pending Requests Section:**
```
┌─────────────────────────────────────────────────┐
│ Pending Join Requests (3)                       │
├─────────────────────────────────────────────────┤
│ Name: John Doe                                  │
│ Type: Cashier | Phone: 03001234567              │
│ Requested: 2 hours ago                          │
│ [Approve] [Reject]                              │
├─────────────────────────────────────────────────┤
│ Name: Jane Smith                                │
│ Type: Manager | Phone: 03009876543              │
│ Requested: 1 day ago                            │
│ [Approve] [Reject]                              │
└─────────────────────────────────────────────────┘
```

**Current Users Section:**
```
┌─────────────────────────────────────────────────┐
│ Store Users (5)                                 │
├─────────────────────────────────────────────────┤
│ Ahmad Khan (Manager)                            │
│ Phone: 03001111111 | Joined: Jan 15, 2025       │
│ [Remove]                                        │
├─────────────────────────────────────────────────┤
│ Sara Ali (Cashier)                              │
│ Phone: 03002222222 | Joined: Jan 20, 2025       │
│ [Remove]                                        │
└─────────────────────────────────────────────────┘
```

### Approval Actions

**Approve:**
```sql
-- 1. Update join request status
UPDATE join_requests 
SET status = 'approved', 
    reviewed_by = {manager_id}, 
    reviewed_at = NOW()
WHERE id = {request_id};

-- 2. Assign store to user
UPDATE managers SET store_id = {store_id} 
WHERE id = {user_id}; -- For managers

UPDATE cashier_accounts SET store_id = {store_id} 
WHERE id = {user_id}; -- For cashiers
```

**Reject:**
```sql
UPDATE join_requests 
SET status = 'rejected', 
    reviewed_by = {manager_id}, 
    reviewed_at = NOW()
WHERE id = {request_id};
```

**Remove User:**
```sql
-- Set store_id to NULL and deactivate
UPDATE managers 
SET store_id = NULL, is_active = FALSE 
WHERE id = {user_id} AND store_id = {current_store_id};

UPDATE cashier_accounts 
SET store_id = NULL, is_active = FALSE 
WHERE id = {user_id} AND store_id = {current_store_id};
```

## Data Isolation via RLS Policies

### Pattern for All Data Tables

```sql
-- Helper function to get user's store_id
CREATE OR REPLACE FUNCTION get_user_store_id()
RETURNS INTEGER AS $$
DECLARE
    user_store_id INTEGER;
BEGIN
    -- Try to get from managers table (Supabase Auth)
    SELECT store_id INTO user_store_id 
    FROM managers 
    WHERE id = auth.uid();
    
    IF user_store_id IS NOT NULL THEN
        RETURN user_store_id;
    END IF;
    
    -- For cashiers, we'll pass store_id via app_metadata or claim
    -- This requires setting custom claim during cashier login
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Example RLS Policy (Products)

```sql
-- View only products from user's store
CREATE POLICY "Users can view own store products" ON products
    FOR SELECT 
    USING (store_id = get_user_store_id());

-- Insert products only for user's store
CREATE POLICY "Users can insert products to own store" ON products
    FOR INSERT 
    WITH CHECK (store_id = get_user_store_id());

-- Update only own store products
CREATE POLICY "Users can update own store products" ON products
    FOR UPDATE 
    USING (store_id = get_user_store_id());

-- Delete only own store products (soft delete preferred)
CREATE POLICY "Users can delete own store products" ON products
    FOR DELETE 
    USING (store_id = get_user_store_id());
```

## API Changes

### All Data Queries Must Include Store Filter

**Before (No Isolation):**
```typescript
const { data: products } = await supabase
    .from('products')
    .select('*');
```

**After (With Isolation):**
```typescript
// Get user's store_id from session
const storeId = session.user.app_metadata.store_id;

const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId);
```

### Session Management

**Manager Session (Supabase Auth):**
```typescript
{
    user: {
        id: "uuid-here",
        email: "manager@email.com",
        app_metadata: {
            store_id: 1,
            role: "Manager"
        }
    }
}
```

**Cashier Session (localStorage):**
```typescript
{
    user: {
        id: 123,
        full_name: "Cashier Name",
        phone_number: "03001234567",
        store_id: 1,
        role: "Cashier"
    }
}
```

## Migration Strategy

### Phase 1: Add New Tables
1. Create stores table
2. Create join_requests table
3. Add store code generator function

### Phase 2: Migrate Existing Data
1. Create default store from first manager's store_name
2. Assign all existing managers to default store
3. Assign all existing cashiers to default store
4. Assign all existing data (products, sales, etc.) to default store

### Phase 3: Add Foreign Keys
1. Add store_id columns to all tables
2. Update all records with default store_id
3. Make store_id NOT NULL
4. Add foreign key constraints
5. Add indexes

### Phase 4: Update RLS Policies
1. Drop existing policies
2. Create new store-scoped policies
3. Test data isolation thoroughly

### Phase 5: Update Application Code
1. Modify signup flows
2. Modify login flows
3. Add join request management UI
4. Update all data queries with store filters
5. Test all features with multiple stores

## Security Considerations

1. **Data Leakage Prevention:**
   - RLS policies enforce store isolation at database level
   - Application layer adds additional validation
   - All queries must include store_id filter

2. **Join Request Validation:**
   - Only pending requests can be approved/rejected
   - Only managers from the target store can approve
   - Users can't approve their own requests

3. **User Removal:**
   - Soft delete (set is_active = FALSE)
   - Preserve historical data attribution
   - User can join different store later

4. **Store Code Security:**
   - Codes are not sequential (random)
   - 3 characters = 46,656 possible combinations
   - Sufficient for small-medium business use

## Testing Checklist

- [ ] Create new store (manager signup)
- [ ] Join existing store (manager signup)
- [ ] Cashier signup with store code
- [ ] Approve join request (manager)
- [ ] Reject join request (manager)
- [ ] Remove user from store (manager)
- [ ] Login with approved account
- [ ] Login attempt with pending account (should fail)
- [ ] Data isolation: Store A cannot see Store B data
- [ ] Product CRUD operations (store-scoped)
- [ ] Sales creation (store-scoped)
- [ ] Expenses tracking (store-scoped)
- [ ] Dashboard stats (store-scoped)
- [ ] CSV import (assigns to user's store)
- [ ] Multiple stores with same product SKU (allowed)
- [ ] Manager transfers between stores
