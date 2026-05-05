-- Create inventory purchase records and view

BEGIN;

CREATE TABLE IF NOT EXISTS public.inventory_purchase_records (
  id serial PRIMARY KEY,
  stock_batch_id integer NOT NULL UNIQUE REFERENCES public.stock_batches(id) ON DELETE CASCADE,
  store_id integer NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  recorded_by uuid,
  recorded_by_cashier_id integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inventory_purchase_records_recorder_check
    CHECK (
      (recorded_by IS NULL AND recorded_by_cashier_id IS NULL)
      OR (recorded_by IS NOT NULL AND recorded_by_cashier_id IS NULL)
      OR (recorded_by IS NULL AND recorded_by_cashier_id IS NOT NULL)
    )
);

INSERT INTO public.inventory_purchase_records (stock_batch_id, store_id)
SELECT sb.id, sb.store_id
FROM public.stock_batches sb
LEFT JOIN public.inventory_purchase_records ipr ON ipr.stock_batch_id = sb.id
WHERE ipr.stock_batch_id IS NULL;

CREATE OR REPLACE VIEW public.inventory_purchases_view AS
SELECT
  sb.id,
  sb.store_id,
  sb.product_id,
  sb.batch_number,
  sb.cost_price,
  sb.quantity_purchased,
  sb.purchase_date,
  sb.payment_method,
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
  COALESCE(sk.amount_paid, sb.cost_price * sb.quantity_purchased) AS amount_paid,
  COALESCE(sk.amount_remaining, 0) AS amount_remaining
FROM public.stock_batches sb
LEFT JOIN public.products p ON p.id = sb.product_id
LEFT JOIN public.suppliers s ON s.id = sb.supplier_id
LEFT JOIN public.inventory_purchase_records ipr ON ipr.stock_batch_id = sb.id
LEFT JOIN public.managers m ON m.id = ipr.recorded_by
LEFT JOIN public.cashier_accounts ca ON ca.id = ipr.recorded_by_cashier_id
LEFT JOIN public.supplier_khaata sk ON sk.stock_batch_id = sb.id AND sk.store_id = sb.store_id;

COMMIT;
