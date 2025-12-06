-- POS System - Sample Data
-- Run this after creating the schema

-- Sample Products (Master Catalog)
INSERT INTO products (sku, name, description, category, is_active) VALUES
('PRD-001', 'Product A', 'Sample product A description', 'Electronics', TRUE),
('PRD-002', 'Product B', 'Sample product B description', 'Electronics', TRUE),
('PRD-003', 'Product C', 'Sample product C description', 'Accessories', TRUE),
('PRD-004', 'Product D', 'Sample product D description', 'Electronics', TRUE),
('PRD-005', 'Product E', 'Sample product E description', 'Accessories', TRUE),
('PRD-006', 'Product F', 'Sample product F description', 'Premium', TRUE),
('PRD-007', 'Product G', 'Sample product G description', 'Accessories', TRUE),
('PRD-008', 'Product H', 'Sample product H description', 'Premium', TRUE),
('PRD-009', 'Product I', 'Sample product I description', 'Basic', TRUE),
('PRD-010', 'Product J', 'Sample product J description', 'Electronics', TRUE);

-- Sample Inventory (Current Stock)
INSERT INTO inventory (product_id, cost_price, selling_price, quantity_added, quantity_remaining, low_stock_threshold, batch_number) VALUES
(1, 15.00, 29.99, 100, 100, 10, 'BATCH-001'),
(2, 25.00, 49.99, 5, 5, 10, 'BATCH-002'),
(3, 10.00, 19.99, 50, 50, 15, 'BATCH-003'),
(4, 20.00, 39.99, 75, 75, 10, 'BATCH-004'),
(5, 8.00, 15.99, 120, 120, 20, 'BATCH-005'),
(6, 30.00, 59.99, 8, 8, 10, 'BATCH-006'),
(7, 12.00, 24.99, 90, 90, 15, 'BATCH-007'),
(8, 45.00, 89.99, 3, 3, 5, 'BATCH-008'),
(9, 6.00, 12.99, 200, 200, 25, 'BATCH-009'),
(10, 17.50, 34.99, 60, 60, 10, 'BATCH-010');

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
