BEGIN;

CREATE TABLE IF NOT EXISTS public.store_cash_balances (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_cash_balances_store_unique UNIQUE (store_id),
  CONSTRAINT store_cash_balances_opening_cash_check CHECK (opening_cash >= 0)
);

COMMENT ON TABLE public.store_cash_balances IS 'Manual cash balance per store (opening balance for reconciliation)';

CREATE TABLE IF NOT EXISTS public.store_bank_balances (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  bank_account_id INTEGER NOT NULL REFERENCES public.store_bank_accounts(id) ON DELETE CASCADE,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT store_bank_balances_store_bank_unique UNIQUE (store_id, bank_account_id),
  CONSTRAINT store_bank_balances_opening_balance_check CHECK (opening_balance >= 0)
);

COMMENT ON TABLE public.store_bank_balances IS 'Manual per-bank opening balances for store bank accounts';

DROP TRIGGER IF EXISTS store_cash_balances_updated_at_trigger ON public.store_cash_balances;
CREATE TRIGGER store_cash_balances_updated_at_trigger
  BEFORE UPDATE ON public.store_cash_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS store_bank_balances_updated_at_trigger ON public.store_bank_balances;
CREATE TRIGGER store_bank_balances_updated_at_trigger
  BEFORE UPDATE ON public.store_bank_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_store_cash_balances_store_id
  ON public.store_cash_balances(store_id);

CREATE INDEX IF NOT EXISTS idx_store_bank_balances_store_id
  ON public.store_bank_balances(store_id);

CREATE INDEX IF NOT EXISTS idx_store_bank_balances_bank_account_id
  ON public.store_bank_balances(bank_account_id);

ALTER TABLE public.store_cash_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_bank_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cash balances from their store"
  ON public.store_cash_balances
  FOR SELECT
  TO authenticated
  USING (store_id = public.get_user_store_id());

CREATE POLICY "Users can insert cash balances in their store"
  ON public.store_cash_balances
  FOR INSERT
  TO authenticated
  WITH CHECK (store_id = public.get_user_store_id());

CREATE POLICY "Users can update cash balances in their store"
  ON public.store_cash_balances
  FOR UPDATE
  TO authenticated
  USING (store_id = public.get_user_store_id());

CREATE POLICY "Users can delete cash balances in their store"
  ON public.store_cash_balances
  FOR DELETE
  TO authenticated
  USING (store_id = public.get_user_store_id());

CREATE POLICY "Users can view bank balances from their store"
  ON public.store_bank_balances
  FOR SELECT
  TO authenticated
  USING (store_id = public.get_user_store_id());

CREATE POLICY "Users can insert bank balances in their store"
  ON public.store_bank_balances
  FOR INSERT
  TO authenticated
  WITH CHECK (store_id = public.get_user_store_id());

CREATE POLICY "Users can update bank balances in their store"
  ON public.store_bank_balances
  FOR UPDATE
  TO authenticated
  USING (store_id = public.get_user_store_id());

CREATE POLICY "Users can delete bank balances in their store"
  ON public.store_bank_balances
  FOR DELETE
  TO authenticated
  USING (store_id = public.get_user_store_id());

COMMIT;
