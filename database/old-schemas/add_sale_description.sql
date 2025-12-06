-- Migration: Add sale_description column to sales table
-- Run this in your Supabase SQL Editor to update existing database

-- Add the sale_description column
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_description VARCHAR(255);

-- Optionally, populate existing records with sale_number as description
-- (You can skip this if you want existing sales to show sale_number)
-- UPDATE sales SET sale_description = sale_number WHERE sale_description IS NULL;

-- Verify the change
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'sales' AND column_name = 'sale_description';
