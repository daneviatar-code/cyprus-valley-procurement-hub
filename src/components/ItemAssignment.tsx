import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { MasterRow, Concept, RoomType, ALL_BUILDING_LIST, conceptForBuilding } from '@/data/masterData';
import { buildingAUnits, buildingBUnits, buildingCUnits, UnitType } from '@/data/unitFurnitureData';

const CATEGORIES: RoomType[] = [
  'Dining', 'Living Room', 'Bedroom', 'Outdoor', 'Bathroom', 'Kitchen',
  'Sauna & Wellness', 'Accessories & Decor', 'Mirrors', 'Electrical & Appliances',
  'In-Room Safes', 'Cutlery & Dining Sets', 'Curtains & Window Treatments',
];

interface Assignment {
  building: string;
  unitCode: string;
  qty: number;
}

interface ItemFormState {
  itemName: string;
  category: RoomType | '';
  unitPrice: string;
  supplier: string;
  assignments: Assignment[];
}

const ITEM_META_KEY = 'cyprus-valley-item-meta';

interface ItemMeta {
  unitPrice: number;
  supplier: string;
}

function loadItemMeta(): Record<string, ItemMeta> {
  try {
    const raw = localStorage.getItem(ITEM_META_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveItemMeta(data: Record<string, ItemMeta>) {
  localStorage.setItem(ITEM_META_KEY, JSON.stringify(data));
}

function getUnitsForBuilding(building: string): UnitType[] {
  const concept = conceptForBuilding(building);
  switch (concept) {
    case 'A': return buildingAUnits;
    case 'B': return buildingBUnits;
    case 'C': return buildingCUnits;
  }
}

const emptyForm: ItemFormState = {
  itemName: '',
  category: '',
  unitPrice: '',
  supplier: '',
  assignments: [],
};

interface Props {
  masterData: MasterRow[];
  onUpdate: (data: MasterRow[]) => void;
}

export default function ItemAssignment({ masterData, onUpdate }: Props) {
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState<ItemFormState>({ ...emptyForm });
  const [editingItem, setEditingItem] = useState<string | null>(null); // itemName being edited
  const [itemMeta, setItemMeta] = useState<Record<string, ItemMeta>>(loadItemMeta);
  const [newAssignment, setNewAssignment] = useState<{ building: string; unitCode: string; qty: string }>({
    building: '',
    unitCode: '',
    qty: '1',
  });

  // Group masterData rows by itemName to build the table
  const itemRows = useMemo(() => {
    const map = new Map<string, { category: RoomType; assignments: { building: string; unitCode: string; qty: number; rowId: string }[] }>();
    masterData.forEach(row => {
      if (!map.has(row.itemName)) {
        map.set(row.itemName, { category: row.roomType, assignments: [] });
      }
      map.get(row.itemName)!.assignments.push({
        building: row.building,
        unitCode: row.unitCode,
        qty: row.qtyPerUnit,
        rowId: row.id,
      });
    });
    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      category: data.category,
      assignments: data.assignments,
      meta: itemMeta[name],
    }));
  }, [masterData, itemMeta]);

  const availableUnitCodes = useMemo(() => {
    if (!newAssignment.building) return [];
    return getUnitsForBuilding(newAssignment.building).map(u => u.code);
  }, [newAssignment.building]);

  function addAssignment() {
    if (!newAssignment.building || !newAssignment.unitCode || !newAssignment.qty) return;
    const exists = form.assignments.find(a => a.building === newAssignment.building && a.unitCode === newAssignment.unitCode);
    if (exists) return;
    setForm(prev => ({
      ...prev,
      assignments: [...prev.assignments, {
        building: newAssignment.building,
        unitCode: newAssignment.unitCode,
        qty: parseInt(newAssignment.qty) || 1,
      }],
    }));
    setNewAssignment({ building: '', unitCode: '', qty: '1' });
  }

  function removeAssignment(idx: number) {
    setForm(prev => ({
      ...prev,
      assignments: prev.assignments.filter((_, i) => i !== idx),
    }));
  }

  function openAdd() {
    setForm({ ...emptyForm });
    setEditingItem(null);
    setShowDialog(true);
  }

  function openEdit(itemName: string) {
    const item = itemRows.find(r => r.name === itemName);
    if (!item) return;
    setForm({
      itemName: item.name,
      category: item.category,
      unitPrice: item.meta?.unitPrice?.toString() || '',
      supplier: item.meta?.supplier || '',
      assignments: item.assignments.map(a => ({ building: a.building, unitCode: a.unitCode, qty: a.qty })),
    });
    setEditingItem(itemName);
    setShowDialog(true);
  }

  function handleSave() {
    if (!form.itemName.trim() || !form.category || form.assignments.length === 0) return;

    // Remove old rows for this item if editing
    let newData = editingItem
      ? masterData.filter(r => r.itemName !== editingItem)
      : [...masterData];

    // Also remove if adding an item that already exists (overwrite)
    if (!editingItem) {
      newData = newData.filter(r => r.itemName !== form.itemName.trim());
    }

    // Add new rows
    const now = Date.now();
    form.assignments.forEach((a, i) => {
      const concept = conceptForBuilding(a.building);
      newData.push({
        id: `assign-${now}-${i}`,
        concept,
        building: a.building,
        unitCode: a.unitCode,
        roomType: form.category as RoomType,
        itemName: form.itemName.trim(),
        qtyPerUnit: a.qty,
      });
    });

    onUpdate(newData);

    // Save meta
    const newMeta = { ...itemMeta };
    if (editingItem && editingItem !== form.itemName.trim()) {
      delete newMeta[editingItem];
    }
    newMeta[form.itemName.trim()] = {
      unitPrice: parseFloat(form.unitPrice) || 0,
      supplier: form.supplier,
    };
    setItemMeta(newMeta);
    saveItemMeta(newMeta);

    setShowDialog(false);
  }

  function handleDelete(itemName: string) {
    const newData = masterData.filter(r => r.itemName !== itemName);
    onUpdate(newData);
    const newMeta = { ...itemMeta };
    delete newMeta[itemName];
    setItemMeta(newMeta);
    saveItemMeta(newMeta);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Item Assignment</h2>
          <p className="text-xs text-muted-foreground">Create FF&E items and assign them to buildings &amp; room types</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" /> Add Item
        </Button>
      </div>

      {/* Items Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[200px]">Item Name</TableHead>
              <TableHead className="w-[160px]">Category</TableHead>
              <TableHead className="w-[100px] text-right">Unit Price €</TableHead>
              <TableHead className="w-[140px]">Supplier</TableHead>
              <TableHead>Assignments</TableHead>
              <TableHead className="w-[100px] text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No items yet. Click "Add Item" to get started.
                </TableCell>
              </TableRow>
            )}
            {itemRows.map(item => (
              <TableRow key={item.name}>
                <TableCell className="font-medium text-sm">{item.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.category}</TableCell>
                <TableCell className="text-sm text-right font-mono">
                  {item.meta?.unitPrice ? `€${item.meta.unitPrice.toLocaleString()}` : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.meta?.supplier || '—'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {item.assignments.map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                        {a.building}/{a.unitCode} ×{a.qty}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item.name)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(item.name)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Item details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Item Name</label>
                <Input
                  value={form.itemName}
                  onChange={e => setForm(p => ({ ...p, itemName: e.target.value }))}
                  placeholder="e.g. Dining Chair Oak"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v as RoomType }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Unit Price €</label>
                <Input
                  type="number"
                  value={form.unitPrice}
                  onChange={e => setForm(p => ({ ...p, unitPrice: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Supplier</label>
                <Input
                  value={form.supplier}
                  onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
                  placeholder="e.g. Arper"
                />
              </div>
            </div>

            {/* Assignments */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Building &amp; Unit Code Assignments
              </label>

              {form.assignments.length > 0 && (
                <div className="space-y-1 mb-3">
                  {form.assignments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted/50 rounded px-3 py-1.5 text-sm">
                      <span className="font-medium">{a.building}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{a.unitCode}</span>
                      <span className="text-muted-foreground">×</span>
                      <span className="font-mono">{a.qty}</span>
                      <button onClick={() => removeAssignment(i)} className="ml-auto text-muted-foreground hover:text-destructive">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    value={newAssignment.building}
                    onValueChange={v => setNewAssignment(p => ({ ...p, building: v, unitCode: '' }))}
                  >
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Building" /></SelectTrigger>
                    <SelectContent>
                      {ALL_BUILDING_LIST.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Select
                    value={newAssignment.unitCode}
                    onValueChange={v => setNewAssignment(p => ({ ...p, unitCode: v }))}
                    disabled={!newAssignment.building}
                  >
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Unit Code" /></SelectTrigger>
                    <SelectContent>
                      {availableUnitCodes.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <Input
                    type="number"
                    className="h-9 text-xs"
                    value={newAssignment.qty}
                    onChange={e => setNewAssignment(p => ({ ...p, qty: e.target.value }))}
                    min={1}
                    placeholder="Qty"
                  />
                </div>
                <Button size="sm" variant="outline" className="h-9" onClick={addAssignment} disabled={!newAssignment.building || !newAssignment.unitCode}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={!form.itemName.trim() || !form.category || form.assignments.length === 0}
              >
                {editingItem ? 'Save Changes' : 'Add Item'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
