ALTER TABLE public.deposit_addresses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS allocation_mode text NOT NULL DEFAULT 'master';
UPDATE public.deposit_addresses SET status = CASE WHEN active THEN 'active' ELSE 'paused' END;
ALTER TABLE public.deposit_addresses
  ADD CONSTRAINT deposit_addresses_status_chk CHECK (status IN ('active','paused','deprecated')),
  ADD CONSTRAINT deposit_addresses_alloc_chk CHECK (allocation_mode IN ('master','hot_sweep','vip_desk'));