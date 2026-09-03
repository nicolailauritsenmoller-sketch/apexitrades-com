ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text;

DROP POLICY IF EXISTS "support attachments own read" ON storage.objects;
DROP POLICY IF EXISTS "support attachments own write" ON storage.objects;
DROP POLICY IF EXISTS "support attachments staff read" ON storage.objects;
DROP POLICY IF EXISTS "support attachments staff write" ON storage.objects;

CREATE POLICY "support attachments own read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "support attachments own write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "support attachments staff read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'support-attachments' AND private.is_staff(auth.uid()));

CREATE POLICY "support attachments staff write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'support-attachments' AND private.is_staff(auth.uid()));