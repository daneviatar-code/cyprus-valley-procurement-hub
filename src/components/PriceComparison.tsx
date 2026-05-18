/**
 * Price Comparison tab — cross-item view of all supplier offers,
 * surfaces savings opportunities and items missing a selection.
 */
import { Fragment as FragmentRow, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileSpreadsheet, Search, ChevronRight, ChevronDown, AlertTriangle,
  TrendingDown, Package, XCircle, ExternalLink,
} from 'lucide-react';
import {
  StandardItem, loadStandardItems, subscribeStandardItems,
} from '@/data/standardItemsData';
import { Supplier, loadSuppliers, subscribeSuppliers } from '@/data/supplierData';
import {
  ItemOffer, loadItemOffers, subscribeItemOffers,
  getOffersForItem, getCheapestOffer, getFastestOffer,
} from '@/data/itemOffersData';
import { ProcurementCategory, loadCategories } from '@/data/roomStandardsData';
import { formatMoney, refreshRatesIfNeeded } from '@/lib/fxRates';
import ItemOffersDialog from '@/components/ItemOffersDialog';

type Filter = 'all' | 'no-selection' | 'expired';

const FIELDS: Array<{ key: keyof ItemOffer | 'eur'; label: string; }> = [
  { key: 'productName', label: 'Product' },
  { key: 'productSku', label: 'SKU' },
  { key: 'spec', label: 'Spec' },
  { key: 'dimensions', label: 'Dimensions' },
  { key: 'price', label: 'Price' },
  { key: 'eur', label: 'Price (EUR)' },
  { key: 'leadTimeDays', label: 'Lead time' },
  { key: 'moq', label: 'MOQ' },
  { key: 'validUntil', label: 'Valid until' },
  { key: 'notes', label: 'Notes' },
];

function isExpired(o: ItemOffer): boolean {
  if (!o.validUntil) return false;
  return new Date(o.validUntil).getTime() < Date.now();
}

