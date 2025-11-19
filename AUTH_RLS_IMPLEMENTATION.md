# Authentication & RLS Implementation Summary

## Overview
This document explains the complete rewrite of login and signup logic to properly handle Row Level Security (RLS) policies in the multi-tenant POS system.

## The RLS Problem

### What Was Happening
1. **RLS Policies Block Unauthenticated Access**: All tables have RLS enabled with policies that check `auth.uid()`
2. **Signup Flow Issue**: During signup, we tried to insert into `managers` or `cashier_accounts` tables, but RLS blocked these operations because no auth session existed yet
3. **Login Query Issue**: When logging in, we tried to query the `managers` table to look up email by name/phone, but RLS blocked this query because no auth session existed yet

### RLS Policies That Were Blocking Us

```sql
-- Managers table policy
CREATE POLICY "Anyone can create manager account" ON managers
    FOR INSERT 
    WITH CHECK (true);  -- This allows insert, but...

CREATE POLICY "Managers can view users in their store" ON managers
    FOR SELECT 
    USING (store_id = get_user_store_id() OR auth.uid() = id);
    -- This blocks SELECT if auth.uid() is NULL
```

## Solution Architecture

### 1. Use Admin Client for Initial Operations
Created dedicated API endpoints that use the **Service Role Key** (admin client) to bypass RLS:

- `/api/auth/signup-manager` - Create manager accounts
- `/api/auth/signup-cashier` - Create cashier accounts
- `/api/auth/lookup-manager` - Look up manager email by name/phone

### 2. Auth Flow Sequence

#### Manager Signup (Create Store)
1. Frontend calls `/api/auth/signup-manager` with action='create'
2. API uses admin client to:
   - Create Supabase Auth user
   - Generate store code
   - Create store record
   - Create manager record with store_id
3. Email confirmation sent
4. User can login after confirming email

#### Manager Signup (Join Store)
1. Frontend calls `/api/auth/signup-manager` with action='join'
2. API uses admin client to:
   - Verify store code exists
   - Create Supabase Auth user
   - Create manager record WITHOUT store_id
   - Create pending join request
3. User waits for approval
4. When approved, manager.store_id is set
5. User can login after email confirmation

#### Cashier Signup
1. Frontend calls `/api/auth/signup-cashier`
2. API uses admin client to:
   - Verify store code exists
   - Create cashier record WITHOUT store_id
   - Create pending join request (password hashed by DB trigger)
3. User waits for approval
4. When approved, cashier.store_id is set
5. User can login

#### Manager Login
1. User enters email/name/phone + password
2. If not email format, frontend calls `/api/auth/lookup-manager` to get email
   - API uses admin client to bypass RLS and query managers table
3. Frontend uses Supabase Auth to sign in with email
4. Auth session established (auth.uid() now set)
5. Wait 500ms for session to propagate
6. Now query managers table with regular client (RLS allows because auth.uid() is set)
7. Store store_id in sessionStorage
8. Redirect to dashboard

#### Cashier Login
1. User enters name/phone + password
2. Frontend calls `verify_cashier_login()` database function
   - Function is SECURITY DEFINER, bypasses RLS
3. If successful, store session in localStorage
4. Redirect to POS

## Key Files Changed

### New API Endpoints
1. **`/app/api/auth/signup-manager/route.ts`**
   - Handles manager signup for both create and join actions
   - Uses admin client to bypass RLS
   - Creates auth user, store, and manager records
   - Handles rollback on errors

2. **`/app/api/auth/signup-cashier/route.ts`**
   - Handles cashier signup
   - Uses admin client to bypass RLS
   - Creates cashier record and join request

3. **`/app/api/auth/lookup-manager/route.ts`**
   - Looks up manager email by name or phone
   - Uses admin client to bypass RLS
   - Required for login when user doesn't enter email

### Updated Files
1. **`/app/login/page.tsx`**
   - Manager login now uses lookup API
   - Waits for auth session to establish before querying managers
   - Uses .single() safely after auth session exists

2. **`/app/signup/page.tsx`**
   - Manager signup uses new signup API
   - Cashier signup uses new signup API
   - Removed direct Supabase queries

## Database Functions

### verify_cashier_login()
```sql
CREATE OR REPLACE FUNCTION verify_cashier_login(
    identifier TEXT,
    password_input TEXT
)
RETURNS TABLE (...) AS $$
BEGIN
    -- SECURITY DEFINER bypasses RLS
    -- Returns cashier data if password matches
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### get_user_store_id()
```sql
CREATE OR REPLACE FUNCTION get_user_store_id()
RETURNS INTEGER AS $$
BEGIN
    -- Gets store_id from managers table for current auth.uid()
    -- Used by RLS policies
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Required for admin client
```

## Testing Checklist

### Manager Signup (Create Store)
- [ ] Can signup with email, name, phone, store name
- [ ] Receives email confirmation
- [ ] Store created with unique code
- [ ] Manager record has correct store_id
- [ ] Can login after email confirmation

### Manager Signup (Join Store)
- [ ] Can signup with valid store code
- [ ] Join request created with pending status
- [ ] Cannot login until approved
- [ ] After approval, store_id is set
- [ ] Can login after email confirmation

### Cashier Signup
- [ ] Can signup with valid store code
- [ ] Join request created with pending status
- [ ] Cannot login until approved
- [ ] After approval, store_id is set
- [ ] Password is properly hashed

### Manager Login
- [ ] Can login with email + password
- [ ] Can login with name + password
- [ ] Can login with phone + password
- [ ] Redirects to /dashboard
- [ ] store_id stored in sessionStorage
- [ ] Cannot login if not approved
- [ ] Shows pending message if join request pending

### Cashier Login
- [ ] Can login with name + password
- [ ] Can login with phone + password
- [ ] Redirects to /dashboard/pos
- [ ] store_id stored in localStorage
- [ ] Cannot login if not approved

### Join Request Approval
- [ ] Manager can view pending requests
- [ ] Can approve request
- [ ] User's store_id is set correctly
- [ ] User can login after approval

## RLS Policies Summary

All policies work correctly because:

1. **During Signup**: Admin client bypasses RLS completely
2. **During Login Lookup**: Admin client bypasses RLS to find email
3. **After Auth**: Regular client works because `auth.uid()` is set
4. **Cashier Operations**: Database function with SECURITY DEFINER bypasses RLS
5. **Join Request Management**: Admin client bypasses RLS

## Security Notes

- Service role key is stored server-side only (never exposed to frontend)
- Admin client used only in API routes, never in client components
- Auth user creation requires email confirmation by default
- Passwords hashed using bcrypt (for cashiers) or Supabase Auth (for managers)
- RLS still protects data access after authentication
- Session tokens properly validated by Supabase middleware

## Common Issues & Solutions

### "Cannot coerce the result to a single JSON object"
- **Cause**: Using `.single()` before auth session established
- **Solution**: Wait for auth, then use `.single()` OR use array-based query

### "User not found" during login
- **Cause**: RLS blocking manager lookup before auth
- **Solution**: Use `/api/auth/lookup-manager` with admin client

### "Failed to create store/manager"
- **Cause**: RLS blocking inserts during signup
- **Solution**: Use `/api/auth/signup-manager` with admin client

### "Your account is pending approval"
- **Cause**: Join request not yet approved
- **Solution**: Wait for store manager to approve in dashboard

## Next Steps

1. Test complete signup/login flow for all user types
2. Test join request approval workflow
3. Verify multi-tenant data isolation
4. Deploy updated schema to production
5. Set up email provider for production confirmations
