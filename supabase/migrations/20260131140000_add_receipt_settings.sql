-- Receipt Settings Table
-- Stores store-specific receipt configuration including branding, format preferences, and footer messages

CREATE TABLE IF NOT EXISTS public.receipt_settings (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    -- Business Information
    business_name TEXT NOT NULL DEFAULT 'My Store',
    business_address TEXT,
    business_phone TEXT,
    business_email TEXT,
    tax_id TEXT,
    logo_url TEXT,
    -- Receipt Preferences
    default_format TEXT NOT NULL DEFAULT 'pdf' CHECK (default_format IN ('pdf', 'thermal')),
    thermal_paper_width TEXT NOT NULL DEFAULT '80mm' CHECK (thermal_paper_width IN ('58mm', '80mm')),
    auto_print BOOLEAN NOT NULL DEFAULT false,
    show_logo BOOLEAN NOT NULL DEFAULT true,
    show_tax_id BOOLEAN NOT NULL DEFAULT true,
    -- Footer Messages
    thank_you_message TEXT NOT NULL DEFAULT 'Thank you for your purchase!',
    return_policy TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Each store can only have one receipt settings row
    CONSTRAINT receipt_settings_store_unique UNIQUE (store_id)
);

-- Enable RLS
ALTER TABLE public.receipt_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Managers can read/write their store's receipt settings
CREATE POLICY "Managers can manage receipt settings"
    ON public.receipt_settings
    FOR ALL
    USING (
        store_id IN (
            SELECT store_id FROM public.managers WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        store_id IN (
            SELECT store_id FROM public.managers WHERE id = auth.uid()
        )
    );

-- RLS Policy: Cashiers can read receipt settings (needed for printing)
CREATE POLICY "Cashiers can view receipt settings"
    ON public.receipt_settings
    FOR SELECT
    USING (
        store_id IN (
            SELECT store_id FROM public.cashier_accounts WHERE id = ANY(
                SELECT (current_setting('app.cashier_id', true))::integer WHERE current_setting('app.cashier_id', true) IS NOT NULL AND current_setting('app.cashier_id', true) != ''
            )
        )
        OR
        store_id IN (
            SELECT store_id FROM public.managers WHERE id = auth.uid()
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_receipt_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS receipt_settings_updated_at_trigger ON public.receipt_settings;
CREATE TRIGGER receipt_settings_updated_at_trigger
    BEFORE UPDATE ON public.receipt_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_receipt_settings_updated_at();

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_receipt_settings_store_id ON public.receipt_settings(store_id);

-- Insert default settings for existing stores (optional - uncomment if needed)
-- INSERT INTO public.receipt_settings (store_id, business_name)
-- SELECT id, name FROM public.stores
-- ON CONFLICT (store_id) DO NOTHING;

COMMENT ON TABLE public.receipt_settings IS 'Stores receipt printing configuration for each store including branding and preferences';
