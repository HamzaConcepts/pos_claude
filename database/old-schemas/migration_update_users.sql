-- Migration to rename users table to managers and update structure
-- Run this after the initial schema.sql

-- Rename users table to managers
ALTER TABLE IF EXISTS users RENAME TO managers;

-- Add new columns if they don't exist
ALTER TABLE managers ADD COLUMN IF NOT EXISTS phone_number VARCHAR(11) UNIQUE;
ALTER TABLE managers ADD COLUMN IF NOT EXISTS store_name VARCHAR(100);

-- Drop username column if it exists
ALTER TABLE managers DROP COLUMN IF EXISTS username;

-- Drop role column since this table only contains managers
ALTER TABLE managers DROP COLUMN IF EXISTS role;

-- Ensure email is required for managers
ALTER TABLE managers ALTER COLUMN email SET NOT NULL;

-- Make phone_number NOT NULL
ALTER TABLE managers ALTER COLUMN phone_number SET NOT NULL;
