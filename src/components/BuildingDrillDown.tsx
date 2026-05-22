import { useState, useMemo } from 'react';
import { X, Building, Layers, Home } from 'lucide-react';
import { concepts, categoryEmojis, Category } from '@/data/projectData';
import {
  getBuildingData,
  getFloors,
  UnitType,
} from '@/data/unitFurnitureData';
import {
  MasterRow,
  computeFurnitureForConcept,
  ALL_BUILDINGS,
  conceptForBuilding,
  isUnitCodeInBuilding,
} from '@/data/masterData';

interface BuildingDrillDownProps {
  conceptId: 'A' | 'B' | 'C';
  onClose: () => void;
  masterData: MasterRow[];
}

type DrillView = 'floor' | 'unitType' | 'category';

const conceptColorMap: Record<string, string> = {
  A: 'bg-happiness',
  B: 'bg-wellness',
  C: 'bg-boutique',
};

const conceptBorderMap: Record<string, string> = {
  A: 'border-happiness',
  B: 'border-wellness',
  C: 'border-boutique',
};

export default function BuildingDrillDown({ conceptId, onClose, masterData }: BuildingDrillDownProps) {
  const [view, setView] = useState<DrillView>('floor');
  const [selectedBuilding, setSelectedBuilding] = useState(ALL_BUILDINGS[conceptId][0]);

  const concept = concepts.find(c => c.id === conceptId)!;
  const { units } = getBuildingData(conceptId);
  const activeUnits = useMemo(
    () => units.filter(u => isUnitCodeInBuilding(conceptId, u.code, selectedBuilding)),
    [units, conceptId, selectedBuilding]
  );
  const furniture = useMemo(() => computeFurnitureForConcept(masterData, conceptId, selectedBuilding), [masterData, conceptId, selectedBuilding]);
  const floors = getFloors(conceptId);

  // Instances per unit in ONE building (no multiplier)
  const unitTotalInstances = useMemo(() => {
    const map: Record<string, number> = {};
    activeUnits.forEach(u => {
      let total = 0;
      u.floors.forEach(f => { total += u.unitsPerFloor[f] || 0; });
      map[u.code] = total;
    });
    return map;
  }, [activeUnits]);

  // Apartment-type counts for the selected building (excludes zones/public areas)
  const unitTypeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    units.forEach(u => {
      if ((u as any).isZone) return;
      const desc = u.description || '';
      counts[desc] = (counts[desc] || 0) + (unitTotalInstances[u.code] || 0);
    });
    const labelMap: Array<[string, string]> = [
      ['Studio', 'Studio'],
      ['1BD', '1-Bedroom'],
      ['2BD', '2-Bedroom'],
      ['3BD', '3-Bedroom'],
      ['4BD Penthouse', '4-Bedroom'],
      ['4BD', '4-Bedroom'],
    ];
    const seen = new Set<string>();
    const parts: string[] = [];
    let total = 0;
    labelMap.forEach(([key, label]) => {
      if (seen.has(label)) return;
      // Sum any descriptions that map to the same label (e.g. 4BD + 4BD Penthouse)
      const sum = labelMap
        .filter(([, l]) => l === label)
        .reduce((s, [k]) => s + (counts[k] || 0), 0);
      seen.add(label);
      if (sum > 0) {
        parts.push(`${label}: ${sum}`);
        total += sum;
      }
    });
    // Include any other descriptions not in our map
    Object.entries(counts).forEach(([desc, n]) => {
      if (!labelMap.some(([k]) => k === desc) && n > 0) {
        parts.push(`${desc}: ${n}`);
        total += n;
      }
    });
    parts.push(`Total: ${total} units`);
    return parts.join(' · ');
  }, [units, unitTotalInstances]);

  const floorData = useMemo(() => {
    return floors.map(floor => {
      const floorUnits = units.filter(u => u.floors.includes(floor));
      const itemTotals: Record<string, number> = {};

      floorUnits.forEach(u => {
        const countOnFloor = u.unitsPerFloor[floor] || 0;
        furniture.forEach(f => {
          const perUnit = f.quantities[u.code] || 0;
          if (perUnit > 0) {
            itemTotals[f.itemName] = (itemTotals[f.itemName] || 0) + perUnit * countOnFloor;
          }
        });
      });

      return {
        floor,
        label: floor === 0 ? 'Ground Floor' : `Floor ${floor}`,
        unitCodes: floorUnits.map(u => u.code),
        totalItems: Object.values(itemTotals).reduce((s, v) => s + v, 0),
        items: itemTotals,
      };
    });
  }, [floors, units, furniture]);

  const unitTypeData = useMemo(() => {
    const descMap: Record<string, UnitType[]> = {};
    units.forEach(u => {
      if (!descMap[u.description]) descMap[u.description] = [];
      descMap[u.description].push(u);
    });

    return Object.entries(descMap).map(([desc, unitGroup]) => {
      const itemTotals: Record<string, number> = {};
      let totalInstances = 0;

      unitGroup.forEach(u => {
        const instances = unitTotalInstances[u.code] || 0;
        totalInstances += instances;
        furniture.forEach(f => {
          const perUnit = f.quantities[u.code] || 0;
          if (perUnit > 0) {
            itemTotals[f.itemName] = (itemTotals[f.itemName] || 0) + perUnit * instances;
          }
        });
      });

      return {
        description: desc,
        codes: unitGroup.map(u => u.code),
        totalInstances,
        totalItems: Object.values(itemTotals).reduce((s, v) => s + v, 0),
        items: itemTotals,
      };
    });
  }, [units, unitTotalInstances, furniture]);

  const categoryData = useMemo(() => {
    const categories: Category[] = ['Dining', 'Living Room', 'Bedroom', 'Outdoor', 'Bathroom', 'Kitchen', 'Sauna & Wellness', 'Accessories & Decor', 'Mirrors', 'Electrical & Appliances', 'In-Room Safes', 'Cutlery & Dining Sets', 'Curtains & Window Treatments'];
    return categories.map(cat => {
      const catFurniture = furniture.filter(f => f.category === cat);
      let totalQty = 0;
      const items: Record<string, number> = {};

      catFurniture.forEach(f => {
        units.forEach(u => {
          const perUnit = f.quantities[u.code] || 0;
          const instances = unitTotalInstances[u.code] || 0;
          if (perUnit > 0) {
            const qty = perUnit * instances;
            items[f.itemName] = (items[f.itemName] || 0) + qty;
            totalQty += qty;
          }
        });
      });

      return { category: cat, emoji: categoryEmojis[cat], totalQty, items };
    });
  }, [furniture, units, unitTotalInstances]);

  const thClass = 'px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left whitespace-nowrap';
  const tdClass = 'px-3 py-2 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4">
      <div className="absolute inset-0 bg-foreground/20" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-card rounded-xl shadow-xl border overflow-hidden animate-fade-in flex flex-col">
        <div className={`px-6 py-4 border-b flex items-center justify-between border-l-4 ${conceptBorderMap[conceptId]}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${conceptColorMap[conceptId]} flex items-center justify-center`}>
              <span className="text-lg font-bold text-primary-foreground">{conceptId}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{concept.name} — Building Drill-Down</h2>
              <p className="text-xs text-muted-foreground">
                Viewing {selectedBuilding} · {floors.length} floors
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {unitTypeBreakdown}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Building selector + view mode */}
        <div className="px-6 py-3 border-b bg-muted/30 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Building:</span>
            {ALL_BUILDINGS[conceptId].map(b => (
              <button
                key={b}
                onClick={() => setSelectedBuilding(b)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  selectedBuilding === b
                    ? `${conceptColorMap[conceptId]} text-primary-foreground`
                    : 'bg-card text-muted-foreground hover:text-foreground border'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {(['floor', 'unitType', 'category'] as DrillView[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {v === 'floor' && '🏢 By Floor'}
                {v === 'unitType' && '🏠 By Unit Type'}
                {v === 'category' && '📦 By Category'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {view === 'floor' && floorData.map(fd => (
            <div key={fd.floor} className="bg-muted/20 rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-accent" />
                  <span className="font-semibold text-sm text-foreground">{fd.label}</span>
                  <span className="text-xs text-muted-foreground">({fd.unitCodes.join(', ')})</span>
                </div>
                <span className="text-xs font-medium text-accent">{fd.totalItems.toLocaleString()} items</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b"><th className={thClass}>Item</th><th className={`${thClass} text-right`}>Quantity</th></tr></thead>
                  <tbody>
                    {Object.entries(fd.items).sort(([,a],[,b]) => b - a).map(([name, qty]) => (
                      <tr key={name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className={tdClass}>{name}</td>
                        <td className={`${tdClass} text-right font-mono font-medium text-accent`}>{qty.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {view === 'unitType' && unitTypeData.map(ut => (
            <div key={ut.description} className="bg-muted/20 rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-accent" />
                  <span className="font-semibold text-sm text-foreground">{ut.description}</span>
                  <span className="text-xs text-muted-foreground">({ut.codes.join(', ')})</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">{ut.totalInstances} instances</span>
                  <span className="font-medium text-accent">{ut.totalItems.toLocaleString()} items</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b"><th className={thClass}>Item</th><th className={`${thClass} text-right`}>Quantity</th></tr></thead>
                  <tbody>
                    {Object.entries(ut.items).sort(([,a],[,b]) => b - a).map(([name, qty]) => (
                      <tr key={name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className={tdClass}>{name}</td>
                        <td className={`${tdClass} text-right font-mono font-medium text-accent`}>{qty.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {view === 'category' && categoryData.map(cd => (
            <div key={cd.category} className="bg-muted/20 rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{cd.emoji}</span>
                  <span className="font-semibold text-sm text-foreground">{cd.category}</span>
                </div>
                <span className="text-xs font-medium text-accent">{cd.totalQty.toLocaleString()} items</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b"><th className={thClass}>Item</th><th className={`${thClass} text-right`}>Quantity</th></tr></thead>
                  <tbody>
                    {Object.entries(cd.items).sort(([,a],[,b]) => b - a).map(([name, qty]) => (
                      <tr key={name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className={tdClass}>{name}</td>
                        <td className={`${tdClass} text-right font-mono font-medium text-accent`}>{qty.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
