BEGIN;

ALTER TABLE IF EXISTS public.cash_transfers
  ADD COLUMN IF NOT EXISTS transfer_direction TEXT NOT NULL DEFAULT 'cash_to_bank';

UPDATE public.cash_transfers
SET transfer_direction = COALESCE(transfer_direction, 'cash_to_bank')
WHERE transfer_direction IS NULL;

COMMIT;