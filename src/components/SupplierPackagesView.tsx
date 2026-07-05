/**
 * Supplier Packages View — for each category, shows how much a "package"
 * (all items in the category × their hotel quantities) would cost:
 *   • per supplier (only when that supplier offers all items — otherwise partial)
 *   • cheapest per item (best mix)
 *
 * Data sources:
 *   - Standard items + apartment-type quantities → hotel qty per item
 *   - Item Offers → prices per supplier
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Trophy, TrendingDown } from 'lucide-react';
import {
  StandardItem, ApartmentType, APARTMENT_TYPES, ApartmentTypeQuantity,
} from '@/data/standardItemsData';
import { ItemOffer, getCheapestOffer } from '@/data/itemOffersData';
import { Supplier } from '@/data/supplierData';
import { ProcurementCategory } from '@/data/roomStandardsData';
import { RoomSize } from '@/data/masterData';
import { formatMoney } from '@/lib/fxRates';

interface Props {
  categories: ProcurementCategory[];
  items: StandardItem[];
  qtysByItem: Map<string, Record<ApartmentType, ApartmentTypeQuantity | undefined>>;
  offersByItem: Map<string, ItemOffer[]>;
  suppliers: Supplier[];
  unitCounts: Record<RoomSize, number>;
}

// Hotel-wide qty for one master item (sum across all apartment types)
function hotelQtyForItem(
  item: StandardItem,
  qtysByItem: Map<string, Record<ApartmentType, ApartmentTypeQuantity | undefined>>,
  unitCounts: Record<RoomSize, number>,
): number {
  const row = qtysByItem.get(item.id);
  if (!row) return 0;
  let q = 0;
  APARTMENT_TYPES.forEach(at => {
    const r = row[at];
    if (!r) return;
    q += ((r.qtyPerPackage || 0) + (r.sparePerPackage || 0)) * (unitCounts[at] || 0);
  });
  return q;
}

// Build a "base" offer from item's own standard fields, so the standard
// values participate in the comparison alongside real offers.
function baseOfferFromItem(item: StandardItem): ItemOffer | null {
  if (!item.supplierId || !item.unitPriceEur || item.unitPriceEur <= 0) return null;
  return {
    id: `base:${item.id}`,
    standardItemId: item.id,
    supplierId: item.supplierId,
    productName: item.itemName || '(standard)',
    productSku: null, spec: item.spec, dimensions: item.dimensions,
    imageUrl: null, price: item.unitPriceEur, currency: 'EUR',
    priceEur: item.unitPriceEur, leadTimeDays: null, moq: null,
    validUntil: null, notes: null, isSelected: false,
    createdAt: item.createdAt, updatedAt: item.updatedAt,
  };
}

export default function SupplierPackagesView({
  categories, items, qtysByItem, offersByItem, suppliers, unitCounts,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Per-category set of EXCLUDED item ids (unchecked). Default = all included.
  const [excluded, setExcluded] = useState<Record<string, Set<string>>>({});
  const supplierName = (id?: string | null) =>
    suppliers.find(s => s.id === id)?.name || '—';

  const isExcluded = (catId: string, itemId: string) =>
    excluded[catId]?.has(itemId) ?? false;

  const toggleItem = (catId: string, itemId: string) => {
    setExcluded(prev => {
      const cur = new Set(prev[catId] || []);
      cur.has(itemId) ? cur.delete(itemId) : cur.add(itemId);
      return { ...prev, [catId]: cur };
    });
  };

  const setCategoryExcluded = (catId: string, itemIds: string[]) => {
    setExcluded(prev => ({ ...prev, [catId]: new Set(itemIds) }));
  };

  const perCategory = useMemo(() => {
    return categories.map(cat => {
      const catItems = items
        .filter(i => !i.archived && i.categoryId === cat.id)
        .sort((a, b) => a.order - b.order);

      // For each item: hotel qty + list of offers (real + base) keyed by supplier
      const itemRows = catItems.map(item => {
        const hotelQty = hotelQtyForItem(item, qtysByItem, unitCounts);
        const real = offersByItem.get(item.id) || [];
        const base = baseOfferFromItem(item);
        const allOffers = base ? [base, ...real] : real;
        const bySupplier = new Map<string, ItemOffer>();
        allOffers.forEach(o => {
          if (!o.supplierId) return;
          const cur = bySupplier.get(o.supplierId);
          if (!cur || (o.priceEur ?? Infinity) < (cur.priceEur ?? Infinity)) {
            bySupplier.set(o.supplierId, o);
          }
        });
        const cheapest = getCheapestOffer(allOffers);
        const included = !isExcluded(cat.id, item.id);
        return { item, hotelQty, bySupplier, cheapest, allOffers, included };
      });

      // Only rows the user has included AND that have hotel qty > 0
      const activeRows = itemRows.filter(r => r.included && r.hotelQty > 0);

      // Suppliers appearing anywhere in this category (based on ALL rows so
      // columns don't collapse when a user toggles items).
      const supplierIds = new Set<string>();
      itemRows.forEach(r => r.bySupplier.forEach((_, sid) => supplierIds.add(sid)));
      const supplierList = [...supplierIds].sort((a, b) =>
        supplierName(a).localeCompare(supplierName(b)));

      const supplierTotals = supplierList.map(sid => {
        let total = 0;
        let covered = 0;
        activeRows.forEach(r => {
          const o = r.bySupplier.get(sid);
          if (o && o.priceEur != null) {
            total += o.priceEur * r.hotelQty;
            covered++;
          }
        });
        return {
          supplierId: sid,
          name: supplierName(sid),
          total,
          covered,
          totalItems: activeRows.length,
        };
      }).sort((a, b) => a.total - b.total);

      let cheapestTotal = 0;
      let cheapestCovered = 0;
      activeRows.forEach(r => {
        if (r.cheapest && r.cheapest.priceEur != null) {
          cheapestTotal += r.cheapest.priceEur * r.hotelQty;
          cheapestCovered++;
        }
      });

      // Per apartment-type package cost (for ONE apartment of that type).
      // Per supplier: sum over active rows of (qtyPerPackage+spare) * price if offered.
      // Per "cheapest": sum using each item's cheapest offer.
      const perAptType: Record<ApartmentType, {
        perSupplier: Record<string, number>;
        cheapest: number;
      }> = {} as any;
      APARTMENT_TYPES.forEach(at => {
        const perSupplier: Record<string, number> = {};
        supplierList.forEach(sid => { perSupplier[sid] = 0; });
        let cheapest = 0;
        activeRows.forEach(r => {
          const qtyRow = qtysByItem.get(r.item.id)?.[at];
          const pkgQty = (qtyRow?.qtyPerPackage || 0) + (qtyRow?.sparePerPackage || 0);
          if (pkgQty <= 0) return;
          supplierList.forEach(sid => {
            const o = r.bySupplier.get(sid);
            if (o && o.priceEur != null) perSupplier[sid] += o.priceEur * pkgQty;
          });
          if (r.cheapest && r.cheapest.priceEur != null) {
            cheapest += r.cheapest.priceEur * pkgQty;
          }
        });
        perAptType[at] = { perSupplier, cheapest };
      });

      const fullCoverage = supplierTotals.filter(s => s.covered === s.totalItems && s.totalItems > 0);
      const bestSingle = fullCoverage[0];
      const savingsVsSingle = bestSingle ? Math.max(0, bestSingle.total - cheapestTotal) : 0;

      return {
        cat, itemRows, activeRows, supplierList, supplierTotals,
        cheapestTotal, cheapestCovered, bestSingle, savingsVsSingle,
        perAptType,
      };
    });
  }, [categories, items, qtysByItem, offersByItem, suppliers, unitCounts, excluded]);

  const aptLabel = (at: ApartmentType): string => {
    switch (at) {
      case 'studio': return 'Studio';
      case '1br': return '1 BR';
      case '2br': return '2 BR';
      case '3br': return '3 BR';
      case '4br': return '4 BR';
    }
  };

  const toggle = (id: string) => setExpanded(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  return (
    <div className="space-y-3">
      <div className="bg-card border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Supplier Packages · חבילות ספקים לפי קטגוריה
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground">
          For each category: how much the whole package (all items × hotel quantities)
          costs if bought from a single supplier — vs. taking the cheapest offer per item.
          Uses offers from the Price Comparison tab.
        </p>
      </div>

      {perCategory.map(pc => {
        const open = expanded.has(pc.cat.id);
        const totalItemsWithQty = pc.itemRows.filter(r => r.hotelQty > 0).length;
        const activeCount = pc.activeRows.length;
        return (
          <div key={pc.cat.id} className="bg-card border rounded-lg">
            <button
              onClick={() => toggle(pc.cat.id)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground" dir="rtl">
                    {pc.cat.nameHe}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {pc.cat.nameEn} · {activeCount}/{totalItemsWithQty} items included
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cheapest mix</div>
                  <div className="text-sm font-mono font-semibold text-green-600">
                    {formatMoney(pc.cheapestTotal, 'EUR')}
                  </div>
                </div>
                {pc.bestSingle && (
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Best single supplier</div>
                    <div className="text-sm font-mono font-semibold text-foreground">
                      {formatMoney(pc.bestSingle.total, 'EUR')}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                      {pc.bestSingle.name}
                    </div>
                  </div>
                )}
                {pc.savingsVsSingle > 0 && (
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Savings</div>
                    <div className="text-sm font-mono font-semibold text-green-600">
                      -{formatMoney(pc.savingsVsSingle, 'EUR')}
                    </div>
                  </div>
                )}
              </div>
            </button>

            {open && (
              <div className="border-t p-3 space-y-3">
                {pc.itemRows.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    No items in this category.
                  </div>
                ) : (
                  <>
                    {/* Quick selection controls */}
                    <div className="flex items-center flex-wrap gap-1.5 text-[11px]">
                      <span className="text-muted-foreground mr-1">Quick select:</span>
                      <button
                        onClick={() => setCategoryExcluded(pc.cat.id, [])}
                        className="px-2 py-1 rounded border border-border hover:bg-muted text-foreground"
                      >
                        All items
                      </button>
                      <button
                        onClick={() => setCategoryExcluded(
                          pc.cat.id,
                          pc.itemRows.filter(r => r.hotelQty > 0).map(r => r.item.id),
                        )}
                        className="px-2 py-1 rounded border border-border hover:bg-muted text-foreground"
                      >
                        None
                      </button>
                      {pc.supplierList.length >= 2 && (
                        <button
                          onClick={() => {
                            // Include only items every supplier offers
                            const exclude = pc.itemRows
                              .filter(r => r.hotelQty > 0)
                              .filter(r => pc.supplierList.some(sid => !r.bySupplier.get(sid)))
                              .map(r => r.item.id);
                            setCategoryExcluded(pc.cat.id, exclude);
                          }}
                          className="px-2 py-1 rounded border border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary"
                          title="Include only items every supplier offers — apples-to-apples comparison"
                        >
                          Common to all suppliers
                        </button>
                      )}
                      {pc.supplierList.map(sid => (
                        <button
                          key={sid}
                          onClick={() => {
                            // Include only items THIS supplier offers
                            const exclude = pc.itemRows
                              .filter(r => r.hotelQty > 0 && !r.bySupplier.get(sid))
                              .map(r => r.item.id);
                            setCategoryExcluded(pc.cat.id, exclude);
                          }}
                          className="px-2 py-1 rounded border border-border hover:bg-muted text-foreground"
                          title={`Include only items offered by ${supplierName(sid)}`}
                        >
                          Only {supplierName(sid)}'s items
                        </button>
                      ))}
                    </div>

                    {/* Suppliers summary bar */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="rounded-md border-2 border-green-500/40 bg-green-50 dark:bg-green-950/20 p-2">
                        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-green-700 dark:text-green-400">
                          <Trophy className="w-3 h-3" /> Cheapest mix
                        </div>
                        <div className="text-sm font-mono font-bold text-green-700 dark:text-green-400">
                          {formatMoney(pc.cheapestTotal, 'EUR')}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {pc.cheapestCovered}/{activeCount} items covered
                        </div>
                      </div>
                      {pc.supplierTotals.map(s => {
                        const full = s.covered === s.totalItems && s.totalItems > 0;
                        return (
                          <div
                            key={s.supplierId}
                            className={`rounded-md border p-2 ${
                              full ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/20'
                            }`}
                          >
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                              {s.name}
                            </div>
                            <div className="text-sm font-mono font-bold text-foreground">
                              {formatMoney(s.total, 'EUR')}
                            </div>
                            <div className={`text-[10px] ${full ? 'text-primary' : 'text-orange-600'}`}>
                              {s.covered}/{s.totalItems} items {full ? '· full' : '· partial'}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Item × supplier matrix */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 border-b">
                          <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                            <th className="px-2 py-1.5 w-8"></th>
                            <th className="px-2 py-1.5">Item</th>
                            <th className="px-2 py-1.5 text-right">Hotel Qty</th>
                            {pc.supplierList.map(sid => (
                              <th key={sid} className="px-2 py-1.5 text-right">
                                {supplierName(sid)}
                              </th>
                            ))}
                            <th className="px-2 py-1.5 text-right bg-green-50 dark:bg-green-950/20">
                              Cheapest
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pc.itemRows.map(r => {
                            const disabled = r.hotelQty === 0;
                            const dim = disabled || !r.included;
                            return (
                              <tr
                                key={r.item.id}
                                className={`border-b hover:bg-muted/20 ${dim ? 'opacity-50' : ''}`}
                              >
                                <td className="px-2 py-1.5">
                                  <input
                                    type="checkbox"
                                    checked={r.included && !disabled}
                                    disabled={disabled}
                                    onChange={() => toggleItem(pc.cat.id, r.item.id)}
                                    className="w-3.5 h-3.5 accent-primary cursor-pointer disabled:cursor-not-allowed"
                                    title={disabled ? 'No hotel quantity' : 'Include in package totals'}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <div className="font-medium truncate max-w-[240px]">
                                    {r.item.itemName || '(unnamed)'}
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono">{r.hotelQty}</td>
                                {pc.supplierList.map(sid => {
                                  const o = r.bySupplier.get(sid);
                                  const isCheapest = r.cheapest?.supplierId === sid
                                    && (o?.priceEur ?? Infinity) === (r.cheapest?.priceEur ?? Infinity);
                                  if (!o || o.priceEur == null) {
                                    return <td key={sid} className="px-2 py-1.5 text-right text-muted-foreground align-top">—</td>;
                                  }
                                  const specTitle = [
                                    o.productName,
                                    o.productSku ? `SKU: ${o.productSku}` : '',
                                    o.dimensions ? `Dim: ${o.dimensions}` : '',
                                    o.spec || '',
                                  ].filter(Boolean).join('\n');
                                  return (
                                    <td key={sid} className={`px-2 py-1.5 text-right font-mono align-top ${
                                      isCheapest && r.included ? 'text-green-600 font-semibold' : ''
                                    }`} title={specTitle}>
                                      <div>{formatMoney(o.priceEur * r.hotelQty, 'EUR')}</div>
                                      <div className="text-[10px] text-muted-foreground">
                                        {formatMoney(o.priceEur, 'EUR')}/u
                                      </div>
                                      {(o.productName || o.spec || o.dimensions) && (
                                        <div className="mt-1 text-[10px] text-left font-sans text-muted-foreground max-w-[180px] whitespace-normal break-words" dir="auto">
                                          {o.productName && (
                                            <div className="text-foreground/80 font-medium truncate" title={o.productName}>
                                              {o.productName}
                                            </div>
                                          )}
                                          {o.dimensions && <div className="truncate" title={o.dimensions}>{o.dimensions}</div>}
                                          {o.spec && <div className="line-clamp-2" title={o.spec}>{o.spec}</div>}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-1.5 text-right font-mono bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 font-semibold">
                                  {r.cheapest && r.cheapest.priceEur != null
                                    ? formatMoney(r.cheapest.priceEur * r.hotelQty, 'EUR')
                                    : '—'}
                                </td>
                              </tr>
                            );
                          })}
                          {APARTMENT_TYPES.map(at => {
                            const row = pc.perAptType[at];
                            const anyValue = pc.supplierList.some(sid => row.perSupplier[sid] > 0) || row.cheapest > 0;
                            if (!anyValue) return null;
                            const units = unitCounts[at] || 0;
                            return (
                              <tr key={`apt-${at}`} className="bg-muted/10 border-b">
                                <td></td>
                                <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
                                  Package / {aptLabel(at)} <span className="opacity-60">({units} units)</span>
                                </td>
                                <td></td>
                                {pc.supplierList.map(sid => (
                                  <td key={sid} className="px-2 py-1.5 text-right font-mono text-[11px]">
                                    {row.perSupplier[sid] > 0 ? formatMoney(row.perSupplier[sid], 'EUR') : '—'}
                                  </td>
                                ))}
                                <td className="px-2 py-1.5 text-right font-mono text-[11px] bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
                                  {row.cheapest > 0 ? formatMoney(row.cheapest, 'EUR') : '—'}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-muted/30 font-semibold">
                            <td></td>
                            <td className="px-2 py-2">Package total ({activeCount} items)</td>
                            <td></td>
                            {pc.supplierList.map(sid => {
                              const s = pc.supplierTotals.find(x => x.supplierId === sid);
                              return (
                                <td key={sid} className="px-2 py-2 text-right font-mono">
                                  {s ? formatMoney(s.total, 'EUR') : '—'}
                                </td>
                              );
                            })}
                            <td className="px-2 py-2 text-right font-mono bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400">
                              {formatMoney(pc.cheapestTotal, 'EUR')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
