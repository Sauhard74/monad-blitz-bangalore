/**
 * Server-side in-memory pub/sub for memory events, keyed by companyId.
 *
 * Server routes (e.g. memory write/recall handlers) publish `OfficeEvent`s here;
 * the per-browser SSE stream subscribes so events reach the office UI. Process-
 * local and ephemeral — no persistence, no cross-instance fan-out.
 */
import type { OfficeEvent } from '@/lib/domain/types';

type Listener = (event: OfficeEvent) => void;

const channels = new Map<string, Set<Listener>>();

/** Subscribe to a company's memory events. Returns an unsubscribe fn. */
export function subscribeMemory(companyId: string, listener: Listener): () => void {
  let set = channels.get(companyId);
  if (!set) {
    set = new Set<Listener>();
    channels.set(companyId, set);
  }
  set.add(listener);

  return () => {
    const current = channels.get(companyId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) channels.delete(companyId);
  };
}

/** Publish a memory event to all current subscribers of a company. */
export function publishMemory(companyId: string, event: OfficeEvent): void {
  const set = channels.get(companyId);
  if (!set) return;
  // Iterate a copy so listeners may (un)subscribe during delivery.
  for (const listener of [...set]) listener(event);
}
