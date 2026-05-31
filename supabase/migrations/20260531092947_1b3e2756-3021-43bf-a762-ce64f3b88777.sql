ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS buildings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS unit_coverage jsonb NOT NULL DEFAULT '{}'::jsonb;