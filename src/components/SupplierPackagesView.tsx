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
  const supplierName = (id?: string | null) =>
    suppliers.find(s => s.id === id)?.name || '—';

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
        // Best price per supplier for this item
        const bySupplier = new Map<string, ItemOffer>();
        allOffers.forEach(o => {
          if (!o.supplierId) return;
          const cur = bySupplier.get(o.supplierId);
          if (!cur || (o.priceEur ?? Infinity) < (cur.priceEur ?? Infinity)) {
            bySupplier.set(o.supplierId, o);
          }
        });
        const cheapest = getCheapestOffer(allOffers);
        return { item, hotelQty, bySupplier, cheapest, allOffers };
      });

      // Collect the union of suppliers appearing anywhere in this category
      const supplierIds = new Set<string>();
      itemRows.forEach(r => r.bySupplier.forEach((_, sid) => supplierIds.add(sid)));
      const supplierList = [...supplierIds].sort((a, b) =>
        supplierName(a).localeCompare(supplierName(b)));

      // Totals per supplier (only items where supplier offers, plus coverage)
      const supplierTotals = supplierList.map(sid => {
        let total = 0;
        let covered = 0;
        itemRows.forEach(r => {
          const o = r.bySupplier.get(sid);
          if (o && o.priceEur != null && r.hotelQty > 0) {
            total += o.priceEur * r.hotelQty;
            covered++;
          }
        });
        return {
          supplierId: sid,
          name: supplierName(sid),
          total,
          covered,
          totalItems: itemRows.filter(r => r.hotelQty > 0).length,
        };
      }).sort((a, b) => a.total - b.total);

      // Cheapest-mix total
      let cheapestTotal = 0;
      let cheapestCovered = 0;
      itemRows.forEach(r => {
        if (r.cheapest && r.cheapest.priceEur != null && r.hotelQty > 0) {
          cheapestTotal += r.cheapest.priceEur * r.hotelQty;
          cheapestCovered++;
        }
      });

      // Full-coverage suppliers only, for "best single supplier"
      const fullCoverage = supplierTotals.filter(s => s.covered === s.totalItems && s.totalItems > 0);
      const bestSingle = fullCoverage[0];
      const savingsVsSingle = bestSingle ? Math.max(0, bestSingle.total - cheapestTotal) : 0;

      return {
        cat, itemRows, supplierList, supplierTotals,
        cheapestTotal, cheapestCovered, bestSingle, savingsVsSingle,
      };
    });
  }, [categories, items, qtysByItem, offersByItem, suppliers, unitCounts]);

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
        const totalItems = pc.itemRows.filter(r => r.hotelQty > 0).length;
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
                    {pc.cat.nameEn} · {totalItems} items with qty
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
                          {pc.cheapestCovered}/{totalItems} items covered
                        </div>
                      </div>
                      {pc.supplierTotals.map(s => {
                        const full = s.covered === s.totalItems;
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
                          {pc.itemRows.map(r => (
                            <tr key={r.item.id} className="border-b hover:bg-muted/20">
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
                                  return <td key={sid} className="px-2 py-1.5 text-right text-muted-foreground">—</td>;
                                }
                                return (
                                  <td key={sid} className={`px-2 py-1.5 text-right font-mono ${
                                    isCheapest ? 'text-green-600 font-semibold' : ''
                                  }`}>
                                    <div>{formatMoney(o.priceEur * r.hotelQty, 'EUR')}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {formatMoney(o.priceEur, 'EUR')}/u
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="px-2 py-1.5 text-right font-mono bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 font-semibold">
                                {r.cheapest && r.cheapest.priceEur != null
                                  ? formatMoney(r.cheapest.priceEur * r.hotelQty, 'EUR')
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-muted/30 font-semibold">
                            <td className="px-2 py-2">Package total</td>
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
