import { useState, useMemo, useRef } from 'react';
import { Printer } from 'lucide-react';
import { Concept } from '@/data/masterData';
import {
  buildingAUnits,
  buildingBUnits,
  buildingCUnits,
  UnitType,
} from '@/data/unitFurnitureData';
import { loadPackage, PackageItem } from '@/data/packageData';
import { concepts } from '@/data/projectData';
import { loadSelections, Selection } from '@/data/selectionData';

const CONCEPTS: { id: Concept; label: string }[] = [
  { id: 'A', label: 'Happiness (A)' },
  { id: 'B', label: 'Wellness (B)' },
  { id: 'C', label: 'Boutique (C)' },
];

function getUnits(c: Concept): UnitType[] {
  switch (c) {
    case 'A': return buildingAUnits;
    case 'B': return buildingBUnits;
    case 'C': return buildingCUnits;
  }
}

function dedup(units: UnitType[]): UnitType[] {
  const seen = new Set<string>();
  return units.filter(u => {
    if (seen.has(u.code)) return false;
    seen.add(u.code);
    return true;
  });
}

export default function PricingSheet() {
  const [concept, setConcept] = useState<Concept>('A');
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const printRef = useRef<HTMLDivElement>(null);

  const units = useMemo(() => dedup(getUnits(concept)), [concept]);
  const regularUnits = useMemo(() => units.filter(u => !u.isZone), [units]);
  const zoneUnits = useMemo(() => units.filter(u => u.isZone), [units]);

  const activeUnit = selectedUnit && units.some(u => u.code === selectedUnit)
    ? selectedUnit
    : units[0]?.code || '';

  const pkg = useMemo(() => loadPackage(concept, activeUnit), [concept, activeUnit]);
  const selections = useMemo(() => loadSelections(concept, activeUnit), [concept, activeUnit]);

  // Merge selection data into package items
  const enrichedItems = useMemo(() => {
    return pkg.items.map(item => {
      const sel = selections[item.itemName];
      return {
        ...item,
        supplier: sel?.supplier || item.supplier,
        unitPrice: sel?.unitPrice ?? item.unitPrice,
      };
    });
  }, [pkg.items, selections]);

  const grandTotal = useMemo(
    () => enrichedItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0),
    [enrichedItems]
  );

  const conceptInfo = concepts.find(c => c.id === concept);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Pricing Sheet — ${conceptInfo?.name} — ${activeUnit}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1a1a1a; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        .text-right { text-align: right; }
        .grand-total { font-size: 14px; font-weight: 700; }
        h2 { margin-bottom: 4px; }
        .subtitle { color: #666; font-size: 13px; margin-bottom: 16px; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pricing Sheet</h2>
          <p className="text-xs text-muted-foreground">Unit Price €, Line Total €, and Grand Total per unit package</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>

      {/* Concept selector */}
      <div className="flex gap-2">
        {CONCEPTS.map(c => (
          <button
            key={c.id}
            onClick={() => { setConcept(c.id); setSelectedUnit(''); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              concept === c.id
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Unit selector */}
      <div className="bg-card border rounded-lg p-1.5 space-y-2">
        <div className="flex flex-wrap gap-1">
          {regularUnits.map(u => (
            <button
              key={u.code}
              onClick={() => setSelectedUnit(u.code)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeUnit === u.code
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              {u.code} <span className="opacity-60">({u.description})</span>
            </button>
          ))}
        </div>
        {zoneUnits.length > 0 && (
          <>
            <div className="border-t pt-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold ml-1">Common Areas / Zones</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {zoneUnits.map(u => (
                <button
                  key={u.code}
                  onClick={() => setSelectedUnit(u.code)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeUnit === u.code
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  {u.code} <span className="opacity-60">({u.description})</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Printable pricing table */}
      <div ref={printRef}>
        <h2 style={{ marginBottom: 4 }}>Pricing Sheet — {conceptInfo?.name} — Unit {activeUnit}</h2>
        <div className="subtitle" style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
          {units.find(u => u.code === activeUnit)?.description} · {pkg.items.length} items
        </div>

        <div className="border rounded-lg bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-8">#</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Item Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Category</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Supplier</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-16">Qty</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-28">Unit Price €</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-28">Line Total €</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {enrichedItems.map((item, i) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-foreground">{item.itemName || '—'}</td>
                    <td className="px-4 py-2 text-muted-foreground">{item.category}</td>
                    <td className="px-4 py-2 text-muted-foreground">{item.supplier || '—'}</td>
                    <td className="px-4 py-2 text-right text-foreground">{item.quantity}</td>
                    <td className="px-4 py-2 text-right text-foreground">
                      {item.unitPrice > 0
                        ? `€${item.unitPrice.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-foreground">
                      {item.quantity * item.unitPrice > 0
                        ? `€${(item.quantity * item.unitPrice).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30">
                  <td colSpan={6} className="px-4 py-3 text-right font-semibold text-foreground text-sm">
                    Grand Total
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-foreground text-sm grand-total">
                    €{grandTotal.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
