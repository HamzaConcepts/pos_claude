-- Migration: Allow shared cashier accounts without phone numbers
-- Date: 2026-04-17

-- Shared cashier accounts created from the store signup flow do not require a phone.
ALTER TABLE public.cashier_accounts
  ALTER COLUMN phone_number DROP NOT NULL;

-- Normalize blank values to NULL to avoid collisions with UNIQUE(phone_number).
UPDATE public.cashier_accounts
SET phone_number = NULL
WHERE phone_number IS NOT NULL
  AND btrim(phone_number) = '';