export default function PriceComparison() {
  const [items, setItems] = useState<StandardItem[]>(loadStandardItems);
  const [suppliers, setSuppliers] = useState<Supplier[]>(loadSuppliers);
  const [offers, setOffers] = useState<ItemOffer[]>(loadItemOffers);
  const [categories] = useState<ProcurementCategory[]>(loadCategories);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogItem, setDialogItem] = useState<StandardItem | null>(null);

  useEffect(() => subscribeStandardItems(setItems), []);
  useEffect(() => subscribeSuppliers(setSuppliers), []);
  useEffect(() => subscribeItemOffers(setOffers), []);
  useEffect(() => { void refreshRatesIfNeeded(); }, []);

  const supplierName = (id?: string | null) =>
    suppliers.find(s => s.id === id)?.name || '—';

  // Build a synthetic "base" offer from the Standard Item itself so existing
  // specs/prices appear as the first offer and stay linked to the item.
  const buildBaseOffer = (item: StandardItem): ItemOffer | null => {
    const hasData = (item.unitPriceEur != null && item.unitPriceEur > 0)
      || !!item.spec || !!item.dimensions || !!item.supplierId;
    if (!hasData) return null;
    const price = item.unitPriceEur ?? 0;
    return {
      id: `base:${item.id}`,
      standardItemId: item.id,
      supplierId: item.supplierId ?? null,
      productName: item.itemName || '(standard)',
      productSku: null,
      spec: item.spec ?? null,
      dimensions: item.dimensions ?? null,
      imageUrl: null,
      price,
      currency: 'EUR',
      priceEur: price,
      leadTimeDays: null,
      moq: null,
      validUntil: null,
      notes: 'Baseline from Standard item',
      isSelected: false, // overridden below if no real selection exists
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  };

  const analysis = useMemo(() => {
    return items
      .filter(i => !i.archived)
      .sort((a, b) => (a.itemName || '').localeCompare(b.itemName || '', 'en', { sensitivity: 'base' }))
      .map(item => {
        const real = getOffersForItem(offers, item.id);
        const base = buildBaseOffer(item);
        const realSelected = real.find(o => o.isSelected);
        // Synthetic base is "selected" only when no real offer is selected.
        const baseWithSel = base
          ? { ...base, isSelected: !realSelected }
          : null;
        const list: ItemOffer[] = baseWithSel ? [baseWithSel, ...real] : real;
        const selected = list.find(o => o.isSelected);
        const cheapest = getCheapestOffer(list);
        const fastest = getFastestOffer(list);
        const expiredCount = list.filter(isExpired).length;
        const savings =
          selected && cheapest && cheapest.id !== selected.id &&
          (selected.priceEur ?? 0) > (cheapest.priceEur ?? 0)
            ? (selected.priceEur ?? 0) - (cheapest.priceEur ?? 0)
            : 0;
        return { item, list, selected, cheapest, fastest, expiredCount, savings };
      });
  }, [items, offers]);

  const kpis = useMemo(() => {
    let potentialSavings = 0;
    let noSelection = 0;
    let withExpired = 0;
    let itemsWithOffers = 0;
    for (const a of analysis) {
      potentialSavings += a.savings;
      if (a.list.length > 0) itemsWithOffers++;
      if (!a.selected) noSelection++;
      if (a.expiredCount > 0) withExpired++;
    }
    return {
      potentialSavings,
      noSelection,
      withExpired,
      itemsWithOffers,
      totalItems: analysis.length,
    };
  }, [analysis]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return analysis.filter(a => {
      if (selectedCats.size > 0 && !selectedCats.has(a.item.categoryId)) return false;
      if (filter === 'no-selection' && a.selected) return false;
      if (filter === 'expired' && a.expiredCount === 0) return false;
      if (term) {
        const hay = `${a.item.itemName} ${a.item.spec}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [analysis, search, filter, selectedCats]);

  const toggleCat = (id: string) => {
    setSelectedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const visibleCategories = useMemo(
    () => categories.filter(c => !c.archived).sort((a, b) => a.order - b.order),
    [categories],
  );

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const rows: any[] = [];
    analysis.forEach(a => {
      a.list.forEach(o => {
        rows.push({
          Item: a.item.itemName,
          Supplier: supplierName(o.supplierId),
          Product: o.productName,
          SKU: o.productSku || '',
          Price: o.price,
          Currency: o.currency,
          'Price (EUR)': o.priceEur ?? '',
          'Lead time (days)': o.leadTimeDays ?? '',
          MOQ: o.moq ?? '',
          'Valid until': o.validUntil || '',
          Selected: o.isSelected ? 'Yes' : '',
          Cheapest: a.cheapest?.id === o.id ? 'Yes' : '',
          Fastest: a.fastest?.id === o.id ? 'Yes' : '',
          Notes: o.notes || '',
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Price Comparison');
    XLSX.writeFile(wb, `price-comparison-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Price Comparison</h2>
          <p className="text-xs text-muted-foreground">Compare supplier offers across all standard items.</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} className="gap-2">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Export to Excel
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi
          icon={<TrendingDown className="w-4 h-4" />}
          label="Potential savings"
          value={formatMoney(kpis.potentialSavings, 'EUR')}
          accent="text-green-600"
        />
        <Kpi
          icon={<XCircle className="w-4 h-4" />}
          label="Items without selection"
          value={kpis.noSelection.toString()}
          accent="text-orange-600"
          onClick={() => setFilter('no-selection')}
          active={filter === 'no-selection'}
        />
        <Kpi
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Items with expired offers"
          value={kpis.withExpired.toString()}
          accent="text-destructive"
          onClick={() => setFilter('expired')}
          active={filter === 'expired'}
        />
        <Kpi
          icon={<Package className="w-4 h-4" />}
          label="Items with offers"
          value={`${kpis.itemsWithOffers} / ${kpis.totalItems}`}
          accent="text-primary"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search items or specs…"
            className="pl-7 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {([['all', 'All'], ['no-selection', 'No selection'], ['expired', 'Has expired']] as [Filter, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === k ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Categories:</span>
        <button
          onClick={() => setSelectedCats(new Set())}
          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
            selectedCats.size === 0
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground hover:text-foreground border-border'
          }`}
        >
          All
        </button>
        {visibleCategories.map(c => {
          const active = selectedCats.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => toggleCat(c.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground hover:bg-muted border-border'
              }`}
            >
              {c.nameHe} <span className="opacity-60">· {c.nameEn}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b">
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-2 w-8"></th>
              <th className="px-2 py-2">Item</th>
              <th className="px-2 py-2 text-right"># Offers</th>
              <th className="px-2 py-2">Selected</th>
              <th className="px-2 py-2">Cheapest</th>
              <th className="px-2 py-2 text-right">Potential savings</th>
              <th className="px-2 py-2 text-right">Expired</th>
              <th className="px-2 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No items match.</td></tr>
            )}
            {filtered.map(a => {
              const isOpen = expanded.has(a.item.id);
              return (
                <FragmentRow key={a.item.id}>
                  <tr className="border-b hover:bg-muted/30">
                    <td className="px-2 py-1.5">
                      {a.list.length > 0 ? (
                        <button onClick={() => toggleExpand(a.item.id)} className="text-muted-foreground hover:text-foreground">
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{a.item.itemName || '(unnamed)'}</div>
                      {a.item.spec && <div className="text-[10px] text-muted-foreground truncate max-w-xs">{a.item.spec}</div>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {a.list.length === 0
                        ? <span className="text-muted-foreground">0</span>
                        : a.list.length}
                    </td>
                    <td className="px-2 py-1.5">
                      {a.selected ? (
                        <div>
                          <div>{supplierName(a.selected.supplierId)}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {formatMoney(a.selected.priceEur, 'EUR')}
                          </div>
                        </div>
                      ) : a.list.length === 0
                        ? <span className="text-muted-foreground text-[11px]">—</span>
                        : <span className="text-orange-600 text-[11px]">no selection</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      {a.cheapest ? (
                        <div>
                          <div>{supplierName(a.cheapest.supplierId)}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {formatMoney(a.cheapest.priceEur, 'EUR')}
                          </div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {a.savings > 0 ? (
                        <span className="text-green-600 font-semibold">
                          -{formatMoney(a.savings, 'EUR')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">
                      {a.expiredCount > 0 ? <span className="text-destructive">{a.expiredCount}</span> : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Button
                        size="sm"
                        variant={a.list.length === 0 ? 'default' : 'outline'}
                        className="h-7 text-xs gap-1"
                        onClick={() => setDialogItem(a.item)}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {a.list.length === 0 ? 'Add offer' : 'Open'}
                      </Button>
                    </td>
                  </tr>
                  {isOpen && a.list.length > 0 && (
                    <tr className="bg-muted/20">
                      <td></td>
                      <td colSpan={7} className="px-2 py-3">
                        <CompareGrid
                          offers={a.list}
                          cheapestId={a.cheapest?.id}
                          fastestId={a.fastest?.id}
                          supplierName={supplierName}
                        />
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
          </tbody>
        </table>
      </div>

      <ItemOffersDialog
        open={!!dialogItem}
        onOpenChange={(v) => { if (!v) setDialogItem(null); }}
        item={dialogItem}
      />
    </div>
  );
}

function Kpi({
  icon, label, value, accent, onClick, active,
}: {
  icon: React.ReactNode; label: string; value: string;
  accent?: string; onClick?: () => void; active?: boolean;
}) {
  const cls = `bg-card border rounded-lg p-3 ${onClick ? 'cursor-pointer hover:border-primary transition-colors' : ''} ${active ? 'border-primary ring-1 ring-primary' : ''}`;
  return (
    <div className={cls} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground ${accent || ''}`}>
        {icon}{label}
      </div>
      <div className={`text-xl font-bold font-mono mt-1 ${accent || 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function CompareGrid({
  offers, cheapestId, fastestId, supplierName,
}: {
  offers: ItemOffer[];
  cheapestId?: string;
  fastestId?: string;
  supplierName: (id?: string | null) => string;
}) {
  const fmtField = (o: ItemOffer, key: typeof FIELDS[number]['key']): string => {
    if (key === 'eur') return formatMoney(o.priceEur, 'EUR');
    if (key === 'price') return formatMoney(o.price, o.currency);
    if (key === 'leadTimeDays') return o.leadTimeDays != null ? `${o.leadTimeDays}d` : '—';
    if (key === 'moq') return o.moq != null ? String(o.moq) : '—';
    if (key === 'validUntil') return o.validUntil || '—';
    const v = (o as any)[key];
    return v == null || v === '' ? '—' : String(v);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-2 py-1 text-left text-[10px] uppercase text-muted-foreground border-r">Field</th>
            {offers.map(o => (
              <th key={o.id} className={`px-2 py-1 text-left text-[10px] uppercase border-r last:border-r-0 ${o.isSelected ? 'bg-accent/10' : ''}`}>
                <div className="flex items-center gap-1">
                  <span className="text-foreground normal-case font-semibold">{supplierName(o.supplierId)}</span>
                  {o.isSelected && <span className="text-[9px] px-1 rounded bg-accent/30">selected</span>}
                  {cheapestId === o.id && <span className="text-[9px] px-1 rounded bg-green-100 text-green-800">cheapest</span>}
                  {fastestId === o.id && <span className="text-[9px] px-1 rounded bg-blue-100 text-blue-800">fastest</span>}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FIELDS.map(f => (
            <tr key={f.key as string} className="border-t">
              <td className="px-2 py-1 text-muted-foreground border-r">{f.label}</td>
              {offers.map(o => (
                <td key={o.id} className={`px-2 py-1 border-r last:border-r-0 font-mono ${o.isSelected ? 'bg-accent/10' : ''}`}>
                  {fmtField(o, f.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
