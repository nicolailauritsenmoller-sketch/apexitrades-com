-- Allow users to resubmit their own KYC documents by updating their existing row,
-- provided the new row resets status back to 'pending'.
DROP POLICY IF EXISTS "own kyc update pending" ON public.kyc_submissions;
CREATE POLICY "own kyc update resubmit" ON public.kyc_submissions
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND status = 'pending');