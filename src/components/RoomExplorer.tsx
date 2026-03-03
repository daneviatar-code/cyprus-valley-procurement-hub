import { useState, useMemo } from 'react';
import { Building, Layers, Home, Sofa, ImageOff } from 'lucide-react';
import {
  getBuildingData,
  getFloors,
  floorPlans,
  getUnitFloorPlanUrl,
} from '@/data/unitFurnitureData';
import { categoryEmojis } from '@/data/projectData';
import { concepts } from '@/data/projectData';
import {
  MasterRow,
  computeFurnitureForUnit,
  getRoomNumbersForUnit,
  generateRoomNumbers,
  ALL_BUILDINGS,
  ALL_BUILDING_LIST,
  conceptForBuilding,
  Concept,
} from '@/data/masterData';
import ZoomableImage from './ZoomableImage';

interface RoomExplorerProps {
  masterData: MasterRow[];
}

const floorLabel = (f: number) => (f === 0 ? 'Ground Floor' : `Floor ${f}`);

export default function RoomExplorer({ masterData }: RoomExplorerProps) {
  const [selectedBuilding, setSelectedBuilding] = useState('A1');
  const [selectedFloor, setSelectedFloor] = useState<number | ''>('');
  const [selectedRoomType, setSelectedRoomType] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');

  const concept = conceptForBuilding(selectedBuilding) as 'A' | 'B' | 'C';
  const floors = useMemo(() => getFloors(concept), [concept]);

  const roomTypes = useMemo(() => {
    const types = new Set(masterData.filter(r => r.building === selectedBuilding).map(r => r.roomType));
    return [...types].sort();
  }, [selectedBuilding, masterData]);

  const unitCodes = useMemo(() => {
    const { units } = getBuildingData(concept);
    return units
      .filter(u => (selectedFloor === '' || u.floors.includes(selectedFloor as number)))
      .filter(u => (!selectedRoomType || u.description === selectedRoomType))
      .map(u => u.code);
  }, [concept, selectedFloor, selectedRoomType]);

  const furniture = useMemo(() => {
    if (!selectedUnit) return [];
    return computeFurnitureForUnit(masterData, concept, selectedUnit, selectedBuilding);
  }, [concept, selectedBuilding, selectedUnit, masterData]);

  const totalItems = furniture.reduce((s, f) => s + f.qty, 0);

  const unitDescription = useMemo(() => {
    if (!selectedUnit) return '';
    const { units } = getBuildingData(concept);
    const unit = units.find(u => u.code === selectedUnit);
    return unit?.description || '';
  }, [concept, selectedUnit]);

  const roomNumbers = useMemo(() => {
    if (!selectedUnit) return [];
    return getRoomNumbersForUnit(concept, selectedUnit);
  }, [concept, selectedUnit]);

  const unitPlanUrl = useMemo(() => {
    if (!selectedUnit) return null;
    return getUnitFloorPlanUrl(concept, selectedUnit);
  }, [concept, selectedUnit]);

  const handleBuildingChange = (b: string) => {
    setSelectedBuilding(b);
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

  const conceptInfo = concepts.find(c => c.id === concept)!;

  const selectClass =
    'h-10 rounded-lg border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer';

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
      <div>
        <h2 className="text-lg font-semibold text-foreground">Room Explorer</h2>
        <p className="text-sm text-muted-foreground">Select a building, floor, and unit to view its furniture list and floor plan</p>
      </div>

      {/* Building selector — grouped by concept */}
      <div className="space-y-2">
        {(['A', 'B', 'C'] as const).map(c => {
          const ci = concepts.find(x => x.id === c)!;
          return (
            <div key={c} className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-20">{ci.name}</span>
              <div className="flex gap-1.5">
                {ALL_BUILDINGS[c].map(b => {
                  const isActive = selectedBuilding === b;
                  return (
                    <button
                      key={b}
                      onClick={() => handleBuildingChange(b)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? `bg-${ci.colorClass} text-primary-foreground shadow-md`
                          : 'bg-card border text-muted-foreground hover:text-foreground hover:border-accent'
                      }`}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card rounded-xl border p-4">
        <div className="flex flex-wrap items-end gap-4">
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

          {selectedUnit && unitDescription && (
            <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-lg border border-accent/20">
              <Home className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-foreground">
                Unit {selectedUnit} — <span className="text-accent">{unitDescription}</span>
              </span>
            </div>
          )}
        </div>

        {/* Room numbers for selected unit */}
        {selectedUnit && roomNumbers.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <span className="text-xs font-medium text-muted-foreground mr-2">Room Numbers ({selectedBuilding}):</span>
            <div className="inline-flex flex-wrap gap-1 mt-1">
              {roomNumbers.map(rn => (
                <span key={rn} className="px-2 py-0.5 bg-accent/10 text-accent text-xs font-mono rounded">
                  {rn}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Split-screen: Unit Floor Plan (left) + Furniture List (right) */}
      {selectedUnit && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unit Floor Plan */}
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Layers className="h-4 w-4 text-accent" />
                Floor Plan — Unit {selectedUnit}
                <span className="text-xs text-muted-foreground font-normal ml-1">({unitDescription})</span>
              </h3>
            </div>
            <div className="p-2">
              {unitPlanUrl ? (
                <ZoomableImage
                  src={unitPlanUrl}
                  alt={`Floor Plan - Unit ${selectedUnit} (${unitDescription})`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground rounded-lg bg-muted/10 border border-dashed">
                  <ImageOff className="h-10 w-10 mb-3 opacity-40" />
                  <span className="text-sm font-medium">{selectedUnit}</span>
                  <span className="text-xs mt-1">No floor plan image available</span>
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
              <span className="text-xs text-muted-foreground">
                {furniture.length} items · {totalItems} pcs total
              </span>
            </div>
            <div className="p-4">
              {furniture.length === 0 ? (
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
      )}

      {/* Prompt to select unit when none selected */}
      {!selectedUnit && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Layers className="h-4 w-4 text-accent" />
                Unit Floor Plan
              </h3>
            </div>
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              Select a unit code to view its floor plan
            </div>
          </div>
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sofa className="h-4 w-4 text-accent" />
                Furniture List
              </h3>
            </div>
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              Select a unit code to view its furniture list
            </div>
          </div>
        </div>
      )}

      {/* Units on selected floor */}
      {selectedFloor !== '' && (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold text-foreground">
              Units on {floorLabel(selectedFloor)} — {selectedBuilding} ({conceptInfo.name})
            </h3>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {(() => {
                const { units } = getBuildingData(concept);
                const floorUnits = units.filter(u => u.floors.includes(selectedFloor as number));
                const floorRoomNumbers = generateRoomNumbers(concept).filter(r => r.floor === selectedFloor);

                return floorUnits.map(u => {
                  const isSelected = selectedUnit === u.code;
                  const unitRooms = floorRoomNumbers.filter(r => r.unitCode === u.code);
                  const hasImage = !!getUnitFloorPlanUrl(concept, u.code);
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
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold">{u.code}</span>
                        {hasImage && <span className="text-[8px] text-accent">📐</span>}
                      </div>
                      <div className="text-[10px] opacity-70">{u.description}</div>
                      {unitRooms.length > 0 && (
                        <div className="text-[9px] text-muted-foreground mt-0.5">
                          {unitRooms.map(r => r.roomNumber).join(', ')}
                        </div>
                      )}
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
