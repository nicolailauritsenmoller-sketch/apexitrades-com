CREATE POLICY "proof own upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'deposit-proofs' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "proof own read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'deposit-proofs' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "proof admin read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'deposit-proofs' AND private.has_role(auth.uid(), 'admin'::app_role));