-- Create a function to verify cashier login with password hashing
-- This function uses crypt() to compare the hashed password

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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION verify_cashier_login(TEXT, TEXT) TO anon, authenticated;
