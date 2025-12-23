# Pre-defined Expenses Feature - Migration Instructions

## Overview
This migration adds the ability for store managers to define recurring expenses that can be quickly selected when recording expenses.

## Database Changes

### New Table: `predefined_expenses`
- Stores pre-defined expense templates
- Linked to stores with RLS policies
- Includes fields: name, category, default_amount, description, is_active

### Features Added
1. **Store Management → Expenses Tab**: Manage pre-defined expenses
2. **Expenses Page**: Quick-select dropdown to auto-fill expense details
3. **API Routes**: Full CRUD operations for predefined expenses

## Migration Steps

### 1. Apply Database Schema
Run the SQL migration file in your Supabase SQL Editor:

```bash
# File location:
database/add_predefined_expenses.sql
```

**OR** Execute in Supabase Dashboard → SQL Editor:
1. Go to your Supabase project
2. Navigate to SQL Editor
3. Create a new query
4. Copy contents of `database/add_predefined_expenses.sql`
5. Click "Run"

### 2. Verify Database Changes
After running the migration, verify:

```sql
-- Check table exists
SELECT * FROM predefined_expenses LIMIT 1;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'predefined_expenses';

-- Check sample data (if stores exist)
SELECT COUNT(*) FROM predefined_expenses;
```

### 3. Test the Feature

#### A. Test Store Management → Expenses Tab
1. Login as a Manager
2. Go to **Dashboard → Store Management**
3. Click on the **Expenses** tab
4. You should see:
   - Pre-defined expenses list (may include sample data)
   - "Add Expense" button
   - Edit/Delete/Toggle active buttons for each expense

#### B. Add Pre-defined Expenses
1. Click "Add Expense"
2. Fill in:
   - Name (e.g., "Monthly Rent")
   - Category (e.g., "Rent")
   - Default Amount (e.g., 50000)
   - Description (optional)
   - Active checkbox (should be checked)
3. Click "Add"
4. Verify the expense appears in the list

#### C. Test Quick Selection in Expenses
1. Go to **Dashboard → Expenses**
2. Click "Add Expense"
3. You should see a new dropdown: "Quick Select (Optional)"
4. Select a pre-defined expense from the dropdown
5. Verify that Description, Category, and Amount are auto-filled
6. You can still modify these values if needed
7. Complete the expense entry

#### D. Test Edit/Delete
1. Go back to **Store Management → Expenses**
2. Click Edit on an expense
3. Modify the values
4. Click "Update"
5. Verify changes are saved
6. Test the toggle active/inactive feature
7. Inactive expenses should not appear in the Expenses page dropdown

## Files Changed

### New Files
- `database/add_predefined_expenses.sql` - Database schema
- `app/api/predefined-expenses/route.ts` - API endpoints
- `app/dashboard/store/expenses/page.tsx` - Management page

### Modified Files
- `app/dashboard/store/page.tsx` - Added Expenses tab
- `app/dashboard/expenses/page.tsx` - Added quick-select dropdown

## Features

### Store Management → Expenses Tab
- ✅ Add/Edit/Delete pre-defined expenses
- ✅ Toggle active/inactive status
- ✅ Grouped by category
- ✅ Full CRUD operations
- ✅ Validation for required fields

### Expenses Page Enhancement
- ✅ Quick-select dropdown for pre-defined expenses
- ✅ Auto-fill: description, category, and amount
- ✅ Only shows active pre-defined expenses
- ✅ Optional - can still manually enter expenses
- ✅ Can modify auto-filled values

## Security
- ✅ RLS policies ensure managers only see their store's expenses
- ✅ API routes validate store ownership
- ✅ Only active expenses shown in selection

## Sample Pre-defined Expenses
The migration includes these sample expenses (only if stores exist):
1. Monthly Rent - Rs. 50,000
2. Electricity Bill - Rs. 15,000
3. Water Bill - Rs. 2,000
4. Internet & Phone - Rs. 5,000
5. Store Cleaning - Rs. 3,000
6. Security Service - Rs. 8,000

You can modify or delete these and add your own.

## Rollback (if needed)

If you need to rollback this feature:

```sql
-- Drop the table and related objects
DROP TRIGGER IF EXISTS update_predefined_expenses_timestamp ON predefined_expenses;
DROP FUNCTION IF EXISTS update_predefined_expenses_updated_at();
DROP TABLE IF EXISTS predefined_expenses CASCADE;
```

## Support
If you encounter any issues:
1. Check Supabase logs for errors
2. Verify RLS policies are active
3. Ensure store_id is properly set
4. Check browser console for API errors

## Next Steps
After successful migration:
1. ✅ Add your store's recurring expenses
2. ✅ Train staff on using quick-select feature
3. ✅ Consider adding more pre-defined expenses as needed
4. ✅ Review and update default amounts periodically
