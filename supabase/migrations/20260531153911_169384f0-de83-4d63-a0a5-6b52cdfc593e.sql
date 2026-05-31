
INSERT INTO public.catalog_products (id, name, description, unit_price_eur, supplier_name, discipline, area, sku) VALUES
('prd_bcst_01','DOUBLE BED','BEDROOM AREA',580.00,'','Furniture','Indoor',''),
('prd_bcst_02','SIDE TABLE','BEDROOM AREA',126.59,'','Furniture','Indoor',''),
('prd_bcst_03','MIRROR','BEDROOM AREA — MIRROR & WOOD FRAME',141.14,'','Mirrors','Indoor',''),
('prd_bcst_04','SOFA','LIVING AREA — UPHOLSTERED',629.71,'','Furniture','Indoor',''),
('prd_bcst_05','CUSHIONS','LIVING AREA — W500 x H300mm',19.54,'','Accessories','Indoor',''),
('prd_bcst_06','COFFEE TABLE','LIVING AREA',232.34,'','Furniture','Indoor',''),
('prd_bcst_07','LOUNGE CHAIR','LIVING AREA',314.85,'','Furniture','Indoor',''),
('prd_bcst_08','POUF','LIVING AREA — UPHOLSTERED',71.66,'','Furniture','Indoor',''),
('prd_bcst_09','POT','LIVING AREA — CEMENT',16.07,'','Accessories','Indoor',''),
('prd_bcst_10','POT (LARGE)','LIVING AREA — CEMENT',16.07,'','Accessories','Indoor',''),
('prd_bcst_11','TV UNIT','LIVING AREA',308.34,'','Furniture','Indoor',''),
('prd_bcst_12','RUG','LIVING AREA — WOOL W2400 x L1800mm',154.78,'','Rugs','Indoor',''),
('prd_bcst_13','DINING CHAIR','KITCHEN AREA — UPHOLSTERED, METAL DETAIL, WOODEN DETAIL & LEGS',121.60,'','Furniture','Indoor',''),
('prd_bcst_14','DINING TABLE','KITCHEN AREA — CONCRETE TOP, WOOD BASE',346.99,'','Furniture','Indoor',''),
('prd_bcst_15','OUTDOOR LOUNGE CHAIR','OUTDOOR — ALUMINUM FRAME, UPHOLSTERED CUSHIONS',282.28,'','Outdoor Furniture','Outdoor',''),
('prd_bcst_16','OUTDOOR COFFEE TABLE','OUTDOOR — ECO FIBER CEMENT',143.31,'','Outdoor Furniture','Outdoor','')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  unit_price_eur = EXCLUDED.unit_price_eur,
  discipline = EXCLUDED.discipline,
  area = EXCLUDED.area;

INSERT INTO public.packages (id, name, description, block, items, room_types, buildings, unit_coverage) VALUES (
  'pkg_bc_studio',
  'Boutique Studio — Building C',
  'CYPRUS VALLEY | BOUTIQUE BUILDING C — STUDIO APARTMENT',
  'C',
  '[
    {"productId":"prd_bcst_01","quantity":1},
    {"productId":"prd_bcst_02","quantity":2},
    {"productId":"prd_bcst_03","quantity":1},
    {"productId":"prd_bcst_04","quantity":1},
    {"productId":"prd_bcst_05","quantity":1},
    {"productId":"prd_bcst_06","quantity":1},
    {"productId":"prd_bcst_07","quantity":1},
    {"productId":"prd_bcst_08","quantity":1},
    {"productId":"prd_bcst_09","quantity":1},
    {"productId":"prd_bcst_10","quantity":1},
    {"productId":"prd_bcst_11","quantity":1},
    {"productId":"prd_bcst_12","quantity":1},
    {"productId":"prd_bcst_13","quantity":2},
    {"productId":"prd_bcst_14","quantity":1},
    {"productId":"prd_bcst_15","quantity":2},
    {"productId":"prd_bcst_16","quantity":1}
  ]'::jsonb,
  '["D","Dm"]'::jsonb,
  '["C1"]'::jsonb,
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  block = EXCLUDED.block,
  items = EXCLUDED.items,
  room_types = EXCLUDED.room_types,
  buildings = EXCLUDED.buildings;
