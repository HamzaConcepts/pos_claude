# POS System - Point of Sale Software

A modern, minimal Point of Sale system built with Next.js 14, TypeScript, Tailwind CSS, and Supabase.

## Features (Phase 2 Complete)

- ✅ User Authentication (Login/Signup)
- ✅ Role-based Access Control (Manager, Admin, Cashier)
- ✅ Responsive Sidebar Navigation
- ✅ Dashboard with Live Statistics
- ✅ **Inventory Management (Full CRUD)**
  - Product listing with search and filters
  - Add/Edit/Delete products
  - Stock management with low stock alerts
  - Category filtering
- ✅ **Point of Sale System**
  - Product search and cart management
  - Real-time total calculation
  - Payment processing (Cash/Digital)
  - Receipt generation and printing
  - Automatic inventory updates
- ✅ **Sales Tracking**
  - Complete sales history
  - Transaction details
  - Payment status tracking
- ✅ **Real-time Dashboard**
  - Today's and monthly sales statistics
  - Sales trend visualization
  - Top products by revenue
  - Low stock alerts
  - Recent transactions
- ✅ Black & White Minimal Theme

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Authentication)
- **UI Icons**: Lucide React
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- Git installed

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd pos_claude
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to be provisioned
3. Go to Project Settings > API to get your credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your anon/public key

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

### 5. Set up Database Tables

1. Go to your Supabase Dashboard > SQL Editor
2. Run the SQL script from `database/schema.sql` to create all tables
3. Run the SQL script from `database/seed.sql` to add sample data (optional)
   - **Important**: Copy and paste the INSERT statements into Supabase SQL Editor
   - See `SEED_DATA_INSTRUCTIONS.md` for detailed steps
   - This adds 10 sample products to test the system

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Default Test Accounts

After running the seed script, you can login with:

**Manager Account:**
- Email: manager@pos.com
- Password: Manager@123

**Admin Account:**
- Email: admin@pos.com
- Password: Admin@123

**Cashier Account:**
- Email: cashier@pos.com
- Password: Cashier@123

## Project Structure

```
pos_claude/
├── app/
│   ├── dashboard/          # Dashboard page
│   ├── pos/               # Point of Sale page
│   ├── inventory/         # Inventory management
│   ├── sales/             # Sales history
│   ├── accounting/        # Accounting page
│   ├── reports/           # Reports page
│   ├── users/             # User management
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page (redirects)
│   └── globals.css        # Global styles
├── components/
│   └── Sidebar.tsx        # Navigation sidebar
├── lib/
│   ├── supabase.ts        # Supabase client & permissions
│   └── types.ts           # TypeScript types
├── database/
│   ├── schema.sql         # Database schema
│   └── seed.sql           # Sample data
└── package.json
```

## User Roles & Permissions

### Manager (Full Access)
- User management (create, edit, delete)
- Product management (create, edit, delete)
- Process sales and view sales history
- Manage expenses
- View all reports and export data
- Access dashboard

### Admin
- Product management (create, edit, delete)
- Process sales and view sales history
- Manage expenses
- View reports and export data
- Access dashboard

### Cashier
- Process sales
- View sales history
- Access dashboard

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Click "Deploy"

Your app will be live at `your-app.vercel.app`

## Development Roadmap

### Phase 1: Foundation ✅ (Complete)
- [x] Project setup with Next.js & TypeScript
- [x] Configure Supabase database
- [x] Implement authentication system
- [x] Create basic layout with sidebar
- [x] Deploy to Vercel

### Phase 2: Core Features ✅ (Complete)
- [x] Build inventory management (CRUD)
- [x] Implement POS system
- [x] Enhance dashboard with real stats
- [x] Build sales listing page

### Phase 3: Advanced Features (Next)
- [ ] Implement accounting system
- [ ] Build report generation
- [ ] Add CSV/PDF export
- [ ] Implement user management

### Phase 4: Polish & Testing
- [ ] Refine UI/UX
- [ ] Add loading states
- [ ] Comprehensive testing
- [ ] Performance optimization

## Contributing

This is a learning project. Feel free to fork and modify as needed.

## License

MIT License - feel free to use this project for learning or commercial purposes.

## Support

For issues or questions, please refer to the specification document `pos_software_spec.md`.
