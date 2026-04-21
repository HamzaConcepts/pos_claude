-- Add store-level bank account management and digital sale bank account tracking.

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS bank_account_name TEXT;

COMMENT ON COLUMN public.sales.bank_account_name IS 'Store-defined bank account used for digital payment sales';

CREATE TABLE IF NOT EXISTS public.store_bank_accounts (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    account_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT store_bank_accounts_store_account_unique UNIQUE (store_id, account_name),
    CONSTRAINT store_bank_accounts_account_name_not_blank CHECK (LENGTH(BTRIM(account_name)) > 0)
);

COMMENT ON TABLE public.store_bank_accounts IS 'Store-managed list of bank account names used for digital POS payments';

DROP TRIGGER IF EXISTS store_bank_accounts_updated_at_trigger ON public.store_bank_accounts;
CREATE TRIGGER store_bank_accounts_updated_at_trigger
    BEFORE UPDATE ON public.store_bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_store_bank_accounts_store_id
    ON public.store_bank_accounts(store_id);

CREATE INDEX IF NOT EXISTS idx_sales_store_payment_bank_account
    ON public.sales(store_id, payment_method, bank_account_name);

ALTER TABLE public.store_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bank accounts from their store"
    ON public.store_bank_accounts
    FOR SELECT
    TO authenticated
    USING (store_id = public.get_user_store_id());

CREATE POLICY "Users can insert bank accounts in their store"
    ON public.store_bank_accounts
    FOR INSERT
    TO authenticated
    WITH CHECK (store_id = public.get_user_store_id());

CREATE POLICY "Users can update bank accounts in their store"
    ON public.store_bank_accounts
    FOR UPDATE
    TO authenticated
    USING (store_id = public.get_user_store_id());

CREATE POLICY "Users can delete bank accounts in their store"
    ON public.store_bank_accounts
    FOR DELETE
    TO authenticated
    USING (store_id = public.get_user_store_id());
