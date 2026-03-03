/**
 * Per-unit-type furniture quantities for each building concept.
 * Data extracted from CYPRUS_VALLEY_DYNAMIC_v2.xlsx
 */

export interface UnitType {
  code: string;
  description: string;
  floors: number[]; // which floors this unit appears on (0-indexed)
  unitsPerFloor: Record<number, number>; // floor -> count of this unit type
}

export interface FurniturePerUnit {
  itemName: string;
  category: 'Dining' | 'Living Room' | 'Bedroom' | 'Outdoor';
  quantities: Record<string, number>; // unitCode -> qty per unit
}

// ── Building A unit types ──
export const buildingAUnits: UnitType[] = [
  { code: 'AT', description: 'Studio', floors: [0], unitsPerFloor: { 0: 1 } },
  { code: 'Atm', description: 'Studio', floors: [0], unitsPerFloor: { 0: 1 } },
  { code: 'A', description: 'Studio', floors: [1, 3], unitsPerFloor: { 1: 1, 3: 1 } },
  { code: 'Am', description: 'Studio', floors: [1, 3], unitsPerFloor: { 1: 1, 3: 1 } },
  { code: 'BT', description: 'Studio', floors: [0], unitsPerFloor: { 0: 1 } },
  { code: 'BTm', description: 'Studio', floors: [0], unitsPerFloor: { 0: 1 } },
  { code: 'B', description: 'Studio', floors: [1], unitsPerFloor: { 1: 1 } },
  { code: 'Bm', description: 'Studio', floors: [1], unitsPerFloor: { 1: 1 } },
  { code: 'CT', description: '2BD', floors: [0], unitsPerFloor: { 0: 1 } },
  { code: 'CTm', description: '2BD', floors: [0], unitsPerFloor: { 0: 1 } },
  { code: 'D', description: 'Studio', floors: [1], unitsPerFloor: { 1: 1 } },
  { code: 'Dm', description: 'Studio', floors: [1], unitsPerFloor: { 1: 1 } },
  { code: 'E', description: 'Studio', floors: [1, 2, 3], unitsPerFloor: { 1: 1, 2: 1, 3: 1 } },
  { code: 'Em', description: 'Studio', floors: [1, 2, 3], unitsPerFloor: { 1: 1, 2: 1, 3: 1 } },
  { code: 'F', description: '1BD', floors: [1, 2], unitsPerFloor: { 1: 1, 2: 1 } },
  { code: 'Fm', description: '1BD', floors: [1, 2], unitsPerFloor: { 1: 1, 2: 1 } },
  { code: 'G', description: '1BD', floors: [2], unitsPerFloor: { 2: 1 } },
  { code: 'Gm', description: '1BD', floors: [2], unitsPerFloor: { 2: 1 } },
  { code: 'H', description: '1BD', floors: [2], unitsPerFloor: { 2: 1 } },
  { code: 'Hm', description: '1BD', floors: [2], unitsPerFloor: { 2: 1 } },
  { code: 'I', description: '2BD', floors: [3], unitsPerFloor: { 3: 1 } },
  { code: 'Im', description: '2BD', floors: [3], unitsPerFloor: { 3: 1 } },
  { code: 'J', description: '3BD', floors: [3], unitsPerFloor: { 3: 1 } },
];

// ── Building B unit types ──
export const buildingBUnits: UnitType[] = [
  { code: 'AT', description: '2BD', floors: [0], unitsPerFloor: { 0: 2 } },
  { code: 'Atm', description: '2BD', floors: [0], unitsPerFloor: { 0: 2 } },
  { code: 'A', description: '1BD', floors: [1, 2, 3, 4], unitsPerFloor: { 1: 4, 2: 4, 3: 4, 4: 2 } },
  { code: 'Am', description: '1BD', floors: [1, 2, 3, 4], unitsPerFloor: { 1: 4, 2: 4, 3: 4, 4: 2 } },
  { code: 'BT', description: '2BD', floors: [0], unitsPerFloor: { 0: 1 } },
  { code: 'BTm2', description: '2BD', floors: [0], unitsPerFloor: { 0: 1 } },
  { code: 'B', description: 'Studio', floors: [1, 2, 3, 4], unitsPerFloor: { 1: 1, 2: 1, 3: 1, 4: 1 } },
  { code: 'Bm', description: 'Studio', floors: [1, 2, 3, 4], unitsPerFloor: { 1: 1, 2: 1, 3: 1, 4: 1 } },
  { code: 'CT', description: '1BD', floors: [0], unitsPerFloor: { 0: 2 } },
  { code: 'CTm', description: '1BD', floors: [0], unitsPerFloor: { 0: 2 } },
  { code: 'C', description: '1BD', floors: [1, 2, 3, 4], unitsPerFloor: { 1: 2, 2: 2, 3: 2, 4: 2 } },
  { code: 'Cm', description: '1BD', floors: [1, 2, 3, 4], unitsPerFloor: { 1: 2, 2: 2, 3: 2, 4: 2 } },
  { code: 'DT', description: 'Studio', floors: [0], unitsPerFloor: { 0: 4 } },
  { code: 'DTm', description: 'Studio', floors: [0], unitsPerFloor: { 0: 4 } },
  { code: 'D', description: 'Studio', floors: [1, 2, 3, 4], unitsPerFloor: { 1: 4, 2: 4, 3: 4, 4: 4 } },
  { code: 'Dm', description: 'Studio', floors: [1, 2, 3, 4], unitsPerFloor: { 1: 4, 2: 4, 3: 4, 4: 4 } },
  { code: 'ET', description: '2BD', floors: [0], unitsPerFloor: { 0: 1 } },
  { code: 'Etm', description: '2BD', floors: [0], unitsPerFloor: { 0: 1 } },
  { code: 'E', description: '2BD', floors: [1, 2, 3, 4], unitsPerFloor: { 1: 1, 2: 1, 3: 1, 4: 1 } },
  { code: 'Em', description: '2BD', floors: [1, 2, 3, 4], unitsPerFloor: { 1: 1, 2: 1, 3: 1, 4: 1 } },
  { code: 'F', description: 'Studio', floors: [1, 2, 3, 4], unitsPerFloor: { 1: 1, 2: 1, 3: 1, 4: 1 } },
  { code: 'Fm', description: 'Studio', floors: [1, 2, 3, 4], unitsPerFloor: { 1: 1, 2: 1, 3: 1, 4: 1 } },
  { code: 'G', description: '4BD Penthouse', floors: [4], unitsPerFloor: { 4: 1 } },
  { code: 'Gm', description: '4BD Penthouse', floors: [4], unitsPerFloor: { 4: 1 } },
];

