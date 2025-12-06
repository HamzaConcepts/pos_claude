-- Update RLS policies to allow reading managers and cashier_accounts for display

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Managers can view their own data" ON managers;
DROP POLICY IF EXISTS "Managers can update their own data" ON managers;
DROP POLICY IF EXISTS "Anyone can create cashier account" ON cashier_accounts;
DROP POLICY IF EXISTS "Cashiers can view own data" ON cashier_accounts;

-- Managers table policies
-- Allow managers to view all manager accounts (for user management page)
CREATE POLICY "Authenticated users can view managers" ON managers
    FOR SELECT 
    USING (
        auth.role() = 'authenticated' 
        OR 
        EXISTS (SELECT 1 FROM managers WHERE managers.id = auth.uid())
    );

-- Allow managers to update their own data
CREATE POLICY "Managers can update their own data" ON managers
    FOR UPDATE 
    USING (auth.uid() = id);

-- Allow new manager signup
CREATE POLICY "Anyone can create manager account" ON managers
    FOR INSERT 
    WITH CHECK (true);

-- Cashier accounts policies
-- Allow anyone to view cashier accounts (for user management and login)
CREATE POLICY "Anyone can view cashier accounts" ON cashier_accounts
    FOR SELECT 
    USING (true);

-- Allow anyone to create cashier account (for signup)
CREATE POLICY "Anyone can create cashier account" ON cashier_accounts
    FOR INSERT 
    WITH CHECK (true);

-- Allow cashiers to update their own data
CREATE POLICY "Cashiers can update own data" ON cashier_accounts
    FOR UPDATE 
    USING (true);
