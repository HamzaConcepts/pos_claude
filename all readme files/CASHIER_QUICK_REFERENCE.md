# 🎯 Quick Reference: Cashier System

## Two-Tier System

```
┌─────────────────────────────────────────────────┐
│                 TIER 1: LOGIN                   │
│         (cashier_accounts table)                │
├─────────────────────────────────────────────────┤
│  • ONE shared account per store                 │
│  • Used for authentication only                 │
│  • Limited permissions (no manager access)      │
│  • Example: cashier@store123.com                │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│              TIER 2: TRACKING                   │
│            (cashiers table)                     │
├─────────────────────────────────────────────────┤
│  • Multiple staff records per store             │
│  • NO login credentials                         │
│  • Name, phone, commission rate                 │
│  • Selected via sidebar dropdown                │
│  • Saved with each sale                         │
└─────────────────────────────────────────────────┘
```

## Database Fields

```sql
-- Two separate fields in sales table:
sales.cashier_id       → Login account (shared)
sales.cashier_ref_id   → Staff member (individual)
```

## Workflow Diagram

```
Cashier Login (shared account)
         ↓
Manager Selects "John Doe" (sidebar)
         ↓
John Processes Sales
         ↓
Sale Saved:
  • cashier_id: shared-account-uuid
  • cashier_ref_id: 3 (John's ID)
         ↓
Reports Show: "John Doe"
```

## Quick Actions

| Task | Location | Action |
|------|----------|--------|
| Add cashier | Store → Cashiers | Click "+ Add Cashier" |
| Select cashier | Sidebar (top) | Click dropdown |
| View cashiers | Store → Store Info | See "Cashiers Information" card |
| Process sale | POS | Sale auto-includes selected cashier |

## Permission Matrix

| Feature | Manager | Shared Cashier Account |
|---------|---------|----------------------|
| POS | ✅ Yes | ✅ Yes |
| Process Sales | ✅ Yes | ✅ Yes |
| View Sales | ✅ Full | ⚠️ Limited |
| Store Management | ✅ Yes | ❌ No |
| Add Users | ✅ Yes | ❌ No |
| Add Cashiers | ✅ Yes | ❌ No |
| Full Reports | ✅ Yes | ❌ No |
| Expenses | ✅ Yes | ⚠️ View Only |

## Key Files

```
app/
├── api/
│   └── cashiers/route.ts          → CRUD for cashiers
│   └── sales/route.ts             → Saves cashier_ref_id
├── dashboard/
│   ├── pos/page.tsx               → Reads selected cashier
│   └── store/page.tsx             → Manages cashiers + info card
└── components/
    └── Sidebar.tsx                → Cashier selector dropdown

database/
└── create_cashiers_table.sql      → Migration script
```

## Testing Steps

```
1. ✓ Run SQL migration
2. ✓ Add cashiers (Store → Cashiers)
3. ✓ Select cashier (Sidebar dropdown)
4. ✓ Process sale
5. ✓ Check receipt (shows cashier name)
6. ✓ View Store Info (shows cashiers card)
```

## Common Scenarios

### Scenario 1: New Cashier Hired
```
1. Manager → Store → Cashiers
2. Click "Add Cashier"
3. Enter: Name, Phone, Commission
4. Done! Cashier ready to process sales
```

### Scenario 2: Shift Change
```
1. Manager opens sidebar
2. Click cashier dropdown
3. Select new cashier
4. New cashier processes sales
```

### Scenario 3: Commission Calculation
```
1. View sales history
2. Filter by cashier name (future)
3. Sum total sales for that cashier
4. Apply commission rate
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Dropdown not showing | 1. Add cashiers first<br>2. Login as Manager |
| Wrong cashier on receipt | Check sidebar selection before sale |
| Cashiers card empty | No cashiers added yet |
| Can't add cashier | Must be logged in as Manager |

## Remember

✅ **ONE login** per store (shared)
✅ **MANY cashiers** per store (tracked)
✅ **SELECT cashier** before processing sales
✅ **TRACK performance** per individual
✅ **CALCULATE commission** per person

## Documentation

- 📘 Full Guide: `CASHIER_SYSTEM.md`
- 🔧 Technical: `CASHIER_IMPLEMENTATION_SUMMARY.md`
- 📋 Checklist: `CASHIER_CHECKLIST.md`
- 🎨 Visual: `CASHIER_VISUAL_GUIDE.md`
- 🔄 Updates: `CASHIER_UPDATES_DEC_2025.md`
