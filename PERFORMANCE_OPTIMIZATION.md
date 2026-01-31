# Performance Optimization Guide

## Completed Optimizations ✅

### 1. Console.log Removal (Jan 31, 2026)
- Removed ~60 console.log statements from API routes and frontend pages
- Significant reduction in browser console overhead
- Cleaner production logs

### 2. API Response Caching
- Added cache headers to frequently-accessed endpoints
- Configured stale-while-revalidate for better UX

---

## Database Performance Recommendations

### Critical Indexes to Add

Run these SQL commands in Supabase SQL Editor:

```sql
-- Products table indexes (HIGH PRIORITY)
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode, store_id);
CREATE INDEX IF NOT EXISTS idx_products_store_active ON products(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id, store_id);

-- Product IMEIs indexes
CREATE INDEX IF NOT EXISTS idx_product_imeis_number ON product_imeis(imei_number, store_id);
CREATE INDEX IF NOT EXISTS idx_product_imeis_status ON product_imeis(product_id, status);

-- Sales indexes (MEDIUM PRIORITY)
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON sales(store_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id, store_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- Stock batches indexes
CREATE INDEX IF NOT EXISTS idx_stock_batches_product ON stock_batches(product_id, is_depleted);
CREATE INDEX IF NOT EXISTS idx_stock_batches_store ON stock_batches(store_id, purchase_date DESC);

-- Partial payment customers
CREATE INDEX IF NOT EXISTS idx_partial_payment_phone ON partial_payment_customers(customer_phone, store_id);
CREATE INDEX IF NOT EXISTS idx_partial_payment_store_date ON partial_payment_customers(store_id, created_at DESC);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_store_date ON payments(store_id, payment_date DESC);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_store_date ON expenses(store_id, expense_date DESC);
```

### Why These Indexes Matter

1. **Products by Barcode**: POS scans hundreds of barcodes daily
2. **Active Products by Store**: Inventory page loads all active products
3. **Sales by Date**: Dashboard and reports query by date range
4. **IMEI Lookups**: Phone sales require fast IMEI verification
5. **Customer Phone**: Khaata page searches by phone frequently

---

## Query Optimization Tips

### 1. Use Selective Columns
❌ **Bad**: `.select('*')`
✅ **Good**: `.select('id, name, sku, stock_quantity')`

### 2. Limit Results
❌ **Bad**: No limit on customer queries
✅ **Good**: `.limit(100)` with pagination

### 3. Use Materialized Views (Future)
For dashboard stats, create a materialized view:
```sql
CREATE MATERIALIZED VIEW daily_stats AS
SELECT 
  store_id,
  DATE(sale_date) as date,
  COUNT(*) as total_sales,
  SUM(total_amount) as revenue
FROM sales
GROUP BY store_id, DATE(sale_date);

-- Refresh periodically
REFRESH MATERIALIZED VIEW daily_stats;
```

---

## Frontend Optimizations

### 1. React Query / SWR (Recommended)
Install SWR for client-side caching:
```bash
npm install swr
```

Example usage:
```typescript
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function Dashboard() {
  const { data, error } = useSWR('/api/dashboard/stats?store_id=1', fetcher, {
    refreshInterval: 30000, // Refresh every 30s
    revalidateOnFocus: false
  })
  // ...
}
```

### 2. Next.js Route Caching
Already implemented:
- `export const dynamic = 'force-dynamic'` for real-time data
- `export const revalidate = 30` for periodic updates

### 3. Component-level Memoization
Use `React.memo` for heavy components:
```typescript
export const ProductCard = React.memo(({ product }) => {
  // Component logic
})
```

---

## Next.js Compilation Behavior

### Why Pages "Compile" on Tab Switch (Development)

**This is NORMAL in development mode:**

1. **On-Demand Compilation**: Next.js compiles pages when you visit them
2. **Hot Module Replacement**: Ensures you see latest changes
3. **Faster Startup**: Only compiles what you need

**In Production (`npm run build`):**
- All pages pre-compiled
- No compilation on navigation
- Much faster response times

### Production Deployment Checklist

```bash
# 1. Build the project
npm run build

# 2. Test production build locally
npm start

# 3. Deploy to Vercel
vercel --prod
```

---

## Monitoring Performance

### 1. Supabase Dashboard
- Go to Database → Performance
- Check slow queries
- Monitor connection pool usage

### 2. Vercel Analytics
- Enable Web Vitals monitoring
- Track Core Web Vitals (LCP, FID, CLS)

### 3. Browser DevTools
- Network tab: Check API response times
- Performance tab: Identify rendering bottlenecks
- Lighthouse: Run performance audit

---

## Quick Wins (Implement These First)

- [x] Remove console.log statements
- [ ] Add database indexes (run SQL above)
- [ ] Enable Vercel Analytics
- [ ] Add pagination to Sales history (limit to 50 per page)
- [ ] Implement SWR for dashboard stats

---

## Expected Performance Improvements

After implementing all optimizations:

| Metric | Before | After |
|--------|--------|-------|
| Dashboard Load | 2-3s | <1s |
| POS Product Search | 500ms | <100ms |
| Sales History | 3-5s | <1s |
| Khaata Customer List | 2-3s | <500ms |

---

## Need Help?

1. Check Supabase logs for slow queries
2. Use Chrome DevTools Network tab
3. Monitor Vercel function logs
4. Check this guide for solutions
