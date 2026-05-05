-- Inventory purchase model cleanup
-- 1) Add purchase_type to stock_batches
-- 2) Backfill purchase_type
-- 3) Add trigger to set purchase_type on insert
-- 4) Stop writing inventory purchases to expenses

BEGIN;

ALTER TABLE public.stock_batches
  ADD COLUMN IF NOT EXISTS purchase_type text;

-- Backfill existing records
UPDATE public.stock_batches
SET purchase_type = 'initial_stock'
WHERE is_initial_stock = true;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY store_id, product_id
      ORDER BY purchase_date ASC, id ASC
    ) AS rn
  FROM public.stock_batches
  WHERE is_initial_stock = false
)
UPDATE public.stock_batches sb
SET purchase_type = CASE WHEN ranked.rn = 1 THEN 'new_product' ELSE 'inventory_restock' END
FROM ranked
WHERE sb.id = ranked.id
  AND sb.purchase_type IS NULL;

UPDATE public.stock_batches
SET purchase_type = 'inventory_restock'
WHERE purchase_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_batches_purchase_type_check'
      AND conrelid = 'public.stock_batches'::regclass
  ) THEN
    ALTER TABLE public.stock_batches
      ADD CONSTRAINT stock_batches_purchase_type_check
      CHECK (purchase_type IN ('initial_stock', 'new_product', 'inventory_restock'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_stock_batch_purchase_type()
RETURNS trigger AS $$
DECLARE
  batch_count integer;
BEGIN
  IF NEW.purchase_type IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.is_initial_stock THEN
    NEW.purchase_type := 'initial_stock';
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO batch_count
  FROM public.stock_batches
  WHERE store_id = NEW.store_id
    AND product_id = NEW.product_id;

  IF batch_count = 0 THEN
    NEW.purchase_type := 'new_product';
  ELSE
    NEW.purchase_type := 'inventory_restock';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_stock_batch_purchase_type ON public.stock_batches;
CREATE TRIGGER trigger_set_stock_batch_purchase_type
  BEFORE INSERT ON public.stock_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_stock_batch_purchase_type();

-- Stop writing inventory purchases into expenses
DROP TRIGGER IF EXISTS trigger_create_restock_expense ON public.stock_batches;
DROP FUNCTION IF EXISTS public.create_restock_expense();

COMMIT;
