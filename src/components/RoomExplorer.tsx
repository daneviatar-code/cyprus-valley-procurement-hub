import { useState, useMemo } from 'react';
import { Building, Layers, ChevronDown, Home, BedDouble, Sofa, TreePine, UtensilsCrossed } from 'lucide-react';
import {
  getBuildingData,
  getRoomTypes,
  getFloors,
  getUnitCodes,
  getFurnitureForUnit,
  floorPlans,
} from '@/data/unitFurnitureData';
import { categoryEmojis } from '@/data/projectData';
import { concepts } from '@/data/projectData';

const categoryIcons: Record<string, typeof Sofa> = {
  Dining: UtensilsCrossed,
  'Living Room': Sofa,
  Bedroom: BedDouble,
  Outdoor: TreePine,
};

const floorLabel = (f: number) => (f === 0 ? 'Ground Floor' : `Floor ${f}`);

export default function RoomExplorer() {
  const [building, setBuilding] = useState<'A' | 'B' | 'C'>('A');
  const [selectedFloor, setSelectedFloor] = useState<number | ''>('');
  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');

  const floors = useMemo(() => getFloors(building), [building]);
  const roomTypes = useMemo(() => getRoomTypes(building), [building]);
  const unitCodes = useMemo(
    () => getUnitCodes(building, selectedFloor === '' ? undefined : selectedFloor, selectedRoomType || undefined),
    [building, selectedFloor, selectedRoomType]
  );

  const furniture = useMemo(() => {
    if (!selectedUnit) return [];
    return getFurnitureForUnit(building, selectedUnit);
  }, [building, selectedUnit]);

  const totalItems = furniture.reduce((s, f) => s + f.qty, 0);

  // Get unit description
  const unitDescription = useMemo(() => {
    if (!selectedUnit) return '';
    const { units } = getBuildingData(building);
    const unit = units.find(u => u.code === selectedUnit);
    return unit?.description || '';
  }, [building, selectedUnit]);

  // Floor plan
  const planUrl = useMemo(() => {
    if (selectedFloor === '') return null;
    return floorPlans[building]?.[selectedFloor] || null;
  }, [building, selectedFloor]);

  // Reset dependent filters on building change
  const handleBuildingChange = (b: 'A' | 'B' | 'C') => {
    setBuilding(b);
    setSelectedFloor('');
    setSelectedRoomType('');
    setSelectedUnit('');
  };

  const handleFloorChange = (f: number | '') => {
    setSelectedFloor(f);
    setSelectedUnit('');
  };

  const handleRoomTypeChange = (rt: string) => {
    setSelectedRoomType(rt);
    setSelectedUnit('');
  };

  const conceptInfo = concepts.find(c => c.id === building)!;

  const selectClass =
    'h-10 rounded-lg border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer';

  // Group furniture by category
  const groupedFurniture = useMemo(() => {
    const groups: Record<string, typeof furniture> = {};
    furniture.forEach(f => {
      if (!groups[f.category]) groups[f.category] = [];
      groups[f.category].push(f);
    });
    return groups;
  }, [furniture]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Room Explorer</h2>
        <p className="text-sm text-muted-foreground">Select a building, floor, room type, and unit to view its furniture list</p>
      </div>

      {/* Building selector tabs */}
      <div className="flex gap-2">
        {(['A', 'B', 'C'] as const).map(b => {
          const concept = concepts.find(c => c.id === b)!;
          const isActive = building === b;
          return (
            <button
              key={b}
              onClick={() => handleBuildingChange(b)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? `bg-${concept.colorClass} text-primary-foreground shadow-md`
                  : 'bg-card border text-muted-foreground hover:text-foreground hover:border-accent'
              }`}
            >
              <Building className="h-4 w-4" />
              <span>{concept.name} ({b})</span>
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Floor filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Floor</label>
            <select
              value={selectedFloor}
              onChange={e => handleFloorChange(e.target.value === '' ? '' : Number(e.target.value))}
              className={selectClass}
            >
              <option value="">All Floors</option>
              {floors.map(f => (
                <option key={f} value={f}>{floorLabel(f)}</option>
              ))}
            </select>
          </div>

          {/* Room type filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Room Type</label>
            <select
              value={selectedRoomType}
              onChange={e => handleRoomTypeChange(e.target.value)}
              className={selectClass}
            >
              <option value="">All Types</option>
              {roomTypes.map(rt => (
                <option key={rt} value={rt}>{rt}</option>
              ))}
            </select>
          </div>

          {/* Unit code filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Unit Code</label>
            <select
              value={selectedUnit}
              onChange={e => setSelectedUnit(e.target.value)}
              className={selectClass}
            >
              <option value="">Select unit...</option>
              {unitCodes.map(uc => (
                <option key={uc} value={uc}>{uc}</option>
              ))}
            </select>
          </div>

          {/* Unit info badge */}
          {selectedUnit && unitDescription && (
            <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-lg border border-accent/20">
              <Home className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-foreground">
                Unit {selectedUnit} — <span className="text-accent">{unitDescription}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content area: Floor Plan + Furniture List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Floor Plan */}
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" />
              Floor Plan — Building {building}
              {selectedFloor !== '' && ` · ${floorLabel(selectedFloor)}`}
            </h3>
          </div>
          <div className="p-4">
            {planUrl ? (
              planUrl.endsWith('.pdf') ? (
                <div className="space-y-3">
                  <iframe
                    src={planUrl}
                    className="w-full h-[500px] rounded-lg border"
                    title={`Floor Plan - Building ${building} ${floorLabel(selectedFloor as number)}`}
                  />
                  <a
                    href={planUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    Open in new tab ↗
                  </a>
                </div>
              ) : (
                <img
                  src={planUrl}
                  alt={`Floor Plan - Building ${building}`}
                  className="w-full rounded-lg"
                />
              )
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                {selectedFloor === ''
                  ? 'Select a floor to view the plan'
                  : 'No floor plan available for this floor'}
              </div>
            )}
          </div>
        </div>

        {/* Furniture List */}
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sofa className="h-4 w-4 text-accent" />
              Furniture List
            </h3>
            {selectedUnit && (
              <span className="text-xs text-muted-foreground">
                {furniture.length} items · {totalItems} pcs total
              </span>
            )}
          </div>
          <div className="p-4">
            {!selectedUnit ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                Select a unit code to view its furniture list
              </div>
            ) : furniture.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No furniture assigned to this unit
              </div>
            ) : (
              <div className="space-y-5 max-h-[500px] overflow-y-auto pr-1">
                {Object.entries(groupedFurniture).map(([cat, items]) => {
                  const emoji = categoryEmojis[cat as keyof typeof categoryEmojis] || '📦';
                  return (
                    <div key={cat}>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <span>{emoji}</span> {cat}
                      </h4>
                      <div className="space-y-1">
                        {items.map(item => (
                          <div
                            key={item.itemName}
                            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <span className="text-sm text-foreground">{item.itemName}</span>
                            <span className="text-sm font-semibold text-accent min-w-[40px] text-right">
                              ×{item.qty}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Units grid for selected floor */}
      {selectedFloor !== '' && (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground">
              Units on {floorLabel(selectedFloor)} — Building {building} ({conceptInfo.name})
            </h3>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {(() => {
                const { units } = getBuildingData(building);
                const floorUnits = units.filter(u => u.floors.includes(selectedFloor as number));
                return floorUnits.map(u => {
                  const isSelected = selectedUnit === u.code;
                  return (
                    <button
                      key={u.code}
                      onClick={() => setSelectedUnit(u.code)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        isSelected
                          ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                          : 'bg-muted/30 text-foreground border-transparent hover:border-accent/30'
                      }`}
                    >
                      <div className="text-xs font-bold">{u.code}</div>
                      <div className="text-[10px] opacity-70">{u.description}</div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
