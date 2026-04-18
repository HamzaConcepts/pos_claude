-- Fixes sale deletion failures in revert_sale_deletion() by using canonical
-- stock_batches columns from the current schema.

CREATE OR REPLACE FUNCTION public.revert_sale_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  sale_item RECORD;
  batch_record RECORD;
  remaining_qty INTEGER;
  restorable_qty INTEGER;
BEGIN
  -- For each item in the deleted sale, restore stock.
  FOR sale_item IN
    SELECT si.product_id, si.quantity
    FROM sale_items si
    WHERE si.sale_id = OLD.id
  LOOP
    remaining_qty := sale_item.quantity;

    FOR batch_record IN
      SELECT id,
             COALESCE(quantity_remaining, 0)::int AS quantity_remaining,
             COALESCE(quantity_purchased, 0)::int AS quantity_purchased
      FROM stock_batches
      WHERE product_id = sale_item.product_id
        AND store_id = OLD.store_id
      ORDER BY purchase_date DESC, id DESC
    LOOP
      EXIT WHEN remaining_qty <= 0;

      restorable_qty := LEAST(
        remaining_qty,
        GREATEST(batch_record.quantity_purchased - batch_record.quantity_remaining, 0)
      );

      IF restorable_qty > 0 THEN
        UPDATE stock_batches
        SET quantity_remaining = COALESCE(quantity_remaining, 0) + restorable_qty
        WHERE id = batch_record.id;

        remaining_qty := remaining_qty - restorable_qty;
      END IF;
    END LOOP;

    -- Restore IMEI records for deleted sales.
    UPDATE product_imeis
    SET status = 'in_stock',
        sold_at = NULL,
        sale_id = NULL
    WHERE sale_id = OLD.id
      AND product_id = sale_item.product_id;
  END LOOP;

  UPDATE stock_batches
  SET
    is_depleted = CASE WHEN COALESCE(quantity_remaining, 0) <= 0 THEN TRUE ELSE FALSE END,
    depleted_at = CASE
      WHEN COALESCE(quantity_remaining, 0) <= 0 THEN COALESCE(depleted_at, NOW())
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE store_id = OLD.store_id
    AND product_id IN (SELECT product_id FROM sale_items WHERE sale_id = OLD.id);

  RETURN OLD;
END;
$function$;

COMMENT ON FUNCTION public.revert_sale_deletion() IS 'Restores stock quantities when a sale is deleted.';
