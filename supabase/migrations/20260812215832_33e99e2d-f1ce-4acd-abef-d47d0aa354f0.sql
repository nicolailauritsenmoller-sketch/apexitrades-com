CREATE POLICY "Staff can manage certificate files"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'certificates' AND private.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'certificates' AND private.is_staff(auth.uid()));