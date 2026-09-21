ALTER POLICY "Admins manage user notes"
ON public.admin_user_notes
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins manage community announcements"
ON public.community_announcements
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Published community announcements are public"
ON public.community_announcements
USING (status = 'published');

ALTER POLICY "Admins manage community channels"
ON public.community_channels
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins review community requests"
ON public.community_vip_requests
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Members read own community requests"
ON public.community_vip_requests
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Users read their own referrals"
ON public.referrals
USING (referrer_id = auth.uid() OR referee_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Staff read all replay chunks"
ON public.session_replays
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'agent'::public.app_role)
);

ALTER POLICY "Staff read all activity"
ON public.user_activity_logs
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR private.has_role(auth.uid(), 'agent'::public.app_role)
  OR private.has_role(auth.uid(), 'finance'::public.app_role)
);