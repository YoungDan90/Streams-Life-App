-- ============================================================
-- Supabase Storage — Vision Board Images (PRIVATE bucket)
-- Run this in your Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- Create the private storage bucket (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vision-board-images',
  'vision-board-images',
  false,   -- NOT publicly accessible without authentication
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public            = false,
  file_size_limit   = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

-- ── RLS Policies ──────────────────────────────────────────────

-- Allow authenticated users to upload to their own folder (userId/*)
CREATE POLICY IF NOT EXISTS "Users can upload own vision board images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vision-board-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to read their own images
CREATE POLICY IF NOT EXISTS "Users can read own vision board images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vision-board-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own images
CREATE POLICY IF NOT EXISTS "Users can delete own vision board images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vision-board-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Notes ─────────────────────────────────────────────────────
-- The app stores the storage PATH (e.g. "userId/1234.jpg") in
-- vision_board_items.image_url, NOT a full public URL.
-- Images are retrieved using createSignedUrls() which generates
-- time-limited authenticated URLs (1 year TTL) at display time.
-- This keeps images private while still allowing the owner to view them.
