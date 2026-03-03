import { useState, useMemo, useCallback } from 'react';
import { Concept } from '@/data/masterData';
import {
  buildingAUnits,
  buildingBUnits,
  buildingCUnits,
  UnitType,
  getUnitFloorPlanUrl,
} from '@/data/unitFurnitureData';
import {
  PackageItem,
  PackageData,
  PackageCategory,
  loadPackage,
  savePackage,
  createNewItem,
} from '@/data/packageData';
import ZoomableImage from './ZoomableImage';
import { Plus, Trash2, Package } from 'lucide-react';

const CONCEPTS: { id: Concept; label: string; color: string }[] = [
  { id: 'A', label: 'Happiness (A)', color: 'bg-[hsl(var(--happiness))] text-[hsl(var(--happiness-foreground))]' },
  { id: 'B', label: 'Wellness (B)', color: 'bg-[hsl(var(--wellness))] text-[hsl(var(--wellness-foreground))]' },
  { id: 'C', label: 'Boutique (C)', color: 'bg-[hsl(var(--boutique))] text-[hsl(var(--boutique-foreground))]' },
];

const CATEGORIES: PackageCategory[] = ['Dining', 'Living Room', 'Bedroom', 'Outdoor'];

function getUnitsForConcept(concept: Concept): UnitType[] {
  switch (concept) {
    case 'A': return buildingAUnits;
    case 'B': return buildingBUnits;
    case 'C': return buildingCUnits;
  }
}

function getUnitInstanceCount(unit: UnitType): number {
  let total = 0;
  unit.floors.forEach(f => { total += unit.unitsPerFloor[f] || 0; });
  return total;
}

function getBuildingCount(concept: Concept): number {
  switch (concept) {
    case 'A': return 6;
    case 'B': return 2;
    case 'C': return 1;
  }
}

