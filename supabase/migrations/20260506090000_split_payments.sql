BEGIN;

-- Track bank accounts for digital sales payments.
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS bank_account_name TEXT;

COMMENT ON COLUMN public.payments.bank_account_name IS 'Store bank account name for digital sales payments';

-- Allow Mixed payment method for sales.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_payment_method_check'
  ) THEN
    ALTER TABLE public.sales DROP CONSTRAINT sales_payment_method_check;
  END IF;
END $$;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_payment_method_check
  CHECK ((payment_method)::text = ANY (ARRAY['Cash','Digital','Mixed']::text[]));

-- Allow Mixed payment method for stock batches.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_batches_payment_method_check'
  ) THEN
    ALTER TABLE public.stock_batches DROP CONSTRAINT stock_batches_payment_method_check;
  END IF;
END $$;

ALTER TABLE public.stock_batches
  ADD CONSTRAINT stock_batches_payment_method_check
  CHECK ((payment_method)::text = ANY (ARRAY['Cash','Digital','Mixed']::text[]));

-- Split payments for inventory purchases.
CREATE TABLE IF NOT EXISTS public.inventory_purchase_payments (
  id serial PRIMARY KEY,
  stock_batch_id integer NOT NULL REFERENCES public.stock_batches(id) ON DELETE CASCADE,
  store_id integer NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  payment_method character varying(20) NOT NULL,
  amount numeric(10,2) NOT NULL,
  bank_account_name text,
  recorded_by uuid,
  recorded_by_cashier_id integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_purchase_payments_amount_check CHECK (amount > 0),
  CONSTRAINT inventory_purchase_payments_method_check CHECK ((payment_method)::text = ANY (ARRAY['Cash','Digital']::text[])),
  CONSTRAINT inventory_purchase_payments_bank_account_check CHECK (
    payment_method <> 'Digital' OR (bank_account_name IS NOT NULL AND length(btrim(bank_account_name)) > 0)
  ),
  CONSTRAINT inventory_purchase_payments_recorder_check CHECK (
    (recorded_by IS NULL AND recorded_by_cashier_id IS NULL)
    OR (recorded_by IS NOT NULL AND recorded_by_cashier_id IS NULL)
    OR (recorded_by IS NULL AND recorded_by_cashier_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_purchase_payments_batch
  ON public.inventory_purchase_payments (stock_batch_id);

CREATE INDEX IF NOT EXISTS idx_inventory_purchase_payments_store_method
  ON public.inventory_purchase_payments (store_id, payment_method);

-- Backfill inventory purchase payments from existing batch payments.
INSERT INTO public.inventory_purchase_payments (
  stock_batch_id,
  store_id,
  payment_method,
  amount,
  bank_account_name,
  recorded_by,
  recorded_by_cashier_id,
  created_at
)
SELECT
  sb.id,
  sb.store_id,
  sb.payment_method,
  sb.amount_paid,
  CASE
    WHEN sb.payment_method = 'Digital' THEN 'Legacy'
    ELSE NULL
  END,
  ipr.recorded_by,
  ipr.recorded_by_cashier_id,
  sb.created_at
FROM public.stock_batches sb
LEFT JOIN public.inventory_purchase_payments ipp ON ipp.stock_batch_id = sb.id
LEFT JOIN public.inventory_purchase_records ipr ON ipr.stock_batch_id = sb.id
WHERE ipp.stock_batch_id IS NULL
  AND sb.amount_paid IS NOT NULL
  AND sb.amount_paid > 0;

-- Backfill bank account name for existing digital payments.
UPDATE public.payments p
SET bank_account_name = s.bank_account_name
FROM public.sales s
WHERE p.sale_id = s.id
  AND p.payment_method = 'Digital'
  AND (p.bank_account_name IS NULL OR btrim(p.bank_account_name) = '')
  AND s.bank_account_name IS NOT NULL;

-- Update inventory purchases view to use split payment totals.
CREATE OR REPLACE VIEW public.inventory_purchases_view AS
WITH payment_totals AS (
  SELECT
    stock_batch_id,
    store_id,
    SUM(CASE WHEN payment_method = 'Cash' THEN amount ELSE 0 END) AS cash_paid,
    SUM(CASE WHEN payment_method = 'Digital' THEN amount ELSE 0 END) AS digital_paid
  FROM public.inventory_purchase_payments
  GROUP BY stock_batch_id, store_id
)
SELECT
  sb.id,
  sb.store_id,
  sb.product_id,
  sb.batch_number,
  sb.cost_price,
  sb.quantity_purchased,
  sb.purchase_date,
  (
  CASE
    WHEN COALESCE(pt.cash_paid, 0) > 0 AND COALESCE(pt.digital_paid, 0) > 0 THEN 'Mixed'
    WHEN COALESCE(pt.digital_paid, 0) > 0 THEN 'Digital'
    WHEN COALESCE(pt.cash_paid, 0) > 0 THEN 'Cash'
    ELSE sb.payment_method
  END
  )::character varying(20) AS payment_method,
  sb.is_initial_stock,
  sb.purchase_type,
  sb.created_at,
  p.name AS product_name,
  p.sku AS product_sku,
  p.description AS product_description,
  s.supplier_name,
  s.phone_number AS supplier_phone,
  ipr.recorded_by,
  ipr.recorded_by_cashier_id,
  COALESCE(ca.full_name, m.full_name) AS recorded_by_name,
  (sb.cost_price * sb.quantity_purchased) AS total_amount,
  CASE
    WHEN pt.stock_batch_id IS NOT NULL THEN COALESCE(pt.cash_paid, 0) + COALESCE(pt.digital_paid, 0)
    WHEN sk.id IS NOT NULL THEN sk.amount_paid
    WHEN sb.amount_paid IS NOT NULL AND sb.amount_paid > 0 THEN sb.amount_paid
    ELSE (sb.cost_price * sb.quantity_purchased)
  END AS amount_paid,
  CASE
    WHEN sk.id IS NOT NULL THEN sk.amount_remaining
    ELSE GREATEST(
      (sb.cost_price * sb.quantity_purchased) - (
        CASE
          WHEN pt.stock_batch_id IS NOT NULL THEN COALESCE(pt.cash_paid, 0) + COALESCE(pt.digital_paid, 0)
          WHEN sk.id IS NOT NULL THEN sk.amount_paid
          WHEN sb.amount_paid IS NOT NULL AND sb.amount_paid > 0 THEN sb.amount_paid
          ELSE (sb.cost_price * sb.quantity_purchased)
        END
      ),
      0
    )
  END AS amount_remaining,
  COALESCE(pt.cash_paid, 0) AS cash_paid,
  COALESCE(pt.digital_paid, 0) AS digital_paid
FROM public.stock_batches sb
LEFT JOIN public.products p ON p.id = sb.product_id
LEFT JOIN public.suppliers s ON s.id = sb.supplier_id
LEFT JOIN public.inventory_purchase_records ipr ON ipr.stock_batch_id = sb.id
LEFT JOIN public.managers m ON m.id = ipr.recorded_by
LEFT JOIN public.cashier_accounts ca ON ca.id = ipr.recorded_by_cashier_id
LEFT JOIN public.supplier_khaata sk ON sk.stock_batch_id = sb.id AND sk.store_id = sb.store_id
LEFT JOIN payment_totals pt ON pt.stock_batch_id = sb.id AND pt.store_id = sb.store_id;

COMMIT;
