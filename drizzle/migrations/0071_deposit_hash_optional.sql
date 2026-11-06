CREATE OR REPLACE FUNCTION public.settle_deposit_atomic(p_id uuid,p_status text,p_note text,p_reviewer uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.deposits; h text; n text;
BEGIN
 IF p_status NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid settlement status'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_reviewer AND role IN ('admin','finance')) THEN RAISE EXCEPTION 'Finance access required'; END IF;
 SELECT * INTO d FROM public.deposits WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR d.status<>'pending' THEN RETURN jsonb_build_object('settled',false); END IF;
 IF p_status='approved' THEN
  n:=upper(trim(d.network)); h:=trim(coalesce(d.tx_hash,''));
  IF h<>'' THEN
   IF n IN ('ERC20','BEP20','BASE','BITCOIN','BTC') THEN h:=lower(h); END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended(n||':'||upper(d.coin)||':'||h,0));
   IF EXISTS(SELECT 1 FROM public.deposits WHERE id<>d.id AND status='approved' AND upper(trim(network))=n AND upper(coin)=upper(d.coin) AND CASE WHEN n IN ('ERC20','BEP20','BASE','BITCOIN','BTC') THEN lower(trim(tx_hash)) ELSE trim(tx_hash) END=h) THEN RAISE EXCEPTION 'This transfer has already been credited'; END IF;
   INSERT INTO public.credited_deposit_transfers(network,coin,transfer_id,deposit_id) VALUES(n,upper(d.coin),h,d.id);
  END IF;
 END IF;
 UPDATE public.deposits SET status=p_status::request_status,admin_note=p_note,reviewed_by=p_reviewer,reviewed_at=now() WHERE id=p_id;
 IF p_status='approved' THEN
  PERFORM public.wallet_adjust(d.user_id,d.coin,d.amount);
  INSERT INTO public.notifications(user_id,title,body,kind) VALUES(d.user_id,'Deposit settled',d.amount||' '||d.coin||' ('||d.network||') - clearing complete.','success');
 ELSE INSERT INTO public.notifications(user_id,title,body,kind) VALUES(d.user_id,'Deposit compliance check failed','Your deposit could not be approved. Contact support for details.','warning'); END IF;
 RETURN jsonb_build_object('settled',true,'user_id',d.user_id,'amount',d.amount,'coin',d.coin,'network',d.network,'tx_hash',d.tx_hash);
END $$;
REVOKE EXECUTE ON FUNCTION public.settle_deposit_atomic(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_deposit_atomic(uuid,text,text,uuid) TO service_role;