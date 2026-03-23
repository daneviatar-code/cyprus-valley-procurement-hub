export type Category = 'Dining' | 'Living Room' | 'Bedroom' | 'Outdoor' | 'Bathroom' | 'Kitchen' | 'Sauna & Wellness' | 'Accessories & Decor' | 'Mirrors' | 'Electrical & Appliances' | 'In-Room Safes' | 'Cutlery & Dining Sets' | 'Curtains & Window Treatments';
export type Status = '' | 'Pending' | 'Ordered' | 'Delivered' | 'Issue';

export const categoryEmojis: Record<Category, string> = {
  'Dining': '🍽',
  'Living Room': '🛋',
  'Bedroom': '🛏',
  'Outdoor': '🌿',
  'Bathroom': '🚿',
  'Kitchen': '🍳',
  'Sauna & Wellness': '🧖',
  'Accessories & Decor': '🎨',
  'Mirrors': '🪞',
  'Electrical & Appliances': '🔌',
  'In-Room Safes': '🔐',
  'Cutlery & Dining Sets': '🍴',
  'Curtains & Window Treatments': '🪟',
};

export interface ProcurementItem {
  id: number;
  name: string;
  category: Category;
  qtyA: number;
  qtyB: number;
  qtyC: number;
  grandTotal: number;
}

export interface UserItemData {
  supplier: string;
  unitPrice: number | null;
  status: Status;
  notes: string;
  supplierContact: string;
  catalogueRef: string;
  leadTime: string;
  imageUrl: string;
}

