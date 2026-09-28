
-- Fix payment-proofs storage policies
-- Drop any existing overly broad policies
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read own payment proofs" ON storage.objects;

-- Users can upload their own payment proofs
CREATE POLICY "Users upload own payment proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can read only their own payment proofs
CREATE POLICY "Users read own payment proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Club admins can read payment proofs from their club members
CREATE POLICY "Club admins read payment proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM public.clubs
    WHERE owner_id = auth.uid()
  )
);

-- Users can update their own payment proofs
CREATE POLICY "Users update own payment proofs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own payment proofs
CREATE POLICY "Users delete own payment proofs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
