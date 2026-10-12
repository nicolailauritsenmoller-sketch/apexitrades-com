ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS leverage numeric NOT NULL DEFAULT 1;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_leverage_allowed CHECK (leverage IN (1,2,5,10));