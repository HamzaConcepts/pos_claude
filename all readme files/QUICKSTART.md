# Quick Start Guide - POS System

Get your POS system running in 5 minutes!

## Step 1: Install Dependencies (30 seconds)

```bash
npm install
```

## Step 2: Set Up Supabase (2 minutes)

1. Go to [supabase.com](https://supabase.com) → Create new project
2. Wait for database setup
3. Go to SQL Editor → Paste and run `database/schema.sql`
4. (Optional) Run `database/seed.sql` for sample data
5. Go to Settings → API → Copy your credentials

## Step 3: Configure Environment (30 seconds)

Create `.env.local` in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Step 4: Create Test User (1 minute)

In Supabase Dashboard:
1. Go to Authentication → Users → Add User
2. Create account:
   - Email: `manager@pos.com`
   - Password: `Manager@123`
3. Copy the user's UUID
4. Go to SQL Editor and run:
```sql
INSERT INTO users (id, username, email, role, full_name) 
VALUES ('your-user-uuid', 'manager', 'manager@pos.com', 'Manager', 'Store Manager');
```

## Step 5: Start Development Server (10 seconds)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Login Credentials

Use the account you just created:
- Email: `manager@pos.com`
- Password: `Manager@123`

## What You Get (Phase 1)

✅ Login/Signup functionality
✅ Role-based access (Manager/Admin/Cashier)
✅ Responsive sidebar navigation
✅ Dashboard layout
✅ Black & white modern UI

## Next Steps

- Explore the navigation
- Create more users with different roles
- Check `README.md` for full documentation
- See `DEPLOYMENT.md` for Vercel deployment
- View `pos_software_spec.md` for feature roadmap

## Common Issues

**Can't connect to database?**
- Double-check `.env.local` credentials
- Verify Supabase project is active

**Login not working?**
- Make sure you inserted user into `users` table
- Check email/password match

**Build errors?**
- Run `npm install` again
- Delete `node_modules` and `.next` folder, then reinstall

## Need Help?

Check the full README.md or specification document for detailed information.
