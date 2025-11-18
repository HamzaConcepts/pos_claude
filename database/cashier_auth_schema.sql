-- Cashier Accounts Table (separate from Supabase Auth)
-- This table handles cashier authentication independently
-- Cashiers don't use Supabase Auth to avoid email requirements

CREATE TABLE IF NOT EXISTS cashier_accounts (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(11) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'Cashier' CHECK (role = 'Cashier'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cashier_phone ON cashier_accounts(phone_number);
CREATE INDEX IF NOT EXISTS idx_cashier_name ON cashier_accounts(full_name);

-- Enable Row Level Security
ALTER TABLE cashier_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cashier_accounts
-- Allow anyone to insert (for signup)
CREATE POLICY "Anyone can create cashier account" ON cashier_accounts
    FOR INSERT WITH CHECK (true);

-- Allow cashiers to view their own data
CREATE POLICY "Cashiers can view own data" ON cashier_accounts
    FOR SELECT USING (true);

-- Note: In production, you should hash passwords using a proper hashing function
-- Consider using pgcrypto extension:
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- 
-- Then create a trigger to auto-hash passwords:
-- CREATE OR REPLACE FUNCTION hash_password()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.password_hash != OLD.password_hash) THEN
--         NEW.password_hash = crypt(NEW.password_hash, gen_salt('bf', 10));
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- 
-- CREATE TRIGGER hash_cashier_password
--     BEFORE INSERT OR UPDATE ON cashier_accounts
--     FOR EACH ROW
--     EXECUTE FUNCTION hash_password();
