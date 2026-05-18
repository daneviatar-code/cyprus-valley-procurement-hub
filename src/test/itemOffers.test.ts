/**
 * Smoke tests for itemOffers selectors + fxRates helpers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOffersForItem, getCheapestOffer, getFastestOffer, genOfferId,
  ItemOffer,
} from '@/data/itemOffersData';
import { toEur, formatMoney } from '@/lib/fxRates';

const mk = (over: Partial<ItemOffer> = {}): ItemOffer => ({
  id: genOfferId(),
  standardItemId: 'item1',
  productName: 'X',
  price: 100,
  currency: 'EUR',
  priceEur: 100,
  isSelected: false,
  createdAt: '', updatedAt: '',
  ...over,
});

describe('itemOffers selectors', () => {
  it('getOffersForItem filters by item id', () => {
    const all = [mk(), mk({ standardItemId: 'item2' })];
    expect(getOffersForItem(all, 'item1')).toHaveLength(1);
    expect(getOffersForItem(all, 'item2')).toHaveLength(1);
    expect(getOffersForItem(all, 'none')).toHaveLength(0);
  });

  it('getCheapestOffer ignores null prices', () => {
    const a = mk({ priceEur: 200 });
    const b = mk({ priceEur: 50 });
    const c = mk({ priceEur: null });
    expect(getCheapestOffer([a, b, c])?.id).toBe(b.id);
    expect(getCheapestOffer([])).toBeUndefined();
  });

  it('getFastestOffer ignores null lead times', () => {
    const a = mk({ leadTimeDays: 30 });
    const b = mk({ leadTimeDays: 7 });
    const c = mk({ leadTimeDays: null });
    expect(getFastestOffer([a, b, c])?.id).toBe(b.id);
    expect(getFastestOffer([c])).toBeUndefined();
  });

  it('genOfferId yields unique-ish prefixed ids', () => {
    const a = genOfferId();
    const b = genOfferId();
    expect(a.startsWith('off_')).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('fxRates', () => {
  beforeEach(() => {
    try { localStorage.removeItem('cyprus-valley-fx-rates'); } catch {}
  });

  it('toEur passes through EUR unchanged', () => {
    expect(toEur(123.45, 'EUR')).toBe(123.45);
  });

  it('toEur uses cached rates when present', () => {
    localStorage.setItem('cyprus-valley-fx-rates', JSON.stringify({
      fetchedAt: Date.now(),
      rates: { EUR: 1, USD: 0.5 },
    }));
    expect(toEur(10, 'USD')).toBeCloseTo(5);
  });

  it('toEur falls back when no cache for unknown currency', () => {
    // ILS fallback ~ 0.25
    const v = toEur(100, 'ILS');
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(100);
  });

  it('toEur handles null/undefined safely', () => {
    expect(toEur(null, 'USD')).toBe(0);
    expect(toEur(undefined, 'EUR')).toBe(0);
  });

  it('formatMoney renders currency or — for nullish', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined, 'EUR')).toBe('—');
    const out = formatMoney(1234.5, 'EUR');
    expect(out).toMatch(/1[,.\s]?234/);
  });
});
