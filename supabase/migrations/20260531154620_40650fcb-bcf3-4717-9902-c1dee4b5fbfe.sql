-- Seed catalog products + Boutique Building C — 1 Bedroom Apartment package

INSERT INTO public.catalog_products (id, name, description, image_url, unit_price_eur, supplier_id, supplier_name, discipline, area, sku) VALUES
('prd_bc1br_01','Sofabed','Upholstered, plastic legs',NULL,497.25,NULL,'','Furniture','Indoor',''),
('prd_bc1br_02','Cushion 500x500','W500 x H500mm',NULL,26.06,NULL,'','Accessories','Indoor',''),
('prd_bc1br_03','Cushion 500x300','W500 x H300mm',NULL,19.54,NULL,'','Accessories','Indoor',''),
('prd_bc1br_04','Lounge Chair','',NULL,314.85,NULL,'','Furniture','Indoor',''),
('prd_bc1br_05','Coffee Table','',NULL,232.34,NULL,'','Furniture','Indoor',''),
('prd_bc1br_06','Side Table (Living)','',NULL,119.43,NULL,'','Furniture','Indoor',''),
('prd_bc1br_07','Vase Ceramic A','',NULL,46.03,NULL,'','Accessories','Indoor',''),
('prd_bc1br_08','Vase Ceramic B','',NULL,33.87,NULL,'','Accessories','Indoor',''),
('prd_bc1br_09','TV Unit','',NULL,306.34,NULL,'','Furniture','Indoor',''),
('prd_bc1br_10','Rug Wool 3000x2000','W3000 x L2000mm',NULL,214.97,NULL,'','Rugs','Indoor',''),
('prd_bc1br_11','Vase Ceramic C','',NULL,70.57,NULL,'','Accessories','Indoor',''),
('prd_bc1br_12','Dining Table','',NULL,597.14,NULL,'','Furniture','Indoor',''),
('prd_bc1br_13','Dining Chair','Upholstered, metal detail, wooden detail & legs',NULL,121.60,NULL,'','Furniture','Indoor',''),
('prd_bc1br_14','Splittable Bed','',NULL,680.00,NULL,'','Furniture','Indoor',''),
('prd_bc1br_15','Side Table (Bedroom)','',NULL,126.59,NULL,'','Furniture','Indoor',''),
('prd_bc1br_16','Mirror','Mirror & wood frame',NULL,141.14,NULL,'','Mirrors','Indoor',''),
('prd_bc1br_17','Rug Wool 2400x1800','W2400 x L1800mm',NULL,168.85,NULL,'','Rugs','Indoor',''),
('prd_bc1br_18','Outdoor Dining Chair','',NULL,108.57,NULL,'','Outdoor Furniture','Outdoor',''),
('prd_bc1br_19','Outdoor Dining Table','',NULL,340.91,NULL,'','Outdoor Furniture','Outdoor',''),
('prd_bc1br_20','Outdoor Lounge Chair','Aluminium frame, upholstered cushions',NULL,282.28,NULL,'','Outdoor Furniture','Outdoor',''),
('prd_bc1br_21','Outdoor Double Sofa','Alu-cushion olefin, alu tube',NULL,488.57,NULL,'','Outdoor Furniture','Outdoor',''),
('prd_bc1br_22','Outdoor Coffee Table','Eco fiber cement',NULL,143.31,NULL,'','Outdoor Furniture','Outdoor','')
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, unit_price_eur=EXCLUDED.unit_price_eur,
  discipline=EXCLUDED.discipline, area=EXCLUDED.area;

INSERT INTO public.packages (id, name, description, block, room_types, buildings, items, unit_coverage) VALUES (
  'pkg_bc_1bedroom',
  'CYPRUS VALLEY | BOUTIQUE BUILDING C - 1 BEDROOM APARTMENT (X6 UNITS)',
  '1 Bedroom Apartment package for Boutique Building C',
  'C',
  '["F","Fm","G","Gm","H","Hm"]'::jsonb,
  '["C1"]'::jsonb,
  '[
    {"productId":"prd_bc1br_01","qty":1},
    {"productId":"prd_bc1br_02","qty":1},
    {"productId":"prd_bc1br_03","qty":1},
    {"productId":"prd_bc1br_04","qty":1},
    {"productId":"prd_bc1br_05","qty":1},
    {"productId":"prd_bc1br_06","qty":1},
    {"productId":"prd_bc1br_07","qty":1},
    {"productId":"prd_bc1br_08","qty":1},
    {"productId":"prd_bc1br_09","qty":1},
    {"productId":"prd_bc1br_10","qty":1},
    {"productId":"prd_bc1br_11","qty":1},
    {"productId":"prd_bc1br_12","qty":1},
    {"productId":"prd_bc1br_13","qty":4},
    {"productId":"prd_bc1br_14","qty":1},
    {"productId":"prd_bc1br_15","qty":2},
    {"productId":"prd_bc1br_16","qty":1},
    {"productId":"prd_bc1br_17","qty":1},
    {"productId":"prd_bc1br_18","qty":2},
    {"productId":"prd_bc1br_19","qty":1},
    {"productId":"prd_bc1br_20","qty":1},
    {"productId":"prd_bc1br_21","qty":1},
    {"productId":"prd_bc1br_22","qty":1}
  ]'::jsonb,
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, block=EXCLUDED.block,
  room_types=EXCLUDED.room_types, buildings=EXCLUDED.buildings,
  items=EXCLUDED.items, unit_coverage=EXCLUDED.unit_coverage;