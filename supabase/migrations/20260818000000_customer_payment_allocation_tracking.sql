ALTER TABLE public.customer_payments
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS transaction_remaining_before numeric(10,2),
  ADD COLUMN IF NOT EXISTS transaction_remaining_after numeric(10,2),
  ADD COLUMN IF NOT EXISTS customer_remaining_before numeric(10,2),
  ADD COLUMN IF NOT EXISTS customer_remaining_after numeric(10,2);

COMMENT ON COLUMN public.customer_payments.payment_reference IS 'Reference for the grouped payment allocation across customer transactions.';
COMMENT ON COLUMN public.customer_payments.transaction_remaining_before IS 'Remaining balance on the specific transaction before this payment allocation was applied.';
COMMENT ON COLUMN public.customer_payments.transaction_remaining_after IS 'Remaining balance on the specific transaction after this payment allocation was applied.';
COMMENT ON COLUMN public.customer_payments.customer_remaining_before IS 'Remaining customer balance before this payment allocation was applied.';
COMMENT ON COLUMN public.customer_payments.customer_remaining_after IS 'Remaining customer balance after this payment allocation was applied.';
