-- Backfill legacy sales timestamps that were written with the old PKT helper.
--
-- This migration normalizes already-created records by subtracting 5 hours from
-- the legacy stored wall-clock values so they line up with UTC-based storage.
-- It should be run once on the existing database.

BEGIN;

UPDATE public.sales
SET sale_date = sale_date - INTERVAL '5 hours'
WHERE sale_date IS NOT NULL;

UPDATE public.payments
SET payment_date = payment_date - INTERVAL '5 hours'
WHERE payment_date IS NOT NULL;

UPDATE public.product_imeis
SET sold_at = sold_at - INTERVAL '5 hours'
WHERE sold_at IS NOT NULL;

COMMIT;