-- Remove inventory purchase rows from expenses
-- This keeps expenses limited to operating costs.

BEGIN;

DELETE FROM public.expenses
WHERE category IN ('new_product', 'inventory_restock');

COMMIT;
