/**
 * Per-key serialized queue for cloud writes.
 * Ensures multiple rapid edits to the same table don't race
 * (e.g., DELETE from write #2 running before UPSERT from write #1).
 */
const queues = new Map<string, Promise<void>>();
const pending = new Map<string, number>();

export function enqueue(key: string, fn: () => Promise<void>): Promise<void> {
  pending.set(key, (pending.get(key) || 0) + 1);
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev
    .catch(() => {}) // don't let one failure block the queue
    .then(fn)
    .finally(() => {
      const n = (pending.get(key) || 1) - 1;
      if (n <= 0) pending.delete(key);
      else pending.set(key, n);
    });
  queues.set(key, next);
  return next;
}

export function hasPendingWrites(): boolean {
  return pending.size > 0;
}

// Warn user if they try to navigate away with unsaved cloud writes.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (hasPendingWrites()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}
