<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# POS System Development Instructions

This is a Next.js 14 project with TypeScript, Tailwind CSS, and Supabase for building a Point of Sale system.

## Project Structure
- `/app` - Next.js App Router pages and layouts
- `/components` - React components
- `/lib` - Utility functions and Supabase client
- `/database` - SQL schema and seed files

## Key Technologies
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS (Black & White theme)
- Supabase (Auth + PostgreSQL)
- Lucide React (Icons)

## Authentication
- Uses Supabase Auth
- Three roles: Manager, Admin, Cashier
- Role-based permissions defined in `/lib/supabase.ts`

## Setup Checklist

- [x] Verify that the copilot-instructions.md file in the .github directory is created.
- [x] Clarify Project Requirements
- [x] Scaffold the Project
- [x] Customize the Project
- [x] Install Required Extensions (None required)
- [x] Compile the Project (Dependencies installed successfully)
- [x] Create and Run Task (Ready to run with npm run dev)
- [x] Launch the Project (User can run npm run dev when ready)
- [x] Ensure Documentation is Complete

## Phase 1 Completion Status

**✅ PHASE 1 COMPLETE**

The following have been implemented:
- Project structure with Next.js 14, TypeScript, and Tailwind CSS
- Supabase configuration and database schema
- Authentication system (login/signup with role-based access)
- Sidebar navigation with responsive design
- Dashboard layout and placeholder pages
- Black and white theme
- Deployment configuration for Vercel

## Documentation

- `README.md` - Full project documentation
- `QUICKSTART.md` - 5-minute setup guide
- `DEPLOYMENT.md` - Vercel deployment instructions
- `database/schema.sql` - Database schema
- `database/seed.sql` - Sample data

## Next Steps (Phase 2)

To continue development:
1. Implement inventory management (CRUD operations)
2. Build the POS system for processing sales
3. Add real-time dashboard statistics
4. Create sales history page

## Running the Project

```bash
npm run dev
```

Then open http://localhost:3000
