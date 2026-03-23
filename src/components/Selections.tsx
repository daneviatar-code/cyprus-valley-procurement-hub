import { useState, useMemo, useCallback } from 'react';
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
import { Check, Clock, Pencil, Search } from 'lucide-react';
import { Concept, ALL_BUILDINGS } from '@/data/masterData';
import { loadPackage, PackageItem } from '@/data/packageData';
import { Selection, SelectionMap, loadSelections, saveSelections } from '@/data/selectionData';
import { buildingAUnits, buildingBUnits, buildingCUnits, UnitType } from '@/data/unitFurnitureData';

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
  const [filterConcept, setFilterConcept] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  // Selection dialog
  const [editTarget, setEditTarget] = useState<{ concept: Concept; unitCode: string; itemName: string } | null>(null);
  const [selForm, setSelForm] = useState<Selection>({ productName: '', supplier: '', unitPrice: 0, notes: '' });

  // Force re-render after saves
  const [version, setVersion] = useState(0);

  // Build all room type cards
  const allCards: RoomTypeCard[] = useMemo(() => {
    const cards: RoomTypeCard[] = [];
    const concepts: Concept[] = ['A', 'B', 'C'];

    concepts.forEach(concept => {
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
    });

    return cards;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  const filteredCards = useMemo(() => {
    return allCards.filter(card => {
      if (filterConcept !== 'all' && card.concept !== filterConcept) return false;
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
  }, [allCards, filterConcept, filterUnit, filterStatus, searchText]);

  // All unique unit codes for filter
  const allUnitCodes = useMemo(() => {
    const set = new Set<string>();
    allCards.forEach(c => set.add(c.unitCode));
    return Array.from(set).sort();
  }, [allCards]);

  const openSelection = useCallback((concept: Concept, unitCode: string, itemName: string, existing?: Selection) => {
    setEditTarget({ concept, unitCode, itemName });
    setSelForm(existing || { productName: '', supplier: '', unitPrice: 0, notes: '' });
  }, []);

  function handleSaveSelection() {
    if (!editTarget) return;
    const sels = loadSelections(editTarget.concept, editTarget.unitCode);
    sels[editTarget.itemName] = { ...selForm };
    saveSelections(editTarget.concept, editTarget.unitCode, sels);
    setEditTarget(null);
    setVersion(v => v + 1);
  }

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
        <Select value={filterConcept} onValueChange={setFilterConcept}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Concepts</SelectItem>
            <SelectItem value="A">Concept A</SelectItem>
            <SelectItem value="B">Concept B</SelectItem>
            <SelectItem value="C">Concept C</SelectItem>
          </SelectContent>
        </Select>
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
        {(searchText || filterConcept !== 'all' || filterUnit !== 'all' || filterStatus !== 'all') && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setSearchText(''); setFilterConcept('all'); setFilterUnit('all'); setFilterStatus('all'); }}>
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
                      <TableHead>Required Item</TableHead>
                      <TableHead className="w-[100px] text-right">Qty</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Selected Product</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Price €</TableHead>
                      <TableHead className="w-[80px] text-center">Action</TableHead>
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
                          <TableCell className="font-medium text-sm">{item.itemName}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{item.quantity}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.category}</TableCell>
                          <TableCell className="text-sm">
                            {sel ? sel.productName : <span className="text-muted-foreground italic">—</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {sel?.supplier || '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {sel?.unitPrice ? `€${sel.unitPrice.toLocaleString()}` : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openSelection(card.concept, card.unitCode, item.itemName, sel || undefined)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
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

      {/* Selection Dialog */}
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
                  value={selForm.supplier}
                  onChange={e => setSelForm(p => ({ ...p, supplier: e.target.value }))}
                  placeholder="e.g. Muuto"
                />
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
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button onClick={handleSaveSelection} disabled={!selForm.productName.trim()}>
                Save Selection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