// ── Building C unit types ──
export const buildingCUnits: UnitType[] = [
  { code: 'A', description: '2BD', floors: [1, 2, 3], unitsPerFloor: { 1: 1, 2: 1, 3: 1 } },
  { code: 'Am', description: '2BD', floors: [1, 2, 3], unitsPerFloor: { 1: 1, 2: 1, 3: 1 } },
  { code: 'B', description: '2BD', floors: [1, 2, 3], unitsPerFloor: { 1: 1, 2: 1, 3: 1 } },
  { code: 'Bm', description: '2BD', floors: [1, 2, 3], unitsPerFloor: { 1: 1, 2: 1, 3: 1 } },
  { code: 'C', description: '1BD', floors: [1, 2, 3], unitsPerFloor: { 1: 1, 2: 1, 3: 1 } },
  { code: 'Cm', description: '1BD', floors: [1, 2, 3], unitsPerFloor: { 1: 1, 2: 1, 3: 1 } },
  { code: 'D', description: 'Studio', floors: [1, 2, 3], unitsPerFloor: { 1: 2, 2: 2, 3: 2 } },
  { code: 'Dm', description: 'Studio', floors: [1, 2, 3], unitsPerFloor: { 1: 2, 2: 2, 3: 2 } },
];

// ── Furniture quantities per unit type ──

