-- POS System - Sample Data
-- Run this after creating the schema
-- Note: You'll need to manually create auth users in Supabase first, then insert into users table

-- Sample Products
INSERT INTO products (name, sku, description, price, cost_price, stock_quantity, low_stock_threshold, category) VALUES
('Product A', 'PRD-001', 'Sample product A description', 29.99, 15.00, 100, 10, 'Electronics'),
('Product B', 'PRD-002', 'Sample product B description', 49.99, 25.00, 5, 10, 'Electronics'),
('Product C', 'PRD-003', 'Sample product C description', 19.99, 10.00, 50, 15, 'Accessories'),
('Product D', 'PRD-004', 'Sample product D description', 39.99, 20.00, 75, 10, 'Electronics'),
('Product E', 'PRD-005', 'Sample product E description', 15.99, 8.00, 120, 20, 'Accessories'),
('Product F', 'PRD-006', 'Sample product F description', 59.99, 30.00, 8, 10, 'Premium'),
('Product G', 'PRD-007', 'Sample product G description', 24.99, 12.00, 90, 15, 'Accessories'),
('Product H', 'PRD-008', 'Sample product H description', 89.99, 45.00, 3, 5, 'Premium'),
('Product I', 'PRD-009', 'Sample product I description', 12.99, 6.00, 200, 25, 'Basic'),
('Product J', 'PRD-010', 'Sample product J description', 34.99, 17.50, 60, 10, 'Electronics');

-- Note: To create test users, you need to:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User" and create users with these details:
--
-- Manager:
--   Email: manager@pos.com
--   Password: Manager@123
--   Then insert into users table:
--   INSERT INTO users (id, username, email, role, full_name) 
--   VALUES ('<uuid-from-auth>', 'manager', 'manager@pos.com', 'Manager', 'Store Manager');
--
-- Admin:
--   Email: admin@pos.com
--   Password: Admin@123
--   Then insert into users table:
--   INSERT INTO users (id, username, email, role, full_name) 
--   VALUES ('<uuid-from-auth>', 'admin', 'admin@pos.com', 'Admin', 'Admin User');
--
-- Cashier:
--   Email: cashier@pos.com
--   Password: Cashier@123
--   Then insert into users table:
--   INSERT INTO users (id, username, email, role, full_name) 
--   VALUES ('<uuid-from-auth>', 'cashier', 'cashier@pos.com', 'Cashier', 'Cashier User');

-- Sample data will be added in later phases for sales, expenses, etc.
