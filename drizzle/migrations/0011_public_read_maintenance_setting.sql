CREATE POLICY "public read maintenance status"
ON public.platform_settings
FOR SELECT
TO anon, authenticated
USING (key = 'maintenance');