export const buildingAFurniture: FurniturePerUnit[] = [
  // Dining
  { itemName: 'Bar Stool H65cm', category: 'Dining', quantities: { AT: 2, Atm: 2, A: 2, Am: 2, BT: 2, BTm: 2, B: 2, Bm: 2, CT: 0, CTm: 0, D: 0, Dm: 0, E: 0, Em: 0, F: 4, Fm: 4, G: 0, Gm: 0, H: 0, Hm: 0, I: 0, Im: 0, J: 0 } },
  { itemName: 'Bar table', category: 'Dining', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm: 1, B: 1, Bm: 1, CT: 0, CTm: 0, D: 0, Dm: 0, E: 0, Em: 0, F: 0, Fm: 0, G: 0, Gm: 0, H: 0, Hm: 0, I: 0, Im: 0, J: 0 } },
  { itemName: 'Chair (dining)', category: 'Dining', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 6, CTm: 6, D: 2, Dm: 2, E: 3, Em: 3, F: 0, Fm: 0, G: 6, Gm: 6, H: 6, Hm: 0, I: 6, Im: 6, J: 6 } },
  { itemName: 'Dining Table 180X85', category: 'Dining', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 1, CTm: 1, D: 0, Dm: 0, E: 0, Em: 0, F: 0, Fm: 0, G: 1, Gm: 1, H: 1, Hm: 0, I: 1, Im: 1, J: 0 } },
  { itemName: 'Dining Table D180cm', category: 'Dining', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 0, CTm: 0, D: 0, Dm: 0, E: 0, Em: 0, F: 0, Fm: 0, G: 0, Gm: 0, H: 0, Hm: 0, I: 0, Im: 0, J: 1 } },
  { itemName: 'Dining table 80cm', category: 'Dining', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 0, CTm: 0, D: 1, Dm: 1, E: 1, Em: 1, F: 0, Fm: 0, G: 0, Gm: 0, H: 0, Hm: 0, I: 0, Im: 0, J: 0 } },
  // Living Room
  { itemName: 'Armchair', category: 'Living Room', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 1, CTm: 1, D: 0, Dm: 0, E: 0, Em: 0, F: 1, Fm: 1, G: 1, Gm: 1, H: 1, Hm: 0, I: 1, Im: 1, J: 2 } },
  { itemName: 'Carpet LR 200X300cm', category: 'Living Room', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm: 1, B: 1, Bm: 1, CT: 1, CTm: 1, D: 1, Dm: 1, E: 0, Em: 0, F: 1, Fm: 1, G: 1, Gm: 1, H: 1, Hm: 0, I: 1, Im: 1, J: 1 } },
  { itemName: 'Coffee table 80cm', category: 'Living Room', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm: 1, B: 1, Bm: 1, CT: 1, CTm: 1, D: 1, Dm: 1, E: 1, Em: 1, F: 1, Fm: 1, G: 1, Gm: 1, H: 1, Hm: 0, I: 1, Im: 1, J: 1 } },
  { itemName: 'Desk', category: 'Living Room', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 0, CTm: 0, D: 0, Dm: 0, E: 1, Em: 1, F: 0, Fm: 0, G: 0, Gm: 0, H: 0, Hm: 0, I: 0, Im: 0, J: 0 } },
  { itemName: 'Puf', category: 'Living Room', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 1, BTm: 1, B: 1, Bm: 1, CT: 1, CTm: 1, D: 0, Dm: 0, E: 0, Em: 0, F: 1, Fm: 1, G: 1, Gm: 1, H: 1, Hm: 0, I: 1, Im: 1, J: 1 } },
  { itemName: 'Sidetable', category: 'Living Room', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 1, CTm: 1, D: 0, Dm: 0, E: 0, Em: 0, F: 1, Fm: 1, G: 1, Gm: 1, H: 1, Hm: 0, I: 1, Im: 1, J: 1 } },
  { itemName: 'Sofa 180cm', category: 'Living Room', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm: 1, B: 1, Bm: 1, CT: 0, CTm: 0, D: 1, Dm: 1, E: 1, Em: 1, F: 0, Fm: 0, G: 0, Gm: 0, H: 0, Hm: 0, I: 0, Im: 0, J: 0 } },
  { itemName: 'Sofa Bed 220cm', category: 'Living Room', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 1, CTm: 1, D: 0, Dm: 0, E: 0, Em: 0, F: 1, Fm: 1, G: 1, Gm: 1, H: 1, Hm: 0, I: 1, Im: 1, J: 1 } },
  { itemName: 'TV console 180cm', category: 'Living Room', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 1, CTm: 1, D: 1, Dm: 1, E: 1, Em: 1, F: 1, Fm: 1, G: 1, Gm: 1, H: 1, Hm: 0, I: 1, Im: 1, J: 1 } },
  // Bedroom
  { itemName: 'Bed Bench', category: 'Bedroom', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm: 1, B: 1, Bm: 1, CT: 0, CTm: 0, D: 0, Dm: 0, E: 0, Em: 0, F: 0, Fm: 0, G: 1, Gm: 1, H: 1, Hm: 0, I: 0, Im: 0, J: 0 } },
  { itemName: 'Bedside table 35cm', category: 'Bedroom', quantities: { AT: 2, Atm: 2, A: 2, Am: 2, BT: 2, BTm: 2, B: 2, Bm: 2, CT: 4, CTm: 4, D: 2, Dm: 2, E: 2, Em: 2, F: 2, Fm: 2, G: 2, Gm: 2, H: 2, Hm: 0, I: 4, Im: 4, J: 6 } },
  { itemName: 'Body mirror 150X50cm', category: 'Bedroom', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm: 1, B: 1, Bm: 1, CT: 2, CTm: 2, D: 1, Dm: 1, E: 1, Em: 1, F: 1, Fm: 1, G: 1, Gm: 1, H: 1, Hm: 0, I: 2, Im: 2, J: 3 } },
  { itemName: 'Carpet BR 200X300cm', category: 'Bedroom', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm: 1, B: 1, Bm: 1, CT: 2, CTm: 2, D: 0, Dm: 0, E: 0, Em: 0, F: 1, Fm: 1, G: 1, Gm: 1, H: 1, Hm: 0, I: 2, Im: 2, J: 3 } },
  { itemName: 'Mattress 160X200', category: 'Bedroom', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm: 1, B: 1, Bm: 1, CT: 0, CTm: 0, D: 1, Dm: 1, E: 1, Em: 1, F: 0, Fm: 0, G: 0, Gm: 0, H: 0, Hm: 0, I: 0, Im: 0, J: 0 } },
  { itemName: 'Mattress 80X200', category: 'Bedroom', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 4, CTm: 4, D: 0, Dm: 0, E: 0, Em: 0, F: 2, Fm: 2, G: 2, Gm: 2, H: 2, Hm: 0, I: 4, Im: 4, J: 6 } },
  { itemName: 'Queen size bed', category: 'Bedroom', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm: 1, B: 1, Bm: 1, CT: 0, CTm: 0, D: 1, Dm: 1, E: 1, Em: 1, F: 0, Fm: 0, G: 0, Gm: 0, H: 0, Hm: 0, I: 0, Im: 0, J: 0 } },
  { itemName: 'Twin bed 2x80X200', category: 'Bedroom', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 2, CTm: 2, D: 0, Dm: 0, E: 0, Em: 0, F: 1, Fm: 1, G: 1, Gm: 1, H: 1, Hm: 0, I: 2, Im: 2, J: 2 } },
  { itemName: 'Twin bed 2x90X200', category: 'Bedroom', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 0, CTm: 0, D: 0, Dm: 0, E: 0, Em: 0, F: 0, Fm: 0, G: 0, Gm: 0, H: 0, Hm: 0, I: 0, Im: 1, J: 0 } },
  // Outdoor
  { itemName: 'Outdoor Armchair M', category: 'Outdoor', quantities: { AT: 2, Atm: 2, A: 2, Am: 2, BT: 2, BTm: 2, B: 2, Bm: 2, CT: 2, CTm: 2, D: 2, Dm: 2, E: 2, Em: 2, F: 1, Fm: 1, G: 0, Gm: 0, H: 0, Hm: 0, I: 0, Im: 0, J: 2 } },
  { itemName: 'Outdoor Chair', category: 'Outdoor', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 1, BTm: 1, B: 0, Bm: 0, CT: 6, CTm: 6, D: 0, Dm: 0, E: 0, Em: 0, F: 4, Fm: 4, G: 4, Gm: 4, H: 4, Hm: 0, I: 4, Im: 4, J: 6 } },
  { itemName: 'Outdoor Coffee Table', category: 'Outdoor', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm: 1, B: 1, Bm: 1, CT: 1, CTm: 1, D: 1, Dm: 1, E: 1, Em: 1, F: 1, Fm: 1, G: 1, Gm: 1, H: 1, Hm: 0, I: 1, Im: 1, J: 1 } },
  { itemName: 'Outdoor Dining Table 220X80cm', category: 'Outdoor', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 2, BTm: 2, B: 0, Bm: 0, CT: 1, CTm: 1, D: 0, Dm: 0, E: 0, Em: 0, F: 0, Fm: 0, G: 0, Gm: 0, H: 0, Hm: 0, I: 0, Im: 0, J: 1 } },
  { itemName: 'Outdoor Dining Table D120cm', category: 'Outdoor', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 0, CTm: 0, D: 0, Dm: 0, E: 0, Em: 0, F: 1, Fm: 1, G: 0, Gm: 0, H: 0, Hm: 0, I: 0, Im: 0, J: 0 } },
  { itemName: 'Outdoor Dining Table D80cm', category: 'Outdoor', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 0, CTm: 0, D: 0, Dm: 0, E: 0, Em: 0, F: 0, Fm: 0, G: 1, Gm: 1, H: 1, Hm: 0, I: 1, Im: 1, J: 0 } },
  { itemName: 'Outdoor two seater sofa', category: 'Outdoor', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm: 0, B: 0, Bm: 0, CT: 1, CTm: 1, D: 0, Dm: 0, E: 0, Em: 0, F: 1, Fm: 1, G: 1, Gm: 1, H: 1, Hm: 0, I: 1, Im: 1, J: 2 } },
];

