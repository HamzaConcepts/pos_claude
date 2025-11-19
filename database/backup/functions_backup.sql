-- Database Functions BACKUP
-- Created: 2025-11-19

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Cashier login verification function
CREATE OR REPLACE FUNCTION verify_cashier_login(
    identifier TEXT,
    password_input TEXT
)
RETURNS TABLE (
    id INTEGER,
    full_name VARCHAR(100),
    phone_number VARCHAR(11)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.full_name,
        c.phone_number
    FROM cashier_accounts c
    WHERE 
        (c.full_name ILIKE '%' || identifier || '%' OR c.phone_number = identifier)
        AND c.password_hash = crypt(password_input, c.password_hash)
        AND c.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
