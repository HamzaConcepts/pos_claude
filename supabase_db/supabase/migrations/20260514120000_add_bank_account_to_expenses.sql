ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS bank_account_name text;

COMMENT ON COLUMN public.expenses.bank_account_name IS 'Bank account name for digital expenses.';