export const buildingBFurniture: FurniturePerUnit[] = [
  // Dining
  { itemName: 'Bar Stool H65cm', category: 'Dining', quantities: { AT: 3, Atm: 3, A: 0, Am: 0, BT: 3, BTm2: 3, B: 0, Bm: 0, CT: 0, CTm: 0, C: 0, Cm: 0, DT: 0, DTm: 0, D: 0, Dm: 0, ET: 3, Etm: 3, E: 0, Em: 0, F: 0, Fm: 0, G: 0, Gm: 0 } },
  { itemName: 'Bar table', category: 'Dining', quantities: { AT: 0, Atm: 0, A: 1, Am: 1, BT: 0, BTm2: 0, B: 0, Bm: 0, CT: 0, CTm: 0, C: 1, Cm: 1, DT: 0, DTm: 0, D: 1, Dm: 1, ET: 0, Etm: 0, E: 0, Em: 0, F: 1, Fm: 1, G: 0, Gm: 0 } },
  { itemName: 'Chair (dining)', category: 'Dining', quantities: { AT: 7, Atm: 7, A: 4, Am: 4, BT: 6, BTm2: 6, B: 2, Bm: 2, CT: 4, CTm: 4, C: 3, Cm: 3, DT: 4, DTm: 4, D: 4, Dm: 4, ET: 6, Etm: 6, E: 6, Em: 6, F: 4, Fm: 4, G: 7, Gm: 7 } },
  { itemName: 'Dining Table 180X85', category: 'Dining', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 1, BTm2: 1, B: 0, Bm: 0, CT: 0, CTm: 0, C: 0, Cm: 0, DT: 0, DTm: 0, D: 0, Dm: 0, ET: 1, Etm: 1, E: 1, Em: 1, F: 0, Fm: 0, G: 0, Gm: 0 } },
  { itemName: 'Dining table 120cm', category: 'Dining', quantities: { AT: 1, Atm: 1, A: 0, Am: 0, BT: 0, BTm2: 0, B: 0, Bm: 0, CT: 0, CTm: 0, C: 0, Cm: 0, DT: 0, DTm: 0, D: 0, Dm: 0, ET: 0, Etm: 0, E: 0, Em: 0, F: 0, Fm: 0, G: 1, Gm: 1 } },
  { itemName: 'Dining table 80cm', category: 'Dining', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm2: 0, B: 1, Bm: 1, CT: 1, CTm: 1, C: 0, Cm: 0, DT: 1, DTm: 1, D: 0, Dm: 0, ET: 0, Etm: 0, E: 0, Em: 0, F: 0, Fm: 0, G: 0, Gm: 0 } },
  // Living Room
  { itemName: 'Armchair', category: 'Living Room', quantities: { AT: 2, Atm: 2, A: 1, Am: 1, BT: 2, BTm2: 2, B: 0, Bm: 0, CT: 1, CTm: 1, C: 1, Cm: 1, DT: 0, DTm: 0, D: 0, Dm: 0, ET: 1, Etm: 1, E: 1, Em: 1, F: 0, Fm: 0, G: 2, Gm: 2 } },
  { itemName: 'Carpet LR 200X300cm', category: 'Living Room', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm2: 1, B: 1, Bm: 1, CT: 1, CTm: 1, C: 1, Cm: 1, DT: 1, DTm: 1, D: 1, Dm: 1, ET: 1, Etm: 1, E: 1, Em: 1, F: 1, Fm: 1, G: 1, Gm: 1 } },
  { itemName: 'Coffee table 80cm', category: 'Living Room', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm2: 1, B: 1, Bm: 1, CT: 1, CTm: 1, C: 1, Cm: 1, DT: 1, DTm: 1, D: 1, Dm: 1, ET: 1, Etm: 1, E: 1, Em: 1, F: 1, Fm: 1, G: 1, Gm: 1 } },
  { itemName: 'Desk', category: 'Living Room', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm2: 0, B: 0, Bm: 0, CT: 0, CTm: 0, C: 0, Cm: 0, DT: 1, DTm: 1, D: 1, Dm: 1, ET: 0, Etm: 0, E: 0, Em: 0, F: 0, Fm: 0, G: 0, Gm: 0 } },
  { itemName: 'Puf', category: 'Living Room', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm2: 1, B: 1, Bm: 1, CT: 1, CTm: 1, C: 1, Cm: 1, DT: 0, DTm: 0, D: 1, Dm: 1, ET: 1, Etm: 1, E: 1, Em: 1, F: 1, Fm: 1, G: 1, Gm: 1 } },
  { itemName: 'Sidetable', category: 'Living Room', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm2: 1, B: 0, Bm: 0, CT: 1, CTm: 1, C: 1, Cm: 1, DT: 0, DTm: 0, D: 0, Dm: 0, ET: 1, Etm: 1, E: 1, Em: 1, F: 0, Fm: 0, G: 1, Gm: 1 } },
  { itemName: 'Sofa 180cm', category: 'Living Room', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm2: 0, B: 1, Bm: 1, CT: 0, CTm: 0, C: 1, Cm: 1, DT: 1, DTm: 1, D: 1, Dm: 1, ET: 0, Etm: 0, E: 0, Em: 0, F: 1, Fm: 1, G: 0, Gm: 0 } },
  { itemName: 'Sofa Bed 220cm', category: 'Living Room', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm2: 1, B: 0, Bm: 0, CT: 1, CTm: 1, C: 0, Cm: 0, DT: 0, DTm: 0, D: 0, Dm: 0, ET: 1, Etm: 1, E: 1, Em: 1, F: 0, Fm: 0, G: 1, Gm: 1 } },
  { itemName: 'TV console 180cm', category: 'Living Room', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm2: 1, B: 1, Bm: 1, CT: 1, CTm: 1, C: 1, Cm: 1, DT: 1, DTm: 1, D: 1, Dm: 1, ET: 1, Etm: 1, E: 1, Em: 1, F: 1, Fm: 1, G: 1, Gm: 1 } },
  // Bedroom
  { itemName: 'Bedside table 35cm', category: 'Bedroom', quantities: { AT: 4, Atm: 4, A: 2, Am: 2, BT: 4, BTm2: 4, B: 2, Bm: 2, CT: 2, CTm: 2, C: 2, Cm: 2, DT: 2, DTm: 2, D: 0, Dm: 0, ET: 4, Etm: 4, E: 4, Em: 4, F: 0, Fm: 0, G: 8, Gm: 8 } },
  { itemName: 'Body mirror 150X50cm', category: 'Bedroom', quantities: { AT: 2, Atm: 2, A: 1, Am: 1, BT: 2, BTm2: 2, B: 1, Bm: 1, CT: 1, CTm: 1, C: 1, Cm: 1, DT: 1, DTm: 1, D: 1, Dm: 1, ET: 2, Etm: 2, E: 2, Em: 2, F: 1, Fm: 1, G: 4, Gm: 4 } },
  { itemName: 'Carpet BR 200X300cm', category: 'Bedroom', quantities: { AT: 2, Atm: 2, A: 1, Am: 1, BT: 2, BTm2: 2, B: 1, Bm: 1, CT: 1, CTm: 1, C: 1, Cm: 1, DT: 0, DTm: 0, D: 1, Dm: 1, ET: 2, Etm: 2, E: 2, Em: 2, F: 1, Fm: 1, G: 4, Gm: 4 } },
  { itemName: 'Mattress 160X200', category: 'Bedroom', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm2: 0, B: 1, Bm: 1, CT: 0, CTm: 0, C: 0, Cm: 0, DT: 1, DTm: 1, D: 1, Dm: 1, ET: 0, Etm: 0, E: 0, Em: 0, F: 1, Fm: 1, G: 0, Gm: 0 } },
  { itemName: 'Mattress 80X200', category: 'Bedroom', quantities: { AT: 4, Atm: 4, A: 2, Am: 2, BT: 4, BTm2: 4, B: 1, Bm: 1, CT: 2, CTm: 2, C: 2, Cm: 2, DT: 0, DTm: 0, D: 2, Dm: 2, ET: 4, Etm: 4, E: 4, Em: 4, F: 2, Fm: 2, G: 8, Gm: 8 } },
  { itemName: 'Queen size bed', category: 'Bedroom', quantities: { AT: 0, Atm: 0, A: 0, Am: 0, BT: 0, BTm2: 0, B: 1, Bm: 1, CT: 0, CTm: 0, C: 0, Cm: 0, DT: 1, DTm: 1, D: 1, Dm: 1, ET: 0, Etm: 0, E: 0, Em: 0, F: 1, Fm: 1, G: 0, Gm: 0 } },
  { itemName: 'Twin bed 2x80X200', category: 'Bedroom', quantities: { AT: 2, Atm: 2, A: 1, Am: 1, BT: 2, BTm2: 2, B: 0, Bm: 0, CT: 1, CTm: 1, C: 1, Cm: 1, DT: 0, DTm: 0, D: 0, Dm: 0, ET: 2, Etm: 2, E: 2, Em: 2, F: 0, Fm: 0, G: 4, Gm: 4 } },
  // Outdoor
  { itemName: 'Outdoor Armchair M', category: 'Outdoor', quantities: { AT: 3, Atm: 3, A: 2, Am: 2, BT: 3, BTm2: 3, B: 2, Bm: 2, CT: 3, CTm: 3, C: 2, Cm: 2, DT: 0, DTm: 0, D: 2, Dm: 2, ET: 3, Etm: 3, E: 2, Em: 2, F: 2, Fm: 2, G: 3, Gm: 3 } },
  { itemName: 'Outdoor Chair', category: 'Outdoor', quantities: { AT: 6, Atm: 6, A: 0, Am: 0, BT: 6, BTm2: 0, B: 0, Bm: 0, CT: 0, CTm: 0, C: 0, Cm: 0, DT: 6, DTm: 6, D: 0, Dm: 0, ET: 6, Etm: 6, E: 0, Em: 0, F: 0, Fm: 0, G: 6, Gm: 6 } },
  { itemName: 'Outdoor Coffee Table', category: 'Outdoor', quantities: { AT: 1, Atm: 1, A: 1, Am: 1, BT: 1, BTm2: 1, B: 1, Bm: 1, CT: 1, CTm: 1, C: 1, Cm: 1, DT: 1, DTm: 1, D: 1, Dm: 1, ET: 1, Etm: 1, E: 1, Em: 1, F: 1, Fm: 1, G: 1, Gm: 1 } },
  { itemName: 'Outdoor Dining Table 220X80cm', category: 'Outdoor', quantities: { AT: 1, Atm: 1, A: 0, Am: 0, BT: 1, BTm2: 0, B: 0, Bm: 0, CT: 0, CTm: 0, C: 0, Cm: 0, DT: 1, DTm: 1, D: 0, Dm: 0, ET: 1, Etm: 1, E: 0, Em: 0, F: 0, Fm: 0, G: 1, Gm: 1 } },
  { itemName: 'Outdoor Side Table 40cm', category: 'Outdoor', quantities: { AT: 1, Atm: 1, A: 0, Am: 0, BT: 1, BTm2: 1, B: 0, Bm: 0, CT: 1, CTm: 1, C: 0, Cm: 0, DT: 0, DTm: 0, D: 0, Dm: 0, ET: 1, Etm: 1, E: 1, Em: 1, F: 0, Fm: 0, G: 1, Gm: 1 } },
  { itemName: 'Outdoor two seater sofa', category: 'Outdoor', quantities: { AT: 1, Atm: 1, A: 0, Am: 0, BT: 1, BTm2: 0, B: 0, Bm: 0, CT: 0, CTm: 0, C: 0, Cm: 0, DT: 0, DTm: 0, D: 0, Dm: 0, ET: 1, Etm: 1, E: 1, Em: 1, F: 0, Fm: 0, G: 1, Gm: 1 } },
];

