/**
 * Alternatives — maps a "base" catalog product to alternative catalog products
 * for price comparison. Stored locally (per-browser).
 */

const KEY = 'cyprus-valley-alternatives';

export type AlternativesMap = Record<string, string[]>;

type Listener = (m: AlternativesMap) => void;
const listeners = new Set<Listener>();

export function loadAlternatives(): AlternativesMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function saveAlternatives(m: AlternativesMap): void {
  localStorage.setItem(KEY, JSON.stringify(m));
  listeners.forEach(l => { try { l(m); } catch {} });
}

export function subscribeAlternatives(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function addAlternative(baseId: string, altId: string): void {
  if (baseId === altId) return;
  const m = loadAlternatives();
  const list = m[baseId] ?? [];
  if (list.includes(altId)) return;
  m[baseId] = [...list, altId];
  saveAlternatives(m);
}

export function removeAlternative(baseId: string, altId: string): void {
  const m = loadAlternatives();
  const list = m[baseId] ?? [];
  m[baseId] = list.filter(id => id !== altId);
  if (m[baseId].length === 0) delete m[baseId];
  saveAlternatives(m);
}
