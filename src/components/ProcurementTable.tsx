import { useState, useMemo } from 'react';
import {
  categoryEmojis,
  UserItemData,
  getUserItemData,
} from '@/data/projectData';
import { loadAllSelections } from '@/data/selectionData';
import {
  getBuildingData,
  UnitType,
} from '@/data/unitFurnitureData';
import {
  MasterRow,
  ComputedProcurementItem,
  computeFurnitureForConcept,
  computeProcurementItems,
  getUnitCodesForConcept,
  ALL_BUILDINGS,
  ALL_BUILDING_LIST,
  conceptForBuilding,
} from '@/data/masterData';
import StatusBadge from './StatusBadge';
import FilterBar, { ViewMode } from './FilterBar';
import ExportButton from './ExportButton';
import ItemDetailPanel from './ItemDetailPanel';

interface ProcurementTableProps {
  userData: Record<number, UserItemData>;
  onUpdateItem: (id: number, data: UserItemData) => void;
  procurementItems: ComputedProcurementItem[];
  masterData: MasterRow[];
}

function getConceptId(concept: string): 'A' | 'B' | 'C' | null {
  if (concept.includes('A')) return 'A';
  if (concept.includes('B')) return 'B';
  if (concept.includes('C')) return 'C';
  return null;
}

export default function ProcurementTable({ userData, onUpdateItem, procurementItems, masterData }: ProcurementTableProps) {
  const allSelections = useMemo(() => loadAllSelections(), []);
  const [search, setSearch] = useState('');
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([]);
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedUnitCodes, setSelectedUnitCodes] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('byItem');
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [roomTypeConceptOverride, setRoomTypeConceptOverride] = useState<'A' | 'B' | 'C'>('A');

  // Available buildings based on concept filter
  const availableBuildings = useMemo(() => {
    const conceptIds = selectedConcepts.map(c => getConceptId(c)).filter(Boolean) as ('A' | 'B' | 'C')[];
    if (conceptIds.length === 0) return ALL_BUILDING_LIST;
    return conceptIds.flatMap(id => ALL_BUILDINGS[id]);
  }, [selectedConcepts]);

  // Recompute procurement items when building filter is active
  const effectiveProcurement = useMemo(() => {
    if (selectedBuildings.length === 0) return procurementItems;
    const filtered = masterData.filter(r => selectedBuildings.includes(r.building));
    return computeProcurementItems(filtered);
  }, [selectedBuildings, masterData, procurementItems]);

  const availableUnitCodes = useMemo(() => {
    const conceptIds = selectedConcepts.map(c => getConceptId(c)).filter(Boolean) as ('A' | 'B' | 'C')[];
    if (conceptIds.length === 0 && selectedBuildings.length === 0) return [] as string[];
    const codes: string[] = [];
    if (selectedBuildings.length > 0) {
      selectedBuildings.forEach(b => {
        const concept = conceptForBuilding(b);
        getUnitCodesForConcept(masterData, concept, b).forEach(c => {
          if (!codes.includes(c)) codes.push(c);
        });
      });
    } else {
      conceptIds.forEach(id => {
        getUnitCodesForConcept(masterData, id).forEach(c => {
          if (!codes.includes(c)) codes.push(c);
        });
      });
    }
    return codes.sort();
  }, [selectedConcepts, selectedBuildings, masterData]);

  const roomTypeConcept = useMemo((): 'A' | 'B' | 'C' => {
    if (selectedBuildings.length === 1) return conceptForBuilding(selectedBuildings[0]);
    if (selectedConcepts.length === 1) return getConceptId(selectedConcepts[0]) || roomTypeConceptOverride;
    return roomTypeConceptOverride;
  }, [selectedConcepts, selectedBuildings, roomTypeConceptOverride]);

  const roomTypeBuilding = useMemo((): string | undefined => {
    if (selectedBuildings.length === 1) return selectedBuildings[0];
    return undefined;
  }, [selectedBuildings]);

  const roomTypeUnits = useMemo(() => {
    const { units } = getBuildingData(roomTypeConcept);
    return units;
  }, [roomTypeConcept]);

  const roomTypeFurniture = useMemo(() => {
    return computeFurnitureForConcept(masterData, roomTypeConcept, roomTypeBuilding);
  }, [masterData, roomTypeConcept, roomTypeBuilding]);

  const filteredItems = useMemo(() => {
    return effectiveProcurement.filter((item) => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(item.category)) return false;

      if (selectedConcepts.length > 0) {
        const matchesConcept = selectedConcepts.some(c => {
          const id = getConceptId(c);
          if (id === 'A') return item.qtyA > 0;
          if (id === 'B') return item.qtyB > 0;
          if (id === 'C') return item.qtyC > 0;
          return false;
        });
        if (!matchesConcept) return false;
      }

      if (selectedUnitCodes.length > 0) {
        const targetBuilding = selectedBuildings.length === 1 ? selectedBuildings[0] : undefined;
        const conceptIds = selectedConcepts.length > 0
          ? selectedConcepts.map(c => getConceptId(c)).filter(Boolean) as ('A' | 'B' | 'C')[]
          : ['A', 'B', 'C'] as const;

        const matchesUnit = conceptIds.some(id => {
          const furniture = computeFurnitureForConcept(masterData, id, targetBuilding);
          const fItem = furniture.find(f => f.itemName === item.name);
          if (!fItem) return false;
          return selectedUnitCodes.some(code => (fItem.quantities[code] || 0) > 0);
        });
        if (!matchesUnit) return false;
      }

      if (selectedStatuses.length > 0) {
        const ud = getUserItemData(userData, item.id);
        const matchesStatus = selectedStatuses.some(s => {
          if (s === 'No Status') return !ud.status;
          return ud.status === s;
        });
        if (!matchesStatus) return false;
      }

      return true;
    });
  }, [search, selectedConcepts, selectedBuildings, selectedCategories, selectedStatuses, selectedUnitCodes, userData, effectiveProcurement, masterData]);

  const handleInlineChange = (id: number, field: keyof UserItemData, value: string | number | null) => {
    const current = getUserItemData(userData, id);
    onUpdateItem(id, { ...current, [field]: value });
  };

  const clearAll = () => {
    setSearch('');
    setSelectedConcepts([]);
    setSelectedBuildings([]);
    setSelectedCategories([]);
    setSelectedStatuses([]);
    setSelectedUnitCodes([]);
  };

  const hasActiveFilters = search !== '' || selectedConcepts.length > 0 || selectedBuildings.length > 0 || selectedCategories.length > 0 || selectedStatuses.length > 0 || selectedUnitCodes.length > 0;

  const selected = selectedItem !== null ? effectiveProcurement.find((i) => i.id === selectedItem) : null;

  const thClass = 'px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left whitespace-nowrap';
  const tdClass = 'px-3 py-2.5 text-sm';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <FilterBar
          search={search} onSearchChange={setSearch}
          concepts={selectedConcepts} onConceptsChange={v => { setSelectedConcepts(v); setSelectedBuildings([]); }}
          buildings={selectedBuildings} onBuildingsChange={setSelectedBuildings}
          availableBuildings={availableBuildings}
          categories={selectedCategories} onCategoriesChange={setSelectedCategories}
          statuses={selectedStatuses} onStatusesChange={setSelectedStatuses}
          unitCodes={selectedUnitCodes} onUnitCodesChange={setSelectedUnitCodes}
          availableUnitCodes={availableUnitCodes}
          viewMode={viewMode} onViewModeChange={setViewMode}
          onClearAll={clearAll}
          hasActiveFilters={hasActiveFilters}
        />
        <ExportButton userData={userData} concepts={selectedConcepts} buildings={selectedBuildings} categories={selectedCategories} statuses={selectedStatuses} procurementItems={effectiveProcurement} />
      </div>

      {viewMode === 'byRoomType' && selectedConcepts.length !== 1 && selectedBuildings.length !== 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Show unit columns for:</span>
          {(['A', 'B', 'C'] as const).map(id => (
            <button
              key={id}
              onClick={() => setRoomTypeConceptOverride(id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                roomTypeConcept === id
                  ? `bg-${id === 'A' ? 'happiness' : id === 'B' ? 'wellness' : 'boutique'} text-primary-foreground`
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {id === 'A' ? 'HAPPINESS (A)' : id === 'B' ? 'WELLNESS (B)' : 'BOUTIQUE (C)'}
            </button>
          ))}
        </div>
      )}

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-striped">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className={thClass}>#</th>
                <th className={thClass}>Item Name</th>
                <th className={thClass}>Category</th>

                {viewMode === 'byItem' ? (
                  <>
                    <th className={`${thClass} text-center`}>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-happiness" />A
                      </span>
                    </th>
                    <th className={`${thClass} text-center`}>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-wellness" />B
                      </span>
                    </th>
                    <th className={`${thClass} text-center`}>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-boutique" />C
                      </span>
                    </th>
                    <th className={`${thClass} text-center`}>Total</th>
                  </>
                ) : (
                  <>
                    {roomTypeUnits.map(u => (
                      <th key={u.code} className={`${thClass} text-center`}>
                        <div className="text-[9px]">{u.code}</div>
                        <div className="text-[8px] text-muted-foreground/60">{u.description.slice(0, 4)}</div>
                      </th>
                    ))}
                    <th className={`${thClass} text-center`}>Bldg Total</th>
                  </>
                )}

                <th className={thClass}>Supplier</th>
                <th className={thClass}>Price (€)</th>
                <th className={thClass}>Cost (€)</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => {
                const ud = getUserItemData(userData, item.id);
                const sel = allSelections[item.name];
                const effectiveSupplier = ud.supplier || sel?.supplier || '';
                const effectivePrice = ud.unitPrice ?? sel?.unitPrice ?? null;
                const totalCost = effectivePrice ? item.grandTotal * effectivePrice : null;

                const roomTypeFItem = viewMode === 'byRoomType'
                  ? roomTypeFurniture.find(f => f.itemName === item.name)
                  : null;

                const buildingTotal = roomTypeFItem
                  ? roomTypeUnits.reduce((sum, u) => {
                      const perUnit = roomTypeFItem.quantities[u.code] || 0;
                      let instances = 0;
                      u.floors.forEach(f => { instances += u.unitsPerFloor[f] || 0; });
                      return sum + perUnit * instances;
                    }, 0)
                  : 0;

                return (
                  <tr
                    key={item.id}
                    className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedItem(item.id)}
                  >
                    <td className={`${tdClass} text-muted-foreground text-xs`}>{idx + 1}</td>
                    <td className={`${tdClass} font-medium text-foreground whitespace-nowrap`}>{item.name}</td>
                    <td className={`${tdClass} text-muted-foreground whitespace-nowrap`}>
                      <span className="mr-1">{categoryEmojis[item.category]}</span>
                      {item.category}
                    </td>

                    {viewMode === 'byItem' ? (
                      <>
                        <td className={`${tdClass} text-center font-mono text-sm`}>{item.qtyA || '—'}</td>
                        <td className={`${tdClass} text-center font-mono text-sm`}>{item.qtyB || '—'}</td>
                        <td className={`${tdClass} text-center font-mono text-sm`}>{item.qtyC || '—'}</td>
                        <td className={`${tdClass} text-center font-mono text-sm font-bold text-accent`}>
                          {item.grandTotal.toLocaleString()}
                        </td>
                      </>
                    ) : (
                      <>
                        {roomTypeUnits.map(u => {
                          const qty = roomTypeFItem?.quantities[u.code] || 0;
                          return (
                            <td key={u.code} className={`${tdClass} text-center font-mono text-xs`}>
                              {qty || '—'}
                            </td>
                          );
                        })}
                        <td className={`${tdClass} text-center font-mono text-sm font-bold text-accent`}>
                          {buildingTotal || '—'}
                        </td>
                      </>
                    )}

                    <td className={`${tdClass} text-muted-foreground text-xs whitespace-nowrap`}>
                      {effectiveSupplier || '—'}
                    </td>
                    <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>
                      {effectivePrice ? `€${effectivePrice.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>
                      {totalCost ? `€${totalCost.toLocaleString()}` : '—'}
                    </td>
                    <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                      <select
                        className="h-7 rounded border bg-background px-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                        value={ud.status}
                        onChange={(e) => handleInlineChange(item.id, 'status', e.target.value)}
                      >
                        <option value="">—</option>
                        <option value="Pending">Pending</option>
                        <option value="Ordered">Ordered</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Issue">Issue</option>
                      </select>
                    </td>
                    <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                      <input
                        className="h-7 w-28 rounded border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                        value={ud.notes}
                        onChange={(e) => handleInlineChange(item.id, 'notes', e.target.value)}
                        placeholder="—"
                      />
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={viewMode === 'byItem' ? 12 : roomTypeUnits.length + 9} className="px-3 py-12 text-center text-muted-foreground">
                    No items match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Showing {filteredItems.length} of {effectiveProcurement.length} items</span>
        <span>
          Grand Total: <strong className="text-accent">{filteredItems.reduce((s, i) => s + i.grandTotal, 0).toLocaleString()}</strong> items
        </span>
      </div>

      {selected && (
        <ItemDetailPanel
          item={selected}
          userData={getUserItemData(userData, selected.id)}
          onSave={onUpdateItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