export const buildingCFurniture: FurniturePerUnit[] = [
  // Dining
  { itemName: 'Chair (dining)', category: 'Dining', quantities: { A: 6, Am: 6, B: 6, Bm: 6, C: 4, Cm: 4, D: 3, Dm: 3 } },
  { itemName: 'Dining Table 180X85', category: 'Dining', quantities: { A: 1, Am: 1, B: 1, Bm: 1, C: 0, Cm: 0, D: 0, Dm: 0 } },
  { itemName: 'Dining table 120cm', category: 'Dining', quantities: { A: 0, Am: 0, B: 0, Bm: 0, C: 1, Cm: 1, D: 0, Dm: 0 } },
  { itemName: 'Dining table 80cm', category: 'Dining', quantities: { A: 0, Am: 0, B: 0, Bm: 0, C: 0, Cm: 0, D: 1, Dm: 1 } },
  // Living Room
  { itemName: 'Armchair', category: 'Living Room', quantities: { A: 1, Am: 1, B: 1, Bm: 1, C: 1, Cm: 1, D: 0, Dm: 0 } },
  { itemName: 'Carpet LR 200X300cm', category: 'Living Room', quantities: { A: 1, Am: 1, B: 1, Bm: 1, C: 1, Cm: 1, D: 0, Dm: 0 } },
  { itemName: 'Coffee table 80cm', category: 'Living Room', quantities: { A: 1, Am: 1, B: 1, Bm: 1, C: 1, Cm: 1, D: 1, Dm: 1 } },
  { itemName: 'Desk', category: 'Living Room', quantities: { A: 0, Am: 0, B: 0, Bm: 0, C: 0, Cm: 0, D: 1, Dm: 1 } },
  { itemName: 'Puf', category: 'Living Room', quantities: { A: 1, Am: 1, B: 1, Bm: 1, C: 1, Cm: 1, D: 0, Dm: 0 } },
  { itemName: 'Sidetable', category: 'Living Room', quantities: { A: 1, Am: 1, B: 1, Bm: 1, C: 1, Cm: 1, D: 0, Dm: 0 } },
  { itemName: 'Sofa 180cm', category: 'Living Room', quantities: { A: 0, Am: 0, B: 0, Bm: 0, C: 1, Cm: 1, D: 1, Dm: 1 } },
  { itemName: 'Sofa Bed 220cm', category: 'Living Room', quantities: { A: 1, Am: 1, B: 1, Bm: 1, C: 0, Cm: 0, D: 0, Dm: 0 } },
  { itemName: 'TV console 180cm', category: 'Living Room', quantities: { A: 1, Am: 1, B: 1, Bm: 1, C: 1, Cm: 1, D: 1, Dm: 1 } },
  // Bedroom
  { itemName: 'Bed Bench', category: 'Bedroom', quantities: { A: 0, Am: 0, B: 0, Bm: 0, C: 1, Cm: 1, D: 0, Dm: 0 } },
  { itemName: 'Bedside table 35cm', category: 'Bedroom', quantities: { A: 4, Am: 4, B: 4, Bm: 4, C: 2, Cm: 2, D: 2, Dm: 2 } },
  { itemName: 'Body mirror 150X50cm', category: 'Bedroom', quantities: { A: 2, Am: 2, B: 2, Bm: 2, C: 1, Cm: 1, D: 1, Dm: 1 } },
  { itemName: 'Carpet BR 200X300cm', category: 'Bedroom', quantities: { A: 2, Am: 2, B: 2, Bm: 2, C: 1, Cm: 1, D: 0, Dm: 0 } },
  { itemName: 'Drawer Dresser', category: 'Bedroom', quantities: { A: 1, Am: 1, B: 0, Bm: 0, C: 0, Cm: 0, D: 0, Dm: 0 } },
  { itemName: 'Mattress 160X200', category: 'Bedroom', quantities: { A: 0, Am: 0, B: 0, Bm: 0, C: 0, Cm: 0, D: 1, Dm: 1 } },
  { itemName: 'Mattress 80X200', category: 'Bedroom', quantities: { A: 4, Am: 4, B: 4, Bm: 4, C: 2, Cm: 2, D: 0, Dm: 0 } },
  { itemName: 'Queen size bed', category: 'Bedroom', quantities: { A: 0, Am: 0, B: 0, Bm: 0, C: 0, Cm: 0, D: 1, Dm: 1 } },
  { itemName: 'Twin bed 2x80X200', category: 'Bedroom', quantities: { A: 2, Am: 2, B: 2, Bm: 2, C: 1, Cm: 1, D: 0, Dm: 0 } },
  // Outdoor
  { itemName: 'Outdoor Armchair M', category: 'Outdoor', quantities: { A: 3, Am: 3, B: 3, Bm: 3, C: 1, Cm: 1, D: 2, Dm: 2 } },
  { itemName: 'Outdoor Chair', category: 'Outdoor', quantities: { A: 4, Am: 4, B: 4, Bm: 4, C: 4, Cm: 4, D: 0, Dm: 0 } },
  { itemName: 'Outdoor Coffee Table', category: 'Outdoor', quantities: { A: 1, Am: 1, B: 1, Bm: 1, C: 1, Cm: 1, D: 1, Dm: 1 } },
  { itemName: 'Outdoor Dining Table D120cm', category: 'Outdoor', quantities: { A: 0, Am: 0, B: 1, Bm: 1, C: 0, Cm: 0, D: 0, Dm: 0 } },
  { itemName: 'Outdoor Dining Table D75X75cm', category: 'Outdoor', quantities: { A: 0, Am: 0, B: 0, Bm: 0, C: 1, Cm: 1, D: 0, Dm: 0 } },
  { itemName: 'Outdoor Dining Table D90cm', category: 'Outdoor', quantities: { A: 1, Am: 1, B: 0, Bm: 0, C: 0, Cm: 0, D: 0, Dm: 0 } },
  { itemName: 'Outdoor Side Table 40cm', category: 'Outdoor', quantities: { A: 1, Am: 1, B: 1, Bm: 1, C: 0, Cm: 0, D: 0, Dm: 0 } },
  { itemName: 'Outdoor two seater sofa', category: 'Outdoor', quantities: { A: 1, Am: 1, B: 1, Bm: 1, C: 1, Cm: 1, D: 0, Dm: 0 } },
];

