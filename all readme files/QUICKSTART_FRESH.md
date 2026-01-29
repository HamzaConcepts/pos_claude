# 🚀 Quick Start Guide - Fresh Supabase Deployment

## Overview
This guide will get your multi-tenant POS system running on a fresh Supabase project in under 10 minutes.

---

## Prerequisites
- ✅ Node.js installed (v18 or higher)
- ✅ Git installed
- ✅ Supabase account (free tier works)

---

## Step 1: Create Supabase Project (2 minutes)

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Fill in:
   - **Organization:** Select or create
   - **Name:** `POS System` (or your choice)
   - **Database Password:** Create a strong password (SAVE THIS!)
   - **Region:** Choose closest to you
4. Click **"Create new project"**
5. Wait ~2 minutes for setup to complete

---

## Step 2: Run Database Schema (1 minute)

1. In your Supabase project, click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Copy entire contents of `database/schema_fresh.sql`
4. Paste into SQL Editor
5. Click **"Run"** (or Ctrl+Enter)
6. Wait for success message ✅

**Verify:** Go to **Table Editor** → You should see 11 tables

---

## Step 3: Configure Environment Variables (2 minutes)

1. In Supabase project, go to **Settings** → **API**
2. Copy these values:
   - **Project URL**
   - **anon public key**
   - **service_role secret key**

3. Create `.env.local` in your project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Service Role Key (KEEP SECRET!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Step 4: Install Dependencies & Run (2 minutes)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Step 5: Create First Store (3 minutes)

### Sign Up First Manager:

1. Go to **http://localhost:3000/signup**
2. Select **"Manager"** account type
3. Choose **"Create New Store"**
4. Fill in:
   - **Store Name:** Your Business Name
   - **Manager Name:** Your Full Name
   - **Phone Number:** 11 digits (e.g., 03001234567)
   - **Email:** Your email
   - **Password:** Strong password (min 8 chars, uppercase, lowercase, number)
   - **Repeat Password:** Same password
5. Click **"Sign Up"**

### Important: Save Your Store Code!

You'll see an alert like:
```
Store created! Your store code is: A1B

Share this code with your employees to join your store.

Please check your email to verify your account.
```

**⚠️ SAVE THIS CODE!** You'll need it to add employees.

### Verify Email:

1. Check your email inbox
2. Click verification link
3. Return to app

### Login:

1. Go to **http://localhost:3000/login**
2. Enter **Name or Phone** and **Password**
3. Click **"Login"**
4. You should see the Dashboard! 🎉

---

## Step 6: Add Your First Employee (Optional)

### Add a Cashier:

1. Go to **http://localhost:3000/signup**
2. Select **"Cashier"** account type
3. Enter **Store Code** (the 3-character code from Step 5)
4. Fill in:
   - **Name:** Employee name
   - **Phone Number:** 11 digits
   - **Password:** Employee password
5. Click **"Sign Up"**

**Note:** Cashier account is now pending approval.

### Approve the Cashier (as Manager):

1. Login as Manager
2. Go to **Users** page (sidebar)
3. See **"Pending Join Requests"** section
4. Click **"Approve"** for the cashier
5. Cashier can now login!

---

## ✅ You're All Set!

### What You Can Do Now:

- ✅ **Inventory:** Add products, manage stock
- ✅ **POS:** Process sales, handle payments
- ✅ **Expenses:** Track business expenses
- ✅ **Dashboard:** View sales, revenue, profit
- ✅ **Users:** Manage employees, approve join requests
- ✅ **Reports:** Export sales data

### Multi-Tenant Features:

- ✅ Each store has unique 3-character code
- ✅ Data is isolated between stores
- ✅ Multiple stores can use same database
- ✅ Join request approval workflow
- ✅ Role-based permissions

---

## 🧪 Test Multi-Tenant (Optional)

### Create Second Store:

1. Logout (click user icon → Logout)
2. Sign up new manager with different email
3. Choose **"Create New Store"**
4. Get different store code (e.g., X9Z)

### Add Products to Both Stores:

1. Login to Store A → Add product "Laptop"
2. Login to Store B → Add product "Phone"

### Verify Isolation:

- ✅ Store A only sees "Laptop"
- ✅ Store B only sees "Phone"
- ✅ No data leakage!

---

## 📚 Next Steps

### Learn More:
- Read `MULTI_TENANT_IMPLEMENTATION_GUIDE.md` for details
- Check `TENANT_SYSTEM_DESIGN.md` for architecture

### Production Deployment:
- Deploy to Vercel (see `DEPLOYMENT.md`)
- Configure custom SMTP for emails
- Set up domain and SSL

### Customize:
- Modify Tailwind theme in `tailwind.config.ts`
- Add more product categories
- Customize reports

---

## 🆘 Troubleshooting

### "Database connection failed"
- ✅ Check `.env.local` has correct values
- ✅ Verify Supabase project is active
- ✅ Check firewall/network

### "Store code not generated"
- ✅ Verify `generate_store_code()` function exists
- ✅ Re-run `schema_fresh.sql`

### "Cannot login after signup"
- ✅ Managers: Check email for verification link
- ✅ Cashiers: Ask manager to approve join request

### "Cannot see products/sales"
- ✅ Verify `store_id` is in session
- ✅ Check browser console for errors
- ✅ Try logout and login again

### "Permission denied errors"
- ✅ Verify RLS policies exist (Table Editor → Policies)
- ✅ Check user has `store_id` assigned

---

## 📞 Support

Need help? Check:
1. Browser console (F12) for errors
2. Supabase logs (Dashboard → Logs)
3. Network tab for API failures
4. Database policies (Table Editor → Policies)

---

## 🎉 Success!

If you:
- ✅ Created store and got store code
- ✅ Can login and see dashboard
- ✅ Can add products
- ✅ Can approve join requests

**You're ready to use the POS system!** 🚀

---

**Time to Complete:** ~10 minutes  
**Difficulty:** Easy  
**Database Setup:** Automated via SQL script  
**Multi-Tenant:** Pre-configured and ready
