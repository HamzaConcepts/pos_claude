# POS System - Deployment Guide

## Prerequisites for Deployment

1. A GitHub account
2. A Vercel account (sign up at vercel.com)
3. A Supabase project configured with the schema

## Step-by-Step Deployment Instructions

### 1. Set up Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for provisioning to complete
3. Go to SQL Editor in your Supabase dashboard
4. Copy the entire content from `database/schema.sql`
5. Paste and run it in the SQL Editor
6. Copy the content from `database/seed.sql` and run it to add sample products
7. Go to Project Settings > API and copy:
   - Project URL
   - anon/public key

### 2. Create Test Users in Supabase

1. Go to Authentication > Users in Supabase dashboard
2. Click "Add User" and create these accounts:
   
   **Manager:**
   - Email: manager@pos.com
   - Password: Manager@123
   - After creation, note the UUID
   
   **Admin:**
   - Email: admin@pos.com
   - Password: Admin@123
   - After creation, note the UUID
   
   **Cashier:**
   - Email: cashier@pos.com
   - Password: Cashier@123
   - After creation, note the UUID

3. Go back to SQL Editor and run:
```sql
INSERT INTO users (id, username, email, role, full_name) VALUES
('<manager-uuid>', 'manager', 'manager@pos.com', 'Manager', 'Store Manager'),
('<admin-uuid>', 'admin', 'admin@pos.com', 'Admin', 'Admin User'),
('<cashier-uuid>', 'cashier', 'cashier@pos.com', 'Cashier', 'Cashier User');
```

### 3. Initialize Git Repository

```bash
git init
git add .
git commit -m "Initial commit - Phase 1 complete"
```

### 4. Create GitHub Repository

1. Go to github.com and create a new repository
2. Copy the repository URL
3. Run these commands:

```bash
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 5. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign in with your GitHub account
3. Click "New Project"
4. Import your GitHub repository
5. Configure the project:
   - Framework Preset: Next.js (auto-detected)
   - Build Command: `npm run build`
   - Output Directory: `.next`
6. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
7. Click "Deploy"
8. Wait for deployment to complete (usually 2-3 minutes)

### 6. Access Your Deployed App

Your app will be live at: `https://your-project-name.vercel.app`

Test the deployment:
1. Visit the URL
2. Try logging in with the test accounts
3. Navigate through different pages
4. Verify the sidebar and navigation work correctly

## Updating Your Deployment

After making code changes:

```bash
git add .
git commit -m "Your commit message"
git push
```

Vercel will automatically redeploy your app on every push to the main branch.

## Environment Variables

Remember to never commit `.env.local` to git. The `.gitignore` file is already configured to exclude it.

For local development, always use `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
```

## Troubleshooting

### Build Fails
- Check that all dependencies are in package.json
- Verify environment variables are set correctly in Vercel
- Check the build logs in Vercel dashboard

### Authentication Not Working
- Verify Supabase credentials are correct
- Check that users table is populated
- Ensure RLS policies are active in Supabase

### Database Errors
- Verify schema.sql ran successfully
- Check that all tables exist in Supabase
- Verify foreign key relationships are correct

## Next Steps

Now that Phase 1 is complete, you can:
1. Test the authentication system
2. Verify role-based access control
3. Begin implementing Phase 2 features (Inventory Management)
