import { useMemo } from 'react';
import { Building, Home, Package, Layers, CheckCircle } from 'lucide-react';
import { concepts, categoryEmojis } from '@/data/projectData';
import { MasterRow, computeProcurementItems, computeTotalItemsCount, ALL_BUILDINGS } from '@/data/masterData';
import { getBuildingData } from '@/data/unitFurnitureData';
import { loadAllSelections } from '@/data/selectionData';

function computeUnitTypeBreakdown(conceptId: 'A' | 'B' | 'C'): string {
  const { units } = getBuildingData(conceptId);
  const buildingsCount = ALL_BUILDINGS[conceptId].length;
  const counts: Record<string, number> = {};
  units.forEach(u => {
    if ((u as any).isZone) return;
    let perBuilding = 0;
    u.floors.forEach(f => { perBuilding += u.unitsPerFloor[f] || 0; });
    const desc = u.description || '';
    counts[desc] = (counts[desc] || 0) + perBuilding * buildingsCount;
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
  labelMap.forEach(([, label]) => {
    if (seen.has(label)) return;
    const sum = labelMap.filter(([, l]) => l === label).reduce((s, [k]) => s + (counts[k] || 0), 0);
    seen.add(label);
    if (sum > 0) parts.push(`${label}: ${sum}`);
  });
  Object.entries(counts).forEach(([desc, n]) => {
    if (!labelMap.some(([k]) => k === desc) && n > 0) parts.push(`${desc}: ${n}`);
  });
  return parts.join(' · ');
}

interface DashboardProps {
  onConceptClick?: (conceptId: 'A' | 'B' | 'C') => void;
  masterData: MasterRow[];
}

const conceptColorMap = {
  happiness: 'bg-happiness',
  wellness: 'bg-wellness',
  boutique: 'bg-boutique',
} as const;

const conceptBorderMap = {
  happiness: 'border-happiness',
  wellness: 'border-wellness',
  boutique: 'border-boutique',
} as const;

export default function Dashboard({ onConceptClick, masterData }: DashboardProps) {
  const procurementItems = useMemo(() => computeProcurementItems(masterData), [masterData]);
  const totalItemsCount = useMemo(() => computeTotalItemsCount(masterData), [masterData]);
  const uniqueItemTypes = useMemo(() => new Set(masterData.map(r => r.itemName)).size, [masterData]);

  const allSelections = useMemo(() => loadAllSelections(), []);
  const selectionCount = Object.keys(allSelections).length;
  const selectionPct = uniqueItemTypes > 0 ? Math.round((selectionCount / uniqueItemTypes) * 100) : 0;

  const kpis = [
    { label: 'Total Units', value: '338', icon: Home, description: 'Across 3 concepts' },
    { label: 'Buildings', value: '9', icon: Building, description: '6 × A, 2 × B, 1 × C' },
    { label: 'Item Types', value: String(uniqueItemTypes), icon: Package, description: 'FF&E categories' },
    { label: 'Total Items', value: totalItemsCount.toLocaleString(), icon: Layers, description: 'Grand procurement total' },
    { label: 'Selections', value: `${selectionPct}%`, icon: CheckCircle, description: `${selectionCount} of ${uniqueItemTypes} items selected` },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, i) => (
          <div
            key={kpi.label}
            className="bg-card rounded-lg border p-5 shadow-sm animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {kpi.label}
              </span>
              <kpi.icon className="h-4 w-4 text-accent" />
            </div>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
          </div>
        ))}
      </div>

      {/* Concept Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {concepts.map((concept, i) => {
          const totalItems = procurementItems
            .reduce((s, item) => s + (concept.id === 'A' ? item.qtyA : concept.id === 'B' ? item.qtyB : item.qtyC), 0);
          return (
            <div
              key={concept.id}
              onClick={() => onConceptClick?.(concept.id as 'A' | 'B' | 'C')}
              className={`bg-card rounded-lg border-l-4 ${conceptBorderMap[concept.colorClass]} p-5 shadow-sm animate-fade-in cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all`}
              style={{ animationDelay: `${(i + 4) * 80}ms` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-md ${conceptColorMap[concept.colorClass]} flex items-center justify-center`}>
                  <span className="text-sm font-bold text-primary-foreground">{concept.id}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{concept.name}</h3>
                  <p className="text-xs text-muted-foreground">Concept {concept.id} · Click to drill down</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-foreground">{concept.buildings}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Buildings</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{concept.totalUnits}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Units</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{totalItems.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Items</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
