# Quick Setup: Cashier Management System

## 🚀 Quick Start (5 minutes)

### Step 1: Run Database Migration
1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Open the file `database/create_cashiers_table.sql`
4. Copy all the SQL code
5. Paste into Supabase SQL Editor
6. Click **Run** or press `Ctrl+Enter`
7. Verify "Success" message

### Step 2: Verify Installation
1. Open your POS application
2. Login as a **Manager**
3. Navigate to **Store** tab
4. You should see a new **Cashiers** tab

### Step 3: Add Your First Cashier
1. Click the **Cashiers** tab
2. Click **Add Cashier** button
3. Fill in:
   - **Full Name**: e.g., "Ali Ahmed"
   - **Phone Number**: e.g., "03001234567"
   - **Commission Rate**: e.g., "5" (for 5%)
4. Click **Create**

### Step 4: Select Active Cashier
1. Look at the **left sidebar**
2. Find **"Active Cashier"** dropdown (above navigation menu)
3. Click to open dropdown
4. Select the cashier you just created
5. Selection is saved automatically!

### Step 5: Test (Optional)
1. Go to **POS** page
2. Process a test sale
3. Go to **Sales** page
4. Verify the sale appears (cashier tracking coming in next update)

## ✅ You're Done!

The cashier system is now active. You can:
- Add more cashiers anytime
- Switch between cashiers using the sidebar dropdown
- Edit/delete cashiers from the Store → Cashiers tab

## 📋 What's Next?

To fully integrate cashiers with sales tracking:
1. Update POS page to send `cashier_ref_id` when processing sales
2. Update Sales page to display cashier name for each sale
3. Add cashier filter to Sales reports
4. Create commission reports

## 🆘 Troubleshooting

**Don't see Cashiers tab?**
- Make sure you're logged in as Manager (not Cashier)
- Refresh the page

**Don't see cashier dropdown in sidebar?**
- Make sure you've added at least one cashier
- Only Managers can see this dropdown

**SQL migration errors?**
- Check if tables already exist (may need to drop first)
- Verify you have admin access to Supabase
- Check for typos when copying SQL

## 📚 Documentation

For complete documentation, see:
- `CASHIER_SYSTEM.md` - Full user guide
- `CASHIER_IMPLEMENTATION_SUMMARY.md` - Technical details

## 💡 Quick Tips

1. **Commission Rates**: Enter as percentage (5 = 5%, not 0.05)
2. **Phone Numbers**: Any format works (with or without dashes)
3. **Selection Persists**: Selected cashier stays even after browser refresh
4. **No Account Needed**: Cashiers don't need separate login credentials
5. **Soft Delete**: Deleted cashiers are hidden but data is preserved
