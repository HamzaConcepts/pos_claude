-- Backfill recorder fields for inventory purchases from legacy expenses
-- Run BEFORE removing inventory expenses

BEGIN;

-- Ensure any missing inventory_purchase_records rows exist
INSERT INTO public.inventory_purchase_records (stock_batch_id, store_id)
SELECT sb.id, sb.store_id
FROM public.stock_batches sb
LEFT JOIN public.inventory_purchase_records ipr ON ipr.stock_batch_id = sb.id
WHERE ipr.stock_batch_id IS NULL;

WITH candidate_expenses AS (
  SELECT
    e.reference_id AS stock_batch_id,
    e.recorded_by,
    e.recorded_by_cashier_id,
    e.created_at,
    e.id,
    ROW_NUMBER() OVER (
      PARTITION BY e.reference_id
      ORDER BY e.created_at DESC, e.id DESC
    ) AS rn
  FROM public.expenses e
  WHERE e.category IN ('new_product', 'inventory_restock')
    AND e.reference_id IS NOT NULL
)
UPDATE public.inventory_purchase_records ipr
SET recorded_by = ce.recorded_by,
    recorded_by_cashier_id = ce.recorded_by_cashier_id
FROM candidate_expenses ce
WHERE ipr.stock_batch_id = ce.stock_batch_id
  AND ce.rn = 1
  AND ipr.recorded_by IS NULL
  AND ipr.recorded_by_cashier_id IS NULL;

COMMIT;
