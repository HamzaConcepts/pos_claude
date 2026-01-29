-- Fix cashier login to require exact name match (not partial)
-- This prevents "Hamza" from matching "hamza_cashier"

CREATE OR REPLACE FUNCTION verify_cashier_login(
    identifier TEXT,
    password_input TEXT
)
RETURNS TABLE(
    id INTEGER,
    full_name VARCHAR,
    phone_number VARCHAR,
    store_id INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.full_name,
        c.phone_number,
        c.store_id
    FROM cashier_accounts c
    WHERE 
        -- Exact match on full_name (case-insensitive) OR exact match on phone_number
        (LOWER(c.full_name) = LOWER(identifier) OR c.phone_number = identifier)
        AND c.password_hash = crypt(password_input, c.password_hash)
        AND c.is_active = true
        AND c.store_id IS NOT NULL; -- Only allow login if assigned to store
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_cashier_login(TEXT, TEXT) TO anon, authenticated, service_role;
