# Database Backup - Pre Multi-Tenant Implementation

**Backup Date:** November 19, 2025  
**Purpose:** Backup before implementing multi-tenant store system

## Files in this Backup

1. **schema_backup.sql** - Complete database schema including all tables
2. **functions_backup.sql** - All database functions and triggers
3. **rls_policies_backup.sql** - All Row Level Security policies

## Restoration Instructions

If you need to rollback to this state:

### Option 1: Full Restoration (Nuclear Option)
```sql
-- WARNING: This will delete all data!
-- Drop all tables
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS partial_payment_customers CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS cashier_accounts CASCADE;
DROP TABLE IF EXISTS managers CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS verify_cashier_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Then run the backup scripts in order:
-- 1. schema_backup.sql
-- 2. functions_backup.sql
-- 3. rls_policies_backup.sql
```

### Option 2: Selective Restoration
Restore only specific tables or policies as needed by copying relevant sections from the backup files.

## Current Database State (Before Tenant System)

### Tables:
- managers (for manager accounts with Supabase Auth)
- cashier_accounts (for cashier accounts with direct DB auth)
- products (product catalog)
- inventory (stock management with FIFO)
- sales (sales transactions)
- sale_items (individual items in each sale)
- expenses (business expenses)
- partial_payment_customers (customer info for partial payments)
- payments (payment records)

### Key Features:
- No store isolation (single tenant)
- Managers and cashiers in separate tables
- Direct authentication for cashiers
- Supabase Auth for managers
- FIFO inventory management
- Partial payment support

## What Will Change with Multi-Tenant

1. New `stores` table with 3-character alphanumeric codes
2. `store_id` column added to all data tables
3. Store-based RLS policies for data isolation
4. Join request system for users
5. Manager approval workflow for user access
