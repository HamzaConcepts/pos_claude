# Dynamic Currency Implementation - Complete

## Overview
Successfully implemented a dynamic currency system that allows stores to select their currency from Store Settings, which then reflects throughout the entire application including receipts.

## Changes Made

### 1. Database Schema
**File:** `database/add_currency_field.sql` (NEW)
- Added `currency` column to `stores` table
- Type: `VARCHAR(10)`, Default: `'PKR'`, NOT NULL
- Includes migration to set existing stores to PKR
- Run this SQL in Supabase to enable the feature

### 2. Currency Context & Hook
**File:** `lib/currency-context.tsx` (NEW)
- Created React Context for managing currency state
- Provides `useCurrency()` hook with:
  - `currency`: Current currency code (e.g., 'PKR', 'USD')
  - `formatCurrency(amount, decimals)`: Format numbers with currency
- Fetches currency from API on mount
- Listens for currency update events

### 3. Store Settings API
**File:** `app/api/store-info/route.ts` (UPDATED)
- GET: Now returns `currency` field from stores table
- PUT: Now accepts and updates `currency` field
- Allows partial updates (can update currency independently)

### 4. Store Settings UI
**File:** `app/dashboard/store/page.tsx` (UPDATED)
- Added currency selector dropdown in Store Information tab
- 9 currencies available:
  - PKR - Pakistani Rupee
  - USD - US Dollar
  - EUR - Euro
  - GBP - British Pound
  - INR - Indian Rupee
  - AED - UAE Dirham
  - SAR - Saudi Riyal
  - CAD - Canadian Dollar
  - AUD - Australian Dollar
- Saves to database and triggers global currency update
- Shows current currency next to Store Code

### 5. Dashboard Layout
**File:** `app/dashboard/layout.tsx` (UPDATED)
- Wrapped entire dashboard with `CurrencyProvider`
- All child pages now have access to currency context

### 6. Pages Updated to Use Dynamic Currency

#### Already Had useCurrency (Updated to use properly):
- **Dashboard (Home)** - `app/dashboard/page.tsx`
- **POS/New Sale** - `app/dashboard/pos/page.tsx`
- **Sales History** - `app/dashboard/sales/page.tsx`
- **Inventory** - `app/dashboard/inventory/page.tsx`
- **Expenses** - `app/dashboard/expenses/page.tsx`
- **Customer Ledger (Khaata)** - `app/dashboard/khaata/page.tsx`
- **Staff Performance** - `app/dashboard/cashiers/page.tsx`

#### Newly Updated:
- **Reports** - `app/dashboard/reports/page.tsx`
  - Added useCurrency hook
  - Replaced hardcoded PKR formatting
  - All charts and tables now use dynamic currency

- **Inventory Purchases** - `app/dashboard/inventory-purchases/page.tsx`
  - Added useCurrency hook
  - Updated all 4 stat cards and table amounts

- **Supplier Ledger** - `app/dashboard/supplier-ledger/page.tsx`
  - Added useCurrency hook
  - Updated supplier table (total, paid, remaining amounts)
  - Updated transaction details table
  - Updated Edit and Payment modals

### 7. Receipt Generator
**Files:** `lib/receipt-generator.ts`, `lib/types.ts`, `components/PrintReceiptButton.tsx` (UPDATED)

**Changes:**
- Added optional `currency` field to `ReceiptData` interface
- Updated `formatCurrency()` function to accept currency parameter
- Updated `saleToReceiptData()` to accept and pass currency
- Updated `generatePDFReceipt()` to use dynamic currency throughout
- Updated `generateThermalReceiptHTML()` to use dynamic currency in all HTML templates
- Updated `PrintReceiptButton` to fetch currency from API and pass to receipt generators

**Receipt Sections Updated:**
- Item unit prices and subtotals
- Subtotal line
- Discount line
- Total amount
- Amount paid
- Amount due / Change given
- Partial payment customer due amount

### 8. Bug Fix
**File:** `app/api/owner-withdrawals/route.ts` (FIXED)
- Fixed import error: Changed from non-existent `@/lib/supabase-server` to `@supabase/supabase-js`
- Updated to use `supabaseAdmin` client pattern (consistent with other API routes)
- All three endpoints (GET/POST/DELETE) now working

## How It Works

1. **User selects currency** in Store Settings → Store Information tab
2. **Currency saved** to database via PUT `/api/store-info`
3. **Event dispatched** (`currencyUpdated`) triggers context to refetch
4. **All pages re-render** with new currency from `useCurrency()` hook
5. **Receipts include currency** when printed/downloaded

## Currency Display Format
- Format: `CURRENCY AMOUNT` (e.g., "PKR 1,500" or "USD 1,500")
- Numbers formatted with commas for thousands
- Decimals: 0 for whole numbers, 2 for detailed amounts

## Migration Steps

1. **Run SQL Migration:**
   ```sql
   -- Execute in Supabase SQL Editor
   -- File: database/add_currency_field.sql
   ALTER TABLE stores ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'PKR' NOT NULL;
   UPDATE stores SET currency = 'PKR' WHERE currency IS NULL;
   ```

2. **Deploy Code:**
   - All code changes are already implemented
   - No additional configuration needed

3. **Test:**
   - Go to Store Settings → Store Information
   - Change currency to USD or any other option
   - Check all pages to verify currency displays correctly
   - Print a receipt to verify currency appears correctly

## Supported Pages Summary
✅ Dashboard/Home - Revenue, expenses, profit displays  
✅ POS Page - Cart items, totals, customer amounts  
✅ Sales History - Sale amounts, partial payments  
✅ Inventory - Stock values, restock costs  
✅ Expenses - All expense amounts  
✅ Reports - All financial metrics and exports  
✅ Customer Ledger - All customer balances  
✅ Supplier Ledger - All supplier balances  
✅ Staff Performance - Salaries and commissions  
✅ Inventory Purchases - Purchase amounts  
✅ Receipts (PDF & Thermal) - All monetary values  

## Notes
- Default currency remains PKR for backward compatibility
- Currency is store-specific (multi-tenant safe)
- Receipt generation handles missing currency gracefully (defaults to PKR)
- Context updates automatically when currency changes
- All pages using the `formatCurrency()` function now display dynamic currency
