ALTER TABLE public.customer_payments
ADD COLUMN IF NOT EXISTS bank_account_name text;

ALTER TABLE public.supplier_khaata_payments
ADD COLUMN IF NOT EXISTS bank_account_name text;

ALTER TABLE public.supplier_payments
ADD COLUMN IF NOT EXISTS bank_account_name text;

COMMENT ON COLUMN public.customer_payments.bank_account_name IS 'Bank account name for digital customer ledger payments.';
COMMENT ON COLUMN public.supplier_khaata_payments.bank_account_name IS 'Bank account name for digital supplier ledger payments.';
COMMENT ON COLUMN public.supplier_payments.bank_account_name IS 'Bank account name for digital supplier payments.';