export default function PackageEditor() {
  const [concept, setConcept] = useState<Concept>('A');
  const [selectedUnitCode, setSelectedUnitCode] = useState<string>('');

  const units = useMemo(() => getUnitsForConcept(concept), [concept]);
  const unitCodes = useMemo(() => {
    const seen = new Set<string>();
    return units.filter(u => {
      if (seen.has(u.code)) return false;
      seen.add(u.code);
      return true;
    });
  }, [units]);

  // Reset unit code when concept changes
  const activeUnitCode = selectedUnitCode && unitCodes.some(u => u.code === selectedUnitCode)
    ? selectedUnitCode
    : unitCodes[0]?.code || '';

  const handleConceptChange = (c: Concept) => {
    setConcept(c);
    setSelectedUnitCode('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Package className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold text-foreground">Package Editor</h2>
        <span className="text-xs text-muted-foreground">Configure furniture packages per unit type</span>
      </div>

      {/* Concept selector */}
      <div className="flex gap-2">
        {CONCEPTS.map(c => (
          <button
            key={c.id}
            onClick={() => handleConceptChange(c.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              concept === c.id
                ? c.color + ' shadow-md'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Unit code tabs */}
      <div className="flex flex-wrap gap-1 bg-card border rounded-lg p-1.5">
        {unitCodes.map(u => (
          <button
            key={u.code}
            onClick={() => setSelectedUnitCode(u.code)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeUnitCode === u.code
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            {u.code}
            <span className="ml-1 opacity-60">({u.description})</span>
          </button>
        ))}
      </div>

      {/* Package content */}
      {activeUnitCode && (
        <UnitPackageEditor
          key={`${concept}-${activeUnitCode}`}
          concept={concept}
          unitCode={activeUnitCode}
          units={units}
        />
      )}

      {/* Building-level summary */}
      <BuildingSummary concept={concept} units={unitCodes} />
    </div>
  );
}

// ── Per Unit Code Editor ──
function UnitPackageEditor({
  concept,
  unitCode,
  units,
}: {
  concept: Concept;
  unitCode: string;
  units: UnitType[];
}) {
  const [pkg, setPkg] = useState<PackageData>(() => loadPackage(concept, unitCode));

  const update = useCallback(
    (newPkg: PackageData) => {
      setPkg(newPkg);
      savePackage(concept, unitCode, newPkg);
    },
    [concept, unitCode]
  );

  const updateItem = useCallback(
    (id: string, field: keyof PackageItem, value: string | number) => {
      update({
        items: pkg.items.map(it =>
          it.id === id ? { ...it, [field]: value } : it
        ),
      });
    },
    [pkg, update]
  );

  const addItem = () => {
    update({ items: [...pkg.items, createNewItem()] });
  };

  const deleteItem = (id: string) => {
    update({ items: pkg.items.filter(it => it.id !== id) });
  };

  const floorPlanUrl = getUnitFloorPlanUrl(concept, unitCode);
  const unit = units.find(u => u.code === unitCode);

  // Category subtotals
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    CATEGORIES.forEach(cat => {
      totals[cat] = pkg.items
        .filter(it => it.category === cat)
        .reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
    });
    return totals;
  }, [pkg.items]);

  const totalPrice = useMemo(
    () => pkg.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0),
    [pkg.items]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Floor plan panel */}
      <div className="lg:col-span-1">
        <div className="sticky top-20">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Floor Plan — {unitCode} ({unit?.description || ''})
          </div>
          {floorPlanUrl ? (
            <ZoomableImage src={floorPlanUrl} alt={`Unit ${unitCode}`} className="h-[500px]" />
          ) : (
            <div className="h-[500px] rounded-lg border bg-muted/20 flex items-center justify-center text-muted-foreground text-sm">
              No floor plan available
            </div>
          )}
        </div>
      </div>

      {/* Items table + summary */}
      <div className="lg:col-span-2 space-y-4">
        {/* Table */}
        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item Name</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">Category</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground w-16">Qty</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">Unit € </th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">Total €</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">Supplier</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-32">Notes</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pkg.items.map(item => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-1.5">
                      <input
                        className="w-full bg-transparent border-0 outline-none text-foreground text-xs focus:ring-1 focus:ring-accent rounded px-1 py-0.5"
                        value={item.itemName}
                        onChange={e => updateItem(item.id, 'itemName', e.target.value)}
                        placeholder="Item name"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        className="w-full bg-transparent border rounded text-xs px-1 py-0.5 text-foreground focus:ring-1 focus:ring-accent outline-none"
                        value={item.category}
                        onChange={e => updateItem(item.id, 'category', e.target.value)}
                      >
                        {CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min={0}
                        className="w-full bg-transparent border-0 outline-none text-right text-foreground text-xs focus:ring-1 focus:ring-accent rounded px-1 py-0.5"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, 'quantity', Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-full bg-transparent border-0 outline-none text-right text-foreground text-xs focus:ring-1 focus:ring-accent rounded px-1 py-0.5"
                        value={item.unitPrice || ''}
                        onChange={e => updateItem(item.id, 'unitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium text-foreground">
                      {(item.quantity * item.unitPrice).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        className="w-full bg-transparent border-0 outline-none text-foreground text-xs focus:ring-1 focus:ring-accent rounded px-1 py-0.5"
                        value={item.supplier}
                        onChange={e => updateItem(item.id, 'supplier', e.target.value)}
                        placeholder="—"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        className="w-full bg-transparent border-0 outline-none text-foreground text-xs focus:ring-1 focus:ring-accent rounded px-1 py-0.5"
                        value={item.notes}
                        onChange={e => updateItem(item.id, 'notes', e.target.value)}
                        placeholder="—"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete item"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-3 py-2">
            <button
              onClick={addItem}
              className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 font-medium transition-colors"
            >
              <Plus className="h-3 w-3" /> Add item
            </button>
          </div>
        </div>

        {/* Summary panel */}
        <div className="border rounded-lg bg-card p-4 space-y-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Package Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CATEGORIES.map(cat => (
              <div key={cat} className="bg-muted/40 rounded-md px-3 py-2">
                <div className="text-[10px] text-muted-foreground uppercase">{cat}</div>
                <div className="text-sm font-semibold text-foreground">
                  €{categoryTotals[cat].toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-xs font-medium text-muted-foreground">Total Package Price ({unitCode})</span>
            <span className="text-lg font-bold text-foreground">
              €{totalPrice.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Building-level Summary ──
function BuildingSummary({ concept, units }: { concept: Concept; units: UnitType[] }) {
  const buildingCount = getBuildingCount(concept);

  const rows = useMemo(() => {
    return units.map(u => {
      const pkg = loadPackage(concept, u.code);
      const pkgTotal = pkg.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
      const instancesPerBuilding = getUnitInstanceCount(u);
      return {
        code: u.code,
        description: u.description,
        pkgTotal,
        instancesPerBuilding,
        extendedPerBuilding: pkgTotal * instancesPerBuilding,
        extendedTotal: pkgTotal * instancesPerBuilding * buildingCount,
      };
    });
  }, [concept, units, buildingCount]);

  const grandTotal = useMemo(
    () => rows.reduce((s, r) => s + r.extendedTotal, 0),
    [rows]
  );

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">
          Building-Level Summary — Concept {concept}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({buildingCount} building{buildingCount > 1 ? 's' : ''})
          </span>
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/20 border-b">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Unit Code</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Package €</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Units/Bldg</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Extended/Bldg €</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">
                Total ({buildingCount} bldg{buildingCount > 1 ? 's' : ''}) €
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(r => (
              <tr key={r.code} className="hover:bg-muted/20">
                <td className="px-4 py-2 font-medium text-foreground">{r.code}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.description}</td>
                <td className="px-4 py-2 text-right">
                  {r.pkgTotal > 0
                    ? `€${r.pkgTotal.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="px-4 py-2 text-right">{r.instancesPerBuilding}</td>
                <td className="px-4 py-2 text-right">
                  {r.extendedPerBuilding > 0
                    ? `€${r.extendedPerBuilding.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="px-4 py-2 text-right font-medium">
                  {r.extendedTotal > 0
                    ? `€${r.extendedTotal.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : <span className="text-muted-foreground/50">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/30">
              <td colSpan={5} className="px-4 py-2.5 text-right text-sm font-semibold text-foreground">
                Grand Total
              </td>
              <td className="px-4 py-2.5 text-right text-sm font-bold text-accent">
                €{grandTotal.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
