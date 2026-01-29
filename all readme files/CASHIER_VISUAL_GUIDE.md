# Cashier System - Visual Guide

## What You'll See

### 1. Store Page - New Cashiers Tab
```
┌─────────────────────────────────────────────────────────┐
│ Store Management                                        │
├─────────────────────────────────────────────────────────┤
│ [Users] [Categories] [Store Info] [→Cashiers←] [...]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Cashiers                               [+ Add Cashier] │
│  Manage store cashiers and their commission rates       │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │  👤 Ali Ahmed                    [Edit] [X] │        │
│  │     03001234567                              │        │
│  │     Commission: 5%                           │        │
│  └──────────────────────────────────────────┘          │
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │  👤 Sara Khan                    [Edit] [X] │        │
│  │     03009876543                              │        │
│  │     Commission: 7.5%                         │        │
│  └──────────────────────────────────────────┘          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 2. Add Cashier Modal
```
┌───────────────────────────────────┐
│  Add Cashier                  [X] │
├───────────────────────────────────┤
│                                   │
│  Full Name *                      │
│  [_________________________]      │
│                                   │
│  Phone Number *                   │
│  [_________________________]      │
│                                   │
│  Commission Rate (%)              │
│  [_________________________]      │
│                                   │
│         [Cancel]  [Create]        │
└───────────────────────────────────┘
```

### 3. Sidebar - Cashier Selector (NEW!)
```
┌─────────────────────────┐
│  POS System             │
├─────────────────────────┤
│                         │
│  Active Cashier         │  ← NEW FEATURE
│  ┌──────────────────┐  │
│  │ 👤 Ali Ahmed   ▾ │  │  ← Dropdown
│  └──────────────────┘  │
│                         │
│  ├─ 🏠 Dashboard        │
│  ├─ 🛒 POS              │
│  ├─ 📦 Inventory        │
│  ├─ 💰 Sales            │
│  ├─ 📄 Expenses         │
│  ├─ 📖 Khaata System    │
│  └─ 👥 Store            │
│                         │
│  ─────────────────────  │
│  Manager Name           │
│  Manager                │
│  [🚪 Logout]            │
└─────────────────────────┘
```

### 4. Cashier Dropdown (Expanded)
```
┌─────────────────────────┐
│  Active Cashier         │
│  ┌──────────────────┐  │
│  │ 👤 Ali Ahmed   ▴ │  │
│  └──────────────────┘  │
│    ┌─────────────────┐ │
│    │ No Cashier      │ │
│    ├─────────────────┤ │
│    │ 👤 Ali Ahmed    │ │  ← Selected
│    │    03001234567  │ │
│    ├─────────────────┤ │
│    │ 👤 Sara Khan    │ │
│    │    03009876543  │ │
│    └─────────────────┘ │
└─────────────────────────┘
```

## User Flow Diagram

```
Manager Login
     ↓
Navigate to Store → Cashiers
     ↓
Add Cashier Records
(Name, Phone, Commission)
     ↓
Select Active Cashier from Sidebar
     ↓
Process Sales (Cashier info included)
     ↓
View Reports (Filter by cashier)
```

## Data Flow

```
┌──────────────┐
│   Manager    │
│  (Sidebar)   │
└──────┬───────┘
       │ Selects
       ↓
┌──────────────┐      Saves to        ┌──────────────┐
│   Cashier    │ ←──────────────────→ │ localStorage │
│  Dropdown    │                       └──────────────┘
└──────┬───────┘
       │ Selection used
       ↓
┌──────────────┐      Includes        ┌──────────────┐
│  POS Sale    │ ──────────────────→  │    Sales     │
│  Processing  │   cashier_ref_id      │   Database   │
└──────────────┘                       └──────────────┘
```

## Database Structure

```
┌─────────────────────────────────────┐
│          CASHIERS TABLE             │
├─────────────────────────────────────┤
│ id (PK)                             │
│ store_id (FK → stores)              │
│ full_name                           │
│ phone_number                        │
│ commission_rate                     │
│ is_active                           │
│ created_at                          │
│ updated_at                          │
└───────────┬─────────────────────────┘
            │
            │ References
            ↓
