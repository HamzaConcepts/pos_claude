# Minimal UI Design System - Update Guide

## ✅ Completed
- **app/globals.css** - Updated with minimal design system
- **components/Sidebar.tsx** - Converted to light mode, minimal design
- **app/dashboard/cashiers/page.tsx** - Fully updated with minimal design
- **app/dashboard/page.tsx** - Fully updated with minimal design

## 🔄 Remaining Pages to Update

### Design System Reference

**Colors:**
```
Primary: cyan-600 (#0EA5E9)
Backgrounds: white (bg-white)
Borders: gray-200
Text: 
  - Headings: gray-900
  - Labels: gray-600
  - Secondary: gray-500
Icon Backgrounds: cyan-50, green-50, red-50, orange-50, blue-50
```

**Typography:**
```
Page Headers: text-xl md:text-2xl font-bold
Section Headers: text-base font-semibold
Body Text: text-sm
Labels: text-xs
```

**Components:**
```tsx
// Cards
className="bg-white border border-gray-200 rounded p-4"

// Buttons (Primary)
className="px-3 py-2 text-sm bg-cyan-600 text-white rounded hover:bg-cyan-700"

// Buttons (Secondary)
className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"

// Inputs
className="border border-gray-300 px-3 py-2 text-sm rounded focus:border-cyan-600 focus:outline-none"

// Table Headers
className="bg-gray-50 text-gray-700 border-b border-gray-200"
<th className="px-3 py-2.5 text-left text-sm font-semibold">

// Table Rows
className="border-b border-gray-100 hover:bg-gray-50"

// Badges/Status
className="px-2 py-0.5 text-xs rounded border font-medium"
// Green: bg-green-50 text-green-700 border-green-200
// Red: bg-red-50 text-red-700 border-red-200
// Orange: bg-orange-50 text-orange-700 border-orange-200

// Icons
Card Icons: 18px
Button Icons: 14-16px
```

**Spacing:**
```
Page Padding: p-4 md:p-5
Section Margins: mb-5
Grid Gaps: gap-3
Card Padding: p-4
```

### Files to Update

#### 1. app/dashboard/pos/page.tsx
**Find and Replace:**
- `text-3xl` → `text-2xl`
- `text-2xl` → `text-xl`
- `text-lg` → `text-base`
- `border-2 border-black` → `border border-gray-200`
- `bg-black text-white` → `bg-cyan-600 text-white`
- `shadow-lg` → (remove)
- `px-4 py-2` → `px-3 py-2` (buttons)
- Update icon sizes: 24 → 18, 20 → 16
- Table headers: bg-gradient → bg-gray-50

#### 2. app/dashboard/inventory/page.tsx
**Updates:**
- Header: "Inventory" → Same size as cashiers
- Cards: Remove shadows, use border border-gray-200
- Buttons: Update to cyan-600 with smaller padding
- Table: bg-gray-50 headers, border-gray-200
- Modal styles: Simplified borders
- Low stock badges: orange-50 with border

#### 3. app/dashboard/sales/page.tsx
**Updates:**
- Filter section: Simplified styling
- Table: Minimal headers and rows
- Status badges: With borders
- Edit modal: Minimal design
- PDF button: cyan-600 primary color

#### 4. app/dashboard/expenses/page.tsx
**Updates:**
- Summary cards: cyan/green/red with borders
- Form inputs: border-gray-300
- Table: bg-gray-50 headers
- Modals: Simplified
- Category badges: With borders

#### 5. app/dashboard/khaata/page.tsx
**Updates:**
- Tab buttons: cyan-50 active state with border
- Customer/Supplier cards: Minimal borders
- Expandable sections: Simplified
- Payment status: Bordered badges
- Forms: Minimal input styles

#### 6. app/dashboard/store/page.tsx
**Updates:**
- Tab navigation: cyan active state
- User cards: Minimal borders
- Category management: Simplified
- Cashier table: bg-gray-50 headers
- Forms: Consistent input styling
- Action buttons: cyan primary colors

### Key Changes to Make

1. **Remove All:**
   - `shadow-lg`, `shadow-md`, `shadow-sm`
   - `shadow-xl`
   - Gradient backgrounds (from-X to-Y)
   - `border-2` (change to `border`)
   - `rounded-xl`, `rounded-lg` (change to `rounded`)
   - Large icon sizes (24+) → 16-18px

2. **Replace Colors:**
   - `bg-black` → `bg-cyan-600`
   - `text-black` → `text-gray-900`
   - `border-black` → `border-gray-200`
   - `bg-blue-600` → `bg-cyan-600`
   - `focus:ring` → `focus:border-cyan-600 focus:outline-none`

3. **Update Sizes:**
   - Headers: Reduce by one size level
   - Padding: Reduce px-4 → px-3
   - Icons: Generally 16-18px
   - Font weights: bold → semibold (in many cases)

4. **Table Headers:**
```tsx
// Old
<thead className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">

// New
<thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
```

5. **Status Badges:**
```tsx
// Old
<span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">

// New  
<span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded text-xs font-medium">
```

### Testing Checklist

After updating each page:
- [ ] No console errors
- [ ] Colors match the new cyan theme
- [ ] No shadows or glows visible
- [ ] Text is readable (not too small)
- [ ] Buttons have proper hover states
- [ ] Forms are functional
- [ ] Tables are readable
- [ ] Responsive on mobile

## Priority Order

1. **POS** - Most frequently used
2. **Inventory** - Critical for operations  
3. **Sales** - Important for tracking
4. **Store** - Settings page
5. **Expenses** - Financial tracking
6. **Khaata** - Customer ledger

## Notes

- The design is meant to be clean and minimal, not sparse
- Use borders to define sections instead of shadows
- Icon backgrounds (cyan-50, etc.) add subtle color
- Maintain adequate spacing for readability
- Keep the responsive design intact
