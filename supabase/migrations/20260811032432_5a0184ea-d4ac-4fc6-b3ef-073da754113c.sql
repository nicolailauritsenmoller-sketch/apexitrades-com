CREATE POLICY "security reports own upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'security-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "security reports own read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'security-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "security reports staff read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'security-reports' AND private.is_staff(auth.uid()));