-- RLS Policies BACKUP
-- Created: 2025-11-19

-- Enable Row Level Security
ALTER TABLE managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashier_accounts ENABLE ROW LEVEL SECURITY;

-- Managers table policies
CREATE POLICY "Authenticated users can view managers" ON managers
    FOR SELECT 
    USING (
        auth.role() = 'authenticated' 
        OR 
        EXISTS (SELECT 1 FROM managers WHERE managers.id = auth.uid())
    );

CREATE POLICY "Managers can update their own data" ON managers
    FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Anyone can create manager account" ON managers
    FOR INSERT 
    WITH CHECK (true);

-- Cashier accounts policies
CREATE POLICY "Anyone can view cashier accounts" ON cashier_accounts
    FOR SELECT 
    USING (true);

CREATE POLICY "Anyone can create cashier account" ON cashier_accounts
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Cashiers can update own data" ON cashier_accounts
    FOR UPDATE 
    USING (true);

-- Products policies
CREATE POLICY "Anyone authenticated can view products" ON products
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Managers can insert products" ON products
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM managers 
            WHERE managers.id = auth.uid()
        )
    );

CREATE POLICY "Managers can update products" ON products
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM managers 
            WHERE managers.id = auth.uid()
        )
    );

CREATE POLICY "Managers can delete products" ON products
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM managers 
            WHERE managers.id = auth.uid()
        )
    );

-- Sales policies
CREATE POLICY "Anyone authenticated can view sales" ON sales
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can create sales" ON sales
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Sale items policies
CREATE POLICY "Anyone authenticated can view sale items" ON sale_items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can insert sale items" ON sale_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Expenses policies
CREATE POLICY "Anyone authenticated can view expenses" ON expenses
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Managers can insert expenses" ON expenses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM managers 
            WHERE managers.id = auth.uid()
        )
    );

CREATE POLICY "Managers can update expenses" ON expenses
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM managers 
            WHERE managers.id = auth.uid()
        )
    );

CREATE POLICY "Managers can delete expenses" ON expenses
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM managers 
            WHERE managers.id = auth.uid()
        )
    );

-- Payments policies
CREATE POLICY "Anyone authenticated can view payments" ON payments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone authenticated can insert payments" ON payments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
