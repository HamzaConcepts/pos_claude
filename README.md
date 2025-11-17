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
  - FIFO (First In, First Out) inventory tracking
  - Restock functionality with batch tracking
  - Restock history for each product
- ✅ **Point of Sale System**
  - Product search and cart management
  - Real-time total calculation
  - Payment processing (Cash/Digital)
  - **Partial Payment Support** with customer tracking
  - Receipt generation and printing
  - Automatic inventory updates
  - Sale description for order context
- ✅ **Sales Tracking**
  - Complete sales history
  - Transaction details with snapshots
  - Payment status tracking (Paid/Partial/Pending)
  - **Partial payment customer records** (Name, CNIC, Phone)
  - Comprehensive filters (Cashier, Product, Payment, Date)
  - Visual indicators for partial payments
- ✅ **Real-time Dashboard**
  - Today's and monthly sales statistics
  - Sales trend visualization
  - Top products by revenue
  - Low stock alerts
  - Recent transactions
- ✅ Black & White Minimal Theme
- ✅ Mobile Responsive Design

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
3. **For existing installations**: Run `database/add_partial_payment_customers.sql` to add the partial payment customer table
4. Run the SQL script from `database/seed.sql` to add sample data (optional)
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
│   ├── schema.sql                              # Complete database schema
│   ├── seed.sql                                # Sample data
│   ├── add_sale_description.sql                # Migration: Add sale description
│   ├── add_partial_payment_customers.sql       # Migration: Add partial payment tracking
│   └── disable_all_rls.sql                     # Disable RLS for testing
└── package.json
```

## Key Features

### Partial Payment System

The POS system supports partial payments with comprehensive customer tracking:

1. **During Sale**: If payment amount is less than total, system prompts for partial payment
2. **Customer Information**: Collects name, CNIC (13 digits), and phone number
3. **Tracking**: Creates record in `partial_payment_customers` table
4. **Visual Indicators**: Red warning badges (⚠️) on receipts and sales history
5. **Payment Details**: Shows total, amount paid, and amount remaining
6. **Receipt**: Displays customer information and outstanding balance

### FIFO Inventory Management

- Products tracked in batches with restock dates
- Sales deduct from oldest inventory first (First In, First Out)
- Restock history shows all batches with usage statistics
- Snapshot system preserves product details in sales history

### Mobile Responsive Design

- Desktop: Full table views with all columns
- Mobile: Prioritized columns with expandable rows for details
- Touch-friendly interface with appropriate sizing

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
