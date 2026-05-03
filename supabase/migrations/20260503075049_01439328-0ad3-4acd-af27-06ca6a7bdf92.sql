CREATE TABLE public.categories (
  id text PRIMARY KEY,
  name_en text NOT NULL DEFAULT '',
  name_he text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT 'both',
  "order" integer NOT NULL DEFAULT 0,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open access" ON public.categories FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.categories (id, name_en, name_he, scope, "order") VALUES
  ('cat_linens',                'Linens',                'לובנה',                       'apartments', 1),
  ('cat_appliances',            'Appliances',            'מוצרי חשמל',                  'both',       2),
  ('cat_lighting',              'Lighting',              'תאורה',                       'both',       3),
  ('cat_air_conditioners',      'Air Conditioners',      'מזגנים',                      'both',       4),
  ('cat_televisions',           'Televisions',           'טלוויזיות',                   'both',       5),
  ('cat_door_locks',            'Door Locks',            'מנעולים לדלתות',              'apartments', 6),
  ('cat_apartment_safes',       'Apartment Safes',       'כספות',                       'apartments', 7),
  ('cat_mobile_furniture',      'Mobile Furniture',      'ריהוט נייד לחלל ציבורי',      'public',     8),
  ('cat_art_decor',             'Art & Decor',           'אומנות ואביזרי נוי',          'both',       9),
  ('cat_accessories',           'Accessories',           'אקססוריז',                    'both',       10),
  ('cat_bathroom_accessories',  'Bathroom Accessories',  'אביזרי אמבטיה',               'both',       11),
  ('cat_tableware_sets',        'Tableware Sets',        'מערכות כלי אוכל',             'both',       12),
  ('cat_rugs',                  'Rugs',                  'שטיחים',                      'both',       13),
  ('cat_curtains',              'Curtains',              'וילונות',                     'both',       14),
  ('cat_mirrors',               'Mirrors',               'מראות ומראות גוף',            'both',       15),
  ('cat_furniture',             'Furniture',             'ריהוט',                       'both',       16),
  ('cat_textiles',              'Textiles',              'טקסטיל',                      'both',       17),
  ('cat_bathroom',              'Bathroom',              'חדר רחצה',                    'both',       18),
  ('cat_kitchen',               'Kitchen',               'מטבח',                        'both',       19),
  ('cat_outdoor',               'Outdoor',               'חוץ',                         'both',       20),
  ('cat_other',                 'Other',                 'אחר',                         'both',       21),
  ('cat_uncategorized',         'Uncategorized',         'לא מסווג',                    'both',       999)
ON CONFLICT (id) DO NOTHING;
