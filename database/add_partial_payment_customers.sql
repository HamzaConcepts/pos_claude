-- Migration: Add partial_payment_customers table
-- Run this in your Supabase SQL Editor to update existing database

-- Create Partial Payment Customers Table
CREATE TABLE IF NOT EXISTS partial_payment_customers (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    customer_name VARCHAR(100) NOT NULL,
    customer_cnic VARCHAR(20),
    customer_phone VARCHAR(20),
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
    amount_paid DECIMAL(10, 2) NOT NULL CHECK (amount_paid >= 0),
    amount_remaining DECIMAL(10, 2) NOT NULL CHECK (amount_remaining >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_partial_payment_customers_sale_id ON partial_payment_customers(sale_id);

-- Create updated_at trigger
CREATE TRIGGER update_partial_payment_customers_updated_at 
BEFORE UPDATE ON partial_payment_customers 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify the change
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'partial_payment_customers';
