-- ============================================================
-- Supabase Storage — Vision Board Image Bucket
-- Run this in your Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('vision-board', 'vision-board', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Authenticated users can upload vision board images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vision-board'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to read their own images
CREATE POLICY "Users can read own vision board images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vision-board'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read (so image_url works without auth headers)
CREATE POLICY "Public read for vision board images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'vision-board');

-- Allow users to delete their own images
CREATE POLICY "Users can delete own vision board images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vision-board'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
