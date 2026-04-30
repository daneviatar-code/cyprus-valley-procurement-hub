
-- Catalog products table
CREATE TABLE public.catalog_products (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  image_url text,
  unit_price_eur numeric,
  supplier_id text,
  supplier_name text NOT NULL DEFAULT '',
  discipline text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT 'Indoor',
  sku text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open access" ON public.catalog_products FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for catalog product images
INSERT INTO storage.buckets (id, name, public) VALUES ('catalog-images', 'catalog-images', true);

CREATE POLICY "Public read catalog images" ON storage.objects FOR SELECT USING (bucket_id = 'catalog-images');
CREATE POLICY "Public insert catalog images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'catalog-images');
CREATE POLICY "Public update catalog images" ON storage.objects FOR UPDATE USING (bucket_id = 'catalog-images');
CREATE POLICY "Public delete catalog images" ON storage.objects FOR DELETE USING (bucket_id = 'catalog-images');
