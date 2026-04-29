
-- Suppliers
CREATE TABLE public.suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  contact_person TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  payment_terms TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'EUR',
  notes TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Furniture',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

-- Standard items
CREATE TABLE public.standard_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL DEFAULT '',
  item_name TEXT NOT NULL DEFAULT '',
  spec TEXT NOT NULL DEFAULT '',
  dimensions TEXT,
  unit_price_eur NUMERIC,
  supplier_id TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.standard_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.standard_items FOR ALL USING (true) WITH CHECK (true);

-- Apartment-type quantities
CREATE TABLE public.apartment_type_quantities (
  id TEXT PRIMARY KEY,
  standard_item_id TEXT NOT NULL,
  apartment_type TEXT NOT NULL,
  qty_per_package INTEGER NOT NULL DEFAULT 0,
  spare_per_package INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '',
  ordered_qty INTEGER NOT NULL DEFAULT 0,
  delivered_qty INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.apartment_type_quantities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.apartment_type_quantities FOR ALL USING (true) WITH CHECK (true);

-- Public area nodes
CREATE TABLE public.public_area_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  name_he TEXT,
  type TEXT NOT NULL,
  parent_id TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.public_area_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.public_area_nodes FOR ALL USING (true) WITH CHECK (true);

-- Public area items
CREATE TABLE public.public_area_items (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  zone_id TEXT,
  item_name TEXT NOT NULL DEFAULT '',
  spec TEXT NOT NULL DEFAULT '',
  category_id TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 0,
  spare INTEGER NOT NULL DEFAULT 0,
  supplier_id TEXT,
  unit_price_eur NUMERIC,
  status TEXT NOT NULL DEFAULT '',
  ordered_qty INTEGER NOT NULL DEFAULT 0,
  delivered_qty INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.public_area_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.public_area_items FOR ALL USING (true) WITH CHECK (true);

-- Public area plans (floor plans / images attached to nodes)
CREATE TABLE public.public_area_plans (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.public_area_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access" ON public.public_area_plans FOR ALL USING (true) WITH CHECK (true);