┌─────────────────────────────────────┐
│           SALES TABLE               │
├─────────────────────────────────────┤
│ id (PK)                             │
│ total_amount                        │
│ cashier_ref_id (FK → cashiers) ← NEW│
│ store_id                            │
│ ...                                 │
└─────────────────────────────────────┘
```

## API Endpoints

```
GET    /api/cashiers?store_id=1     → List all active cashiers
POST   /api/cashiers                 → Create new cashier
PUT    /api/cashiers                 → Update cashier
DELETE /api/cashiers?id=1            → Soft delete cashier
```

## File Structure (What Changed)

```
pos_claude/
├── app/
│   ├── api/
│   │   └── cashiers/
│   │       └── route.ts            ← NEW
│   └── dashboard/
│       └── store/
│           └── page.tsx            ← UPDATED (added Cashiers tab)
├── components/
│   └── Sidebar.tsx                 ← UPDATED (added dropdown)
├── database/
│   └── create_cashiers_table.sql   ← NEW
├── lib/
│   └── types.ts                    ← UPDATED (added Cashier type)
└── docs/
    ├── CASHIER_SYSTEM.md           ← NEW
    ├── CASHIER_IMPLEMENTATION_SUMMARY.md  ← NEW
    ├── CASHIER_QUICK_SETUP.md      ← NEW
    └── CASHIER_VISUAL_GUIDE.md     ← THIS FILE
```

## Before vs After

### BEFORE
```
Store Tab Options:
- Users
- Categories  
- Store Info
- Initial Stock
- Expenses

Sidebar:
- Navigation menu only
- User info at bottom
```

### AFTER
```
Store Tab Options:
- Users
- Categories
- Store Info
- Cashiers        ← NEW!
- Initial Stock
- Expenses

Sidebar:
- Cashier Selector  ← NEW!
- Navigation menu
- User info at bottom
```

## Key Benefits (Visual)

```
OLD WAY:                      NEW WAY:
┌────────────────┐           ┌────────────────┐
│  All sales     │           │  Sales by      │
│  recorded      │  vs.      │  specific      │
│  anonymously   │           │  cashier       │
└────────────────┘           └────────────────┘

❌ No tracking               ✅ Full tracking
❌ No commissions            ✅ Commission rates
❌ No accountability         ✅ Clear attribution
❌ Manual counting           ✅ Automated reports
```

## Next Steps Visualization

```
CURRENT STATE:               NEXT STEPS:
┌─────────────┐             ┌─────────────┐
│  Cashiers   │             │  POS sends  │
│   Added     │ → Setup     │ cashier_ref │ → Future
│             │   Done      │   on sale   │   Work
└─────────────┘             └─────────────┘
      ✅                            ⏳

                            ┌─────────────┐
                            │  Reports    │
                            │  by cashier │
                            └─────────────┘
                                  ⏳
```

## Mobile View

```
┌───────────────────┐
│  ☰  POS System    │
├───────────────────┤
│ Active Cashier    │
│ [Ali Ahmed ▾]     │
│                   │
│ Dashboard         │
│ POS               │
│ Inventory         │
│ ...               │
└───────────────────┘
```

## Quick Reference

| Feature | Location | Action |
|---------|----------|--------|
| Add Cashier | Store → Cashiers | Click "+ Add Cashier" |
| Edit Cashier | Store → Cashiers | Click "Edit" icon |
| Delete Cashier | Store → Cashiers | Click "X" icon |
| Select Cashier | Sidebar (top) | Click dropdown, choose cashier |
| Clear Selection | Sidebar dropdown | Choose "No Cashier Selected" |
| View Cashiers | Store → Cashiers | See list with details |
