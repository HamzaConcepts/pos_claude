-- Migration: Add Categories and Subcategories to Store Management
-- Run this in your Supabase SQL Editor

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, name)
);

-- Subcategories Table
CREATE TABLE IF NOT EXISTS subcategories (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, name)
);

-- Add store_code to stores table if it doesn't exist
-- Note: Assuming there's a stores table, or we'll add it to managers table
ALTER TABLE managers ADD COLUMN IF NOT EXISTS store_code VARCHAR(20) UNIQUE;

-- Update products table to use category_id and subcategory_id instead of text
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_id INTEGER;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_is_active ON subcategories(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON products(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);

-- Create updated_at triggers
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subcategories_updated_at BEFORE UPDATE ON subcategories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for categories
CREATE POLICY "Anyone authenticated can view categories" ON categories
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Managers can insert categories" ON categories
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM managers 
            WHERE managers.id = auth.uid()
        )
    );

CREATE POLICY "Managers can update categories" ON categories
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM managers 
            WHERE managers.id = auth.uid()
        )
    );

CREATE POLICY "Managers can delete categories" ON categories
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM managers 
            WHERE managers.id = auth.uid()
        )
    );

-- RLS Policies for subcategories
CREATE POLICY "Anyone authenticated can view subcategories" ON subcategories
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Managers can insert subcategories" ON subcategories
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM managers 
            WHERE managers.id = auth.uid()
        )
    );

CREATE POLICY "Managers can update subcategories" ON subcategories
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM managers 
            WHERE managers.id = auth.uid()
        )
    );

CREATE POLICY "Managers can delete subcategories" ON subcategories
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM managers 
            WHERE managers.id = auth.uid()
        )
    );
