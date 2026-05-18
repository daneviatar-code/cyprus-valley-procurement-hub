/**
 * FX rates helper — converts amounts to EUR.
 *
 * Source: https://api.frankfurter.app (ECB-backed, no API key required).
 * Frankfurter returns "1 EUR = X CUR" — we invert to "1 CUR = 1/X EUR" before storing.
 *
 * Cached in localStorage with 6h TTL; also upserted into Supabase fx_rates
 * so the DB trigger can convert offer prices server-side.
 */
import { supabase } from '@/integrations/supabase/client';

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'ILS', 'GBP', 'CHF', 'CNY'] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

const CACHE_KEY = 'cyprus-valley-fx-rates';
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface RateCache {
  fetchedAt: number;
  rates: Record<string, number>; // 1 CUR = N EUR
}

// Fallback rates (approximate, used if API unreachable and cache empty).
const FALLBACK: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  ILS: 0.25,
  GBP: 1.17,
  CHF: 1.05,
  CNY: 0.13,
};

function readCache(): RateCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.fetchedAt === 'number' && parsed.rates) return parsed;
  } catch {}
  return null;
}

function writeCache(c: RateCache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch {}
}

function isStale(c: RateCache | null): boolean {
  if (!c) return true;
  return Date.now() - c.fetchedAt > TTL_MS;
}

let refreshing: Promise<void> | null = null;

export async function refreshRatesIfNeeded(force = false): Promise<void> {
  const cached = readCache();
  if (!force && !isStale(cached)) return;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const symbols = SUPPORTED_CURRENCIES.filter(c => c !== 'EUR').join(',');
      const res = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${symbols}`);
      if (!res.ok) throw new Error(`fx api ${res.status}`);
      const data = await res.json();
      const eurToX: Record<string, number> = data.rates || {};
      const inverted: Record<string, number> = { EUR: 1 };
      for (const [cur, val] of Object.entries(eurToX)) {
        if (typeof val === 'number' && val > 0) inverted[cur] = 1 / val;
      }
      writeCache({ fetchedAt: Date.now(), rates: inverted });
      // Upsert into DB so trigger can convert server-side.
      try {
        const rows = Object.entries(inverted).map(([base, rate]) => ({
          base_currency: base,
          quote_currency: 'EUR',
          rate,
          fetched_at: new Date().toISOString(),
        }));
        await supabase.from('fx_rates').upsert(rows);
      } catch (err) {
        console.warn('[fx] db upsert failed', err);
      }
    } catch (err) {
      console.warn('[fx] refresh failed', err);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export function toEur(amount: number | null | undefined, currency: string | null | undefined): number {
  if (amount == null || isNaN(amount as number)) return 0;
  const cur = (currency || 'EUR').toUpperCase();
  if (cur === 'EUR') return amount;
  const cached = readCache();
  // Trigger background refresh if stale.
  if (isStale(cached)) void refreshRatesIfNeeded();
  const rate = cached?.rates?.[cur] ?? FALLBACK[cur];
  if (rate == null) return amount; // unknown currency → passthrough
  return amount * rate;
}

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined = 'EUR'): string {
  if (amount == null || isNaN(amount as number)) return '—';
  const cur = (currency || 'EUR').toUpperCase();
  try {
    return new Intl.NumberFormat('en-EU', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${cur}`;
  }
}
