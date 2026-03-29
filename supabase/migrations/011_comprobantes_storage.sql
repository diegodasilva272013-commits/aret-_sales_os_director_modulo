-- Create storage bucket for comprobantes (proof of payment)
-- Run this in Supabase Dashboard > SQL Editor

INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload comprobantes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comprobantes');

-- Allow authenticated users to read comprobantes
CREATE POLICY "Authenticated users can read comprobantes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'comprobantes');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own comprobantes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'comprobantes');