// ── Floor plan images (per floor) ──
export const floorPlans: Record<string, Record<number, string>> = {
  A: {
    0: '/plans/building_a_ground_floor.jpg',
    1: '/plans/building_a_first_floor.pdf',
    2: '/plans/building_a_second_floor.pdf',
  },
  B: {
    0: '/plans/building_b_ground_floor.pdf',
    1: '/plans/building_b_first_floor.pdf',
    4: '/plans/building_b_fourth_floor.pdf',
  },
  C: {
    1: '/plans/building_c_first_floor.pdf',
    2: '/plans/building_c_second_floor.pdf',
    3: '/plans/building_c_third_floor.pdf',
  },
};

// ── Unit floor plan images (per unit code per concept) ──
// Key format: concept -> unitCode -> image path
// Each unit code (including mirrors) has its own separate image
export const unitFloorPlans: Record<string, Record<string, string>> = {
  A: {
    AT: '/plans/units/A_AT.png',
    Atm: '/plans/units/A_Atm.png',
    A: '/plans/units/A_A.png',
    Am: '/plans/units/A_Am.png',
    BT: '/plans/units/A_BT.png',
    BTm: '/plans/units/A_BTm.png',
    B: '/plans/units/A_B.png',
    Bm: '/plans/units/A_Bm.png',
    CT: '/plans/units/A_CT.png',
    CTm: '/plans/units/A_CTm.png',
    D: '/plans/units/A_D.png',
    Dm: '/plans/units/A_Dm.png',
    E: '/plans/units/A_E.png',
    Em: '/plans/units/A_Em.png',
    F: '/plans/units/A_F.png',
    Fm: '/plans/units/A_Fm.png',
    G: '/plans/units/A_G.png',
    Gm: '/plans/units/A_Gm.png',
    H: '/plans/units/A_H.png',
    Hm: '/plans/units/A_Hm.png',
    I: '/plans/units/A_I.png',
    Im: '/plans/units/A_Im.png',
    J: '/plans/units/A_J.png',
  },
  B: {
    AT: '/plans/units/B_AT.png',
    Atm: '/plans/units/B_Atm.png',
    A: '/plans/units/B_A.png',
    Am: '/plans/units/B_Am.png',
    BT: '/plans/units/B_BT.png',
    BTm2: '/plans/units/B_BTm2.png',
    B: '/plans/units/B_B.png',
    Bm: '/plans/units/B_Bm.png',
    C: '/plans/units/B_C.png',
    Cm: '/plans/units/B_Cm.png',
    CT: '/plans/units/B_CT.png',
    CTm: '/plans/units/B_CTm.png',
    DT: '/plans/units/B_DT.png',
    DTm: '/plans/units/B_DTm.png',
    D: '/plans/units/B_D.png',
    Dm: '/plans/units/B_Dm.png',
    E: '/plans/units/B_E.png',
    Em: '/plans/units/B_Em.png',
    ET: '/plans/units/B_ET.png',
    Etm: '/plans/units/B_Etm.png',
    F: '/plans/units/B_F.png',
    Fm: '/plans/units/B_Fm.png',
    G: '/plans/units/B_G.png',
  },
  C: {
    A: '/plans/units/C_A.png',
    Am: '/plans/units/C_Am.png',
    B: '/plans/units/C_B.png',
    Bm: '/plans/units/C_Bm.png',
    C: '/plans/units/C_C.png',
    Cm: '/plans/units/C_Cm.png',
    D: '/plans/units/C_D.png',
    Dm: '/plans/units/C_Dm.png',
  },
};

