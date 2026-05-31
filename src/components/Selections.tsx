import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Clock, ExternalLink, Image, Pencil, Search, ShoppingCart, Trash2, Upload } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Concept, ALL_BUILDINGS, getUnitInstancesInBuilding } from '@/data/masterData';
import { loadPackage, PackageItem } from '@/data/packageData';
import { Selection, SelectionMap, loadSelections, saveSelections } from '@/data/selectionData';
import { buildingAUnits, buildingBUnits, buildingCUnits, UnitType } from '@/data/unitFurnitureData';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { loadSuppliers, subscribeSuppliers, Supplier } from '@/data/supplierData';



function getUnitsForConcept(concept: Concept): UnitType[] {
  switch (concept) {
    case 'A': return buildingAUnits;
    case 'B': return buildingBUnits;
    case 'C': return buildingCUnits;
  }
}

interface RoomTypeCard {
  concept: Concept;
  unitCode: string;
  items: PackageItem[];
  selections: SelectionMap;
  selectedCount: number;
  totalCount: number;
  isComplete: boolean;
}

export default function Selections() {
  const [activeBlock, setActiveBlock] = useState<Concept>('A');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  // Selection dialog
  const [editTarget, setEditTarget] = useState<{ concept: Concept; unitCode: string; itemName: string } | null>(null);
  const [selForm, setSelForm] = useState<Selection>({ productName: '', supplier: '', unitPrice: 0, notes: '', imageUrl: '', productUrl: '' });
  const [applyToRoomTypes, setApplyToRoomTypes] = useState<string[]>([]); // "concept-unitCode" keys

  // Force re-render after saves
  const [version, setVersion] = useState(0);

  // Suppliers from the suppliers module
  const [suppliers, setSuppliers] = useState<Supplier[]>(loadSuppliers);
  useEffect(() => subscribeSuppliers(setSuppliers), []);


  // Build all room type cards FOR THE ACTIVE BLOCK ONLY.
  // Selections in localStorage are already keyed by concept+unitCode, so each block is independent.
  const allCards: RoomTypeCard[] = useMemo(() => {
    const cards: RoomTypeCard[] = [];
    const concept = activeBlock;
    const units = getUnitsForConcept(concept);
    units.forEach(unit => {
      const pkg = loadPackage(concept, unit.code);
      if (pkg.items.length === 0) return;
      const sels = loadSelections(concept, unit.code);
      const selectedCount = pkg.items.filter(i => sels[i.itemName]).length;
      cards.push({
        concept,
        unitCode: unit.code,
        items: pkg.items,
        selections: sels,
        selectedCount,
        totalCount: pkg.items.length,
        isComplete: selectedCount === pkg.items.length,
      });
    });

    return cards;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, activeBlock]);

  const filteredCards = useMemo(() => {
    return allCards.filter(card => {
      if (filterUnit !== 'all' && card.unitCode !== filterUnit) return false;
      if (filterStatus === 'complete' && !card.isComplete) return false;
      if (filterStatus === 'pending' && card.isComplete) return false;
      if (searchText) {
        const term = searchText.toLowerCase();
        const hasMatch = card.items.some(i => i.itemName.toLowerCase().includes(term));
        if (!hasMatch && !card.unitCode.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [allCards, filterUnit, filterStatus, searchText]);

  // All unique unit codes for filter
  const allUnitCodes = useMemo(() => {
    const set = new Set<string>();
    allCards.forEach(c => set.add(c.unitCode));
    return Array.from(set).sort();
  }, [allCards]);

  const openSelection = useCallback((concept: Concept, unitCode: string, itemName: string, existing?: Selection) => {
    setEditTarget({ concept, unitCode, itemName });
    setSelForm(existing || { productName: '', supplier: '', unitPrice: 0, notes: '', imageUrl: '', productUrl: '' });
    // Scan localStorage directly for ALL unit types that already have this item
    const preChecked: string[] = [];
    const concepts: Concept[] = ['A', 'B', 'C'];
    concepts.forEach(c => {
      const units = getUnitsForConcept(c);
      units.forEach(u => {
        const sels = loadSelections(c, u.code);
        if (sels[itemName]) {
          preChecked.push(`${c}-${u.code}`);
        }
      });
    });
    // Always include the current one
    if (!preChecked.includes(`${concept}-${unitCode}`)) {
      preChecked.push(`${concept}-${unitCode}`);
    }
    setApplyToRoomTypes(preChecked);
  }, []);

  // All room types that have this same item name (for multi-apply)
  const roomTypesWithItem = useMemo(() => {
    if (!editTarget) return [];
    return allCards
      .filter(card => card.items.some(i => i.itemName === editTarget.itemName))
      .map(card => ({ key: `${card.concept}-${card.unitCode}`, label: `${card.concept} — ${card.unitCode}` }));
  }, [editTarget, allCards]);

  function handleSaveSelection() {
    if (!editTarget) return;
    const selData = { ...selForm };
    // Apply selection to checked room types, remove from unchecked ones
    roomTypesWithItem.forEach(rt => {
      const [concept, unitCode] = rt.key.split('-') as [Concept, string];
      const sels = loadSelections(concept, unitCode);
      if (applyToRoomTypes.includes(rt.key)) {
        sels[editTarget.itemName] = { ...selData };
      } else {
        delete sels[editTarget.itemName];
      }
      saveSelections(concept, unitCode, sels);
    });
    setEditTarget(null);
    setVersion(v => v + 1);
  }

  const [deleteTarget, setDeleteTarget] = useState<{ concept: Concept; unitCode: string; itemName: string } | null>(null);

  function confirmClearSelection() {
    if (!deleteTarget) return;
    const sels = loadSelections(deleteTarget.concept, deleteTarget.unitCode);
    delete sels[deleteTarget.itemName];
    saveSelections(deleteTarget.concept, deleteTarget.unitCode, sels);
    setVersion(v => v + 1);
    setDeleteTarget(null);
  }

  // ── Order Quantity Summary ──
  // For each unique selected product, calculate total order qty across all buildings
  const orderSummary = useMemo(() => {
    const productMap = new Map<string, {
      productName: string;
      supplier: string;
      unitPrice: number;
      imageUrl?: string;
      productUrl?: string;
      // entries: concept + unitCode + qtyPerUnit + unitCount (across buildings)
      entries: { concept: Concept; unitCode: string; qtyPerUnit: number }[];
    }>();

    allCards.forEach(card => {
      card.items.forEach(item => {
        const sel = card.selections[item.itemName];
        if (!sel) return;
        const key = sel.productName.trim().toLowerCase();
        if (!key) return;
        if (!productMap.has(key)) {
          productMap.set(key, {
            productName: sel.productName,
            supplier: sel.supplier,
            unitPrice: sel.unitPrice,
            imageUrl: sel.imageUrl,
            productUrl: sel.productUrl,
            entries: [],
          });
        }
        productMap.get(key)!.entries.push({
          concept: card.concept,
          unitCode: card.unitCode,
          qtyPerUnit: item.quantity,
        });
      });
    });

    // Calculate totals: for each entry, multiply qtyPerUnit by the number of
    // actual units of that type across all buildings of that concept
    return Array.from(productMap.values()).map(p => {
      let totalQty = 0;
      p.entries.forEach(e => {
        const units = getUnitsForConcept(e.concept);
        const unitType = units.find(u => u.code === e.unitCode);
        if (!unitType) return;
        // Count actual instances of this unit type across all buildings of the concept.
        // B is already split between B1+B2, so mirrored codes are not doubled.
        totalQty += ALL_BUILDINGS[e.concept].reduce(
          (sum, building) => sum + e.qtyPerUnit * getUnitInstancesInBuilding(e.concept, e.unitCode, building),
          0
        );
      });
      return {
        productName: p.productName,
        supplier: p.supplier,
        unitPrice: p.unitPrice,
        totalQty,
        totalValue: totalQty * p.unitPrice,
        imageUrl: p.imageUrl,
        productUrl: p.productUrl,
        roomTypes: p.entries.map(e => `${e.concept}-${e.unitCode}`),
      };
    }).sort((a, b) => b.totalQty - a.totalQty);
  }, [allCards]);

  const [showOrderSummary, setShowOrderSummary] = useState(true);

  // Summary stats
  const totalItems = allCards.reduce((s, c) => s + c.totalCount, 0);
  const totalSelected = allCards.reduce((s, c) => s + c.selectedCount, 0);
  const completeCards = allCards.filter(c => c.isComplete).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Selections</h2>
        <p className="text-xs text-muted-foreground">Track product selections for every room type — see what's chosen and what's missing</p>
      </div>

      {/* Block sub-tabs — each block's selections are independent */}
      <Tabs value={activeBlock} onValueChange={(v) => setActiveBlock(v as Concept)}>
        <TabsList>
          <TabsTrigger value="A">Block A (HAPPINESS)</TabsTrigger>
          <TabsTrigger value="B">Block B (WELLNESS)</TabsTrigger>
          <TabsTrigger value="C">Block C (BOUTIQUE)</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Overall Progress</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{totalSelected}</span>
              <span className="text-sm text-muted-foreground">/ {totalItems} items selected</span>
            </div>
            <Progress value={totalItems > 0 ? (totalSelected / totalItems) * 100 : 0} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Room Types Complete</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{completeCards}</span>
              <span className="text-sm text-muted-foreground">/ {allCards.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Pending</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-status-pending">{allCards.length - completeCards}</span>
              <span className="text-sm text-muted-foreground">room types need selections</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search items or unit codes..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {/* Concept dropdown removed — block selection is now handled via the top-level Block tabs */}
        <Select value={filterUnit} onValueChange={setFilterUnit}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Units</SelectItem>
            {allUnitCodes.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        {(searchText || filterUnit !== 'all' || filterStatus !== 'all') && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setSearchText(''); setFilterUnit('all'); setFilterStatus('all'); }}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Room Type Cards */}
      <div className="space-y-4">
        {filteredCards.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No room types match your filters.</p>
        )}
        {filteredCards.map(card => {
          const pct = card.totalCount > 0 ? Math.round((card.selectedCount / card.totalCount) * 100) : 0;
          return (
            <Card key={`${card.concept}-${card.unitCode}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">
                      Concept {card.concept} — {card.unitCode}
                    </CardTitle>
                    {card.isComplete ? (
                      <Badge className="bg-status-delivered/15 text-status-delivered border-0 text-[10px]">
                        <Check className="w-3 h-3 mr-1" /> COMPLETE
                      </Badge>
                    ) : (
                      <Badge className="bg-status-pending/15 text-status-pending border-0 text-[10px]">
                        <Clock className="w-3 h-3 mr-1" /> PENDING
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground font-medium">
                    {card.selectedCount}/{card.totalCount} items
                  </span>
                </div>
                <Progress value={pct} className="h-2 mt-2" />
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-8">Status</TableHead>
                      <TableHead></TableHead>
                      <TableHead>Required Item</TableHead>
                      <TableHead className="w-[100px] text-right">Qty</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Selected Product</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Price €</TableHead>
                      <TableHead className="w-[90px] text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {card.items.map(item => {
                      const sel = card.selections[item.itemName];
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            {sel ? (
                              <div className="w-5 h-5 rounded-full bg-status-delivered/20 flex items-center justify-center">
                                <Check className="w-3 h-3 text-status-delivered" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-status-pending" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-1.5">
                              {item.itemName}
                              {sel?.productUrl && (
                                <a href={sel.productUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{item.quantity}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.category}</TableCell>
                          <TableCell className="text-sm">
                            {sel ? (
                              <div className="flex items-center gap-2">
                                {sel.imageUrl && (
                                  <a href={sel.imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                    <img src={sel.imageUrl} alt={sel.productName} className="w-10 h-10 rounded object-cover border border-border hover:opacity-80 transition-opacity" />
                                  </a>
                                )}
                                <span>{sel.productName}</span>
                              </div>
                            ) : <span className="text-muted-foreground italic">—</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {sel?.supplier || '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {sel?.unitPrice ? `€${sel.unitPrice.toLocaleString()}` : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openSelection(card.concept, card.unitCode, item.itemName, sel || undefined)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              {sel && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteTarget({ concept: card.concept, unitCode: card.unitCode, itemName: item.itemName })}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Order Quantity Summary */}
      {orderSummary.length > 0 && (
        <Card>
          <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowOrderSummary(v => !v)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">Order Quantity Summary</CardTitle>
                <Badge variant="secondary" className="text-[10px]">{orderSummary.length} products</Badge>
              </div>
              <span className="text-xs text-muted-foreground">{showOrderSummary ? 'Click to collapse' : 'Click to expand'}</span>
            </div>
          </CardHeader>
          {showOrderSummary && (
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead></TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Unit Price €</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead className="text-right">Total Value €</TableHead>
                    <TableHead>Room Types</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderSummary.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="w-10">
                        {row.imageUrl ? (
                          <img src={row.imageUrl} alt="" className="w-8 h-8 rounded object-cover border border-border" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <Image className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-1.5">
                          {row.productName}
                          {row.productUrl && (
                            <a href={row.productUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.supplier || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.unitPrice ? `€${row.unitPrice.toLocaleString()}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold">{row.totalQty.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                        €{row.totalValue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.roomTypes.join(', ')}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell colSpan={4} className="text-right text-sm">Totals</TableCell>
                    <TableCell className="text-right font-mono text-sm">{orderSummary.reduce((s, r) => s + r.totalQty, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-primary">
                      €{orderSummary.reduce((s, r) => s + r.totalValue, 0).toLocaleString()}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}

      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Select Product for: {editTarget?.itemName}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Concept {editTarget?.concept} — {editTarget?.unitCode}
            </p>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Product Name</label>
              <Input
                value={selForm.productName}
                onChange={e => setSelForm(p => ({ ...p, productName: e.target.value }))}
                placeholder="e.g. Muuto Outline Sofa 3-Seater"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Supplier</label>
                <Input
                  list="selections-suppliers-list"
                  value={selForm.supplier}
                  onChange={e => setSelForm(p => ({ ...p, supplier: e.target.value }))}
                  placeholder="Select or type supplier"
                />
                <datalist id="selections-suppliers-list">
                  {suppliers.map(s => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Unit Price €</label>
                <Input
                  type="number"
                  value={selForm.unitPrice || ''}
                  onChange={e => setSelForm(p => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
              <Input
                value={selForm.notes}
                onChange={e => setSelForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Image (optional)</label>
                <div className="flex gap-2">
                  <Input
                    value={selForm.imageUrl?.startsWith('data:') ? '' : (selForm.imageUrl || '')}
                    onChange={e => setSelForm(p => ({ ...p, imageUrl: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1"
                  />
                  <div className="shrink-0">
                    <input
                      id="sel-image-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setSelForm(p => ({ ...p, imageUrl: reader.result as string }));
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 text-xs"
                      onClick={() => document.getElementById('sel-image-upload')?.click()}
                    >
                      📁 Upload from computer
                    </Button>
                  </div>
                </div>
                {selForm.imageUrl && (
                  <img src={selForm.imageUrl} alt="Preview" className="mt-1.5 w-16 h-16 rounded object-cover border border-border" />
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Product URL (optional)</label>
                <Input
                  value={selForm.productUrl || ''}
                  onChange={e => setSelForm(p => ({ ...p, productUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Multi-apply to room types */}
            {roomTypesWithItem.length > 1 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-xs font-medium text-foreground block">
                      Room types
                    </label>
                    <span className="text-[10px] text-muted-foreground">Check to add · Uncheck to remove</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="link" size="sm" className="h-auto p-0 text-[10px]" onClick={() => setApplyToRoomTypes(roomTypesWithItem.map(r => r.key))}>
                      Select all
                    </Button>
                    <Button variant="link" size="sm" className="h-auto p-0 text-[10px]" onClick={() => {
                      const currentKey = `${editTarget?.concept}-${editTarget?.unitCode}`;
                      setApplyToRoomTypes([currentKey]);
                    }}>
                      Deselect all
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[140px] rounded-md border p-3">
                  <div className="space-y-2">
                    {roomTypesWithItem.map(rt => {
                      const currentKey = `${editTarget?.concept}-${editTarget?.unitCode}`;
                      const isCurrent = rt.key === currentKey;
                      const hasExisting = allCards.some(c => `${c.concept}-${c.unitCode}` === rt.key && c.selections[editTarget?.itemName || '']);
                      return (
                        <label key={rt.key} className={`flex items-center gap-2 text-sm ${isCurrent ? 'cursor-default' : 'cursor-pointer'}`}>
                          <Checkbox
                            checked={applyToRoomTypes.includes(rt.key)}
                            disabled={isCurrent}
                            onCheckedChange={(checked) => {
                              if (isCurrent) return;
                              setApplyToRoomTypes(prev =>
                                checked
                                  ? [...prev, rt.key]
                                  : prev.filter(k => k !== rt.key)
                              );
                            }}
                          />
                          <span className={isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                            {rt.label}
                            {isCurrent && (
                              <span className="text-[10px] ml-1 text-primary">(current)</span>
                            )}
                            {!isCurrent && hasExisting && !applyToRoomTypes.includes(rt.key) && (
                              <span className="text-[10px] ml-1 text-destructive">(will remove)</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button onClick={handleSaveSelection} disabled={!selForm.productName.trim()}>
                Save Selection{applyToRoomTypes.length > 1 ? ` (${applyToRoomTypes.length} types)` : applyToRoomTypes.length === 0 ? ' (remove all)' : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear selection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the selected product for "{deleteTarget?.itemName}" and set it back to PENDING.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearSelection} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
