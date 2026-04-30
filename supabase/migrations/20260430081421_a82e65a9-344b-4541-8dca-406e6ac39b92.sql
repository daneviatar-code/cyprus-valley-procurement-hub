CREATE TABLE public.packages (
  id text NOT NULL PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  block text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  room_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open access" ON public.packages FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_packages_block ON public.packages(block);