-- Migration: Add logo_url column to stores table and create store-logos storage bucket
-- Date: 2026-02-01

-- 1. Add logo_url column to stores table
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Create the store-logos storage bucket (public read, authenticated upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-logos',
  'store-logos',
  true,
  5242880,  -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for the store-logos bucket

-- Allow public read access to all logos
CREATE POLICY "Public read access for store logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-logos');

-- Allow authenticated users (service role) to upload logos
CREATE POLICY "Service role upload for store logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'store-logos');

-- Allow authenticated users (service role) to update logos
CREATE POLICY "Service role update for store logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'store-logos');

-- Allow authenticated users (service role) to delete logos
CREATE POLICY "Service role delete for store logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'store-logos');