export const procurementItems: ProcurementItem[] = [
  { id: 1, name: 'Bar Stool H65cm', category: 'Dining', qtyA: 216, qtyB: 48, qtyC: 0, grandTotal: 264 },
  { id: 2, name: 'Bar table', category: 'Dining', qtyA: 60, qtyB: 168, qtyC: 0, grandTotal: 228 },
  { id: 3, name: 'Chair (dining)', category: 'Dining', qtyA: 420, qtyB: 996, qtyC: 132, grandTotal: 1548 },
  { id: 4, name: 'Dining Table 180X85', category: 'Dining', qtyA: 42, qtyB: 24, qtyC: 12, grandTotal: 78 },
  { id: 5, name: 'Dining Table D180cm', category: 'Dining', qtyA: 6, qtyB: 0, qtyC: 0, grandTotal: 6 },
  { id: 6, name: 'Dining table 120cm', category: 'Dining', qtyA: 0, qtyB: 12, qtyC: 6, grandTotal: 18 },
  { id: 7, name: 'Dining table 80cm', category: 'Dining', qtyA: 48, qtyB: 40, qtyC: 12, grandTotal: 100 },
  { id: 8, name: 'Armchair', category: 'Living Room', qtyA: 78, qtyB: 148, qtyC: 18, grandTotal: 244 },
  { id: 9, name: 'Carpet LR 200X300cm', category: 'Living Room', qtyA: 144, qtyB: 244, qtyC: 18, grandTotal: 406 },
  { id: 10, name: 'Coffee table 80cm', category: 'Living Room', qtyA: 180, qtyB: 244, qtyC: 30, grandTotal: 454 },
  { id: 11, name: 'Desk', category: 'Living Room', qtyA: 36, qtyB: 80, qtyC: 12, grandTotal: 128 },
  { id: 12, name: 'Puf', category: 'Living Room', qtyA: 96, qtyB: 228, qtyC: 18, grandTotal: 342 },
  { id: 13, name: 'Sidetable', category: 'Living Room', qtyA: 72, qtyB: 132, qtyC: 18, grandTotal: 222 },
  { id: 14, name: 'Sofa 180cm', category: 'Living Room', qtyA: 108, qtyB: 144, qtyC: 18, grandTotal: 270 },
  { id: 15, name: 'Sofa Bed 220cm', category: 'Living Room', qtyA: 72, qtyB: 100, qtyC: 12, grandTotal: 184 },
  { id: 16, name: 'TV console 180cm', category: 'Living Room', qtyA: 120, qtyB: 244, qtyC: 30, grandTotal: 394 },
  { id: 17, name: 'Bed Bench', category: 'Bedroom', qtyA: 78, qtyB: 0, qtyC: 6, grandTotal: 84 },
  { id: 18, name: 'Bedside table 35cm', category: 'Bedroom', qtyA: 432, qtyB: 416, qtyC: 84, grandTotal: 932 },
  { id: 19, name: 'Body mirror 150X50cm', category: 'Bedroom', qtyA: 216, qtyB: 288, qtyC: 42, grandTotal: 546 },
  { id: 20, name: 'Carpet BR 200X300cm', category: 'Bedroom', qtyA: 168, qtyB: 272, qtyC: 30, grandTotal: 470 },
  { id: 21, name: 'Drawer Dresser', category: 'Bedroom', qtyA: 0, qtyB: 0, qtyC: 6, grandTotal: 6 },
  { id: 22, name: 'Mattress 160X200', category: 'Bedroom', qtyA: 108, qtyB: 112, qtyC: 12, grandTotal: 232 },
  { id: 23, name: 'Mattress 80X200', category: 'Bedroom', qtyA: 216, qtyB: 528, qtyC: 60, grandTotal: 804 },
  { id: 24, name: 'Queen size bed', category: 'Bedroom', qtyA: 108, qtyB: 112, qtyC: 12, grandTotal: 232 },
  { id: 25, name: 'Twin bed 2x80X200', category: 'Bedroom', qtyA: 102, qtyB: 176, qtyC: 30, grandTotal: 308 },
  { id: 26, name: 'Twin bed 2x90X200', category: 'Bedroom', qtyA: 6, qtyB: 0, qtyC: 0, grandTotal: 6 },
  { id: 27, name: 'Outdoor Armchair M', category: 'Outdoor', qtyA: 276, qtyB: 484, qtyC: 66, grandTotal: 826 },
  { id: 28, name: 'Outdoor Chair', category: 'Outdoor', qtyA: 336, qtyB: 204, qtyC: 72, grandTotal: 612 },
  { id: 29, name: 'Outdoor Coffee Table', category: 'Outdoor', qtyA: 180, qtyB: 244, qtyC: 30, grandTotal: 454 },
  { id: 30, name: 'Outdoor Dining Table 220X80cm', category: 'Outdoor', qtyA: 42, qtyB: 34, qtyC: 0, grandTotal: 76 },
  { id: 31, name: 'Outdoor Dining Table D120cm', category: 'Outdoor', qtyA: 24, qtyB: 0, qtyC: 6, grandTotal: 30 },
  { id: 32, name: 'Outdoor Dining Table D75X75cm', category: 'Outdoor', qtyA: 0, qtyB: 0, qtyC: 6, grandTotal: 6 },
  { id: 33, name: 'Outdoor Dining Table D80cm', category: 'Outdoor', qtyA: 30, qtyB: 0, qtyC: 0, grandTotal: 30 },
  { id: 34, name: 'Outdoor Dining Table D90cm', category: 'Outdoor', qtyA: 0, qtyB: 0, qtyC: 6, grandTotal: 6 },
  { id: 35, name: 'Outdoor Side Table 40cm', category: 'Outdoor', qtyA: 0, qtyB: 44, qtyC: 12, grandTotal: 56 },
  { id: 36, name: 'Outdoor two seater sofa', category: 'Outdoor', qtyA: 78, qtyB: 34, qtyC: 18, grandTotal: 130 },
];

export const TOTAL_ITEMS_COUNT = procurementItems.reduce((sum, item) => sum + item.grandTotal, 0);

export const defaultUserData: UserItemData = {
  supplier: '',
  unitPrice: null,
  status: '',
  notes: '',
  supplierContact: '',
  catalogueRef: '',
  leadTime: '',
  imageUrl: '',
};

const STORAGE_KEY = 'cyprus-valley-procurement';

export function loadUserData(): Record<number, UserItemData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function saveUserData(data: Record<number, UserItemData>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getUserItemData(allData: Record<number, UserItemData>, id: number): UserItemData {
  return allData[id] || { ...defaultUserData };
}

export const concepts = [
  {
    id: 'A',
    name: 'HAPPINESS',
    buildings: 6,
    unitsPerBuilding: 31,
    totalUnits: 186,
    colorClass: 'happiness' as const,
    buildingIds: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
  },
  {
    id: 'B',
    name: 'WELLNESS',
    buildings: 2,
    unitsPerBuilding: 61,
    totalUnits: 122,
    colorClass: 'wellness' as const,
    buildingIds: ['B1', 'B2'],
  },
  {
    id: 'C',
    name: 'BOUTIQUE',
    buildings: 1,
    unitsPerBuilding: 30,
    totalUnits: 30,
    colorClass: 'boutique' as const,
    buildingIds: ['C1'],
  },
];