// ── Helper: get unit floor plan image ──
export function getUnitFloorPlanUrl(concept: 'A' | 'B' | 'C', unitCode: string): string | null {
  return unitFloorPlans[concept]?.[unitCode] || null;
}

// ── Helper: get all data for a building ──
export function getBuildingData(building: 'A' | 'B' | 'C') {
  switch (building) {
    case 'A': return { units: buildingAUnits, furniture: buildingAFurniture };
    case 'B': return { units: buildingBUnits, furniture: buildingBFurniture };
    case 'C': return { units: buildingCUnits, furniture: buildingCFurniture };
  }
}

// ── Get unique room types for a building ──
export function getRoomTypes(building: 'A' | 'B' | 'C'): string[] {
  const { units } = getBuildingData(building);
  return [...new Set(units.map(u => u.description))].sort();
}

// ── Get floors for a building ──
export function getFloors(building: 'A' | 'B' | 'C'): number[] {
  const { units } = getBuildingData(building);
  const floors = new Set<number>();
  units.forEach(u => u.floors.forEach(f => floors.add(f)));
  return [...floors].sort((a, b) => a - b);
}

// ── Get unit codes for a building, optionally filtered by floor and/or room type ──
export function getUnitCodes(building: 'A' | 'B' | 'C', floor?: number, roomType?: string): string[] {
  const { units } = getBuildingData(building);
  return units
    .filter(u => (floor === undefined || u.floors.includes(floor)))
    .filter(u => (!roomType || u.description === roomType))
    .map(u => u.code);
}

// ── Get furniture list for a specific unit code ──
export function getFurnitureForUnit(building: 'A' | 'B' | 'C', unitCode: string): { itemName: string; category: string; qty: number }[] {
  const { furniture } = getBuildingData(building);
  return furniture
    .map(f => ({ itemName: f.itemName, category: f.category, qty: f.quantities[unitCode] || 0 }))
    .filter(f => f.qty > 0);
}
