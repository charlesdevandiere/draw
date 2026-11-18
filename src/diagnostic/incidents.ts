/** Incident kind, e.g. `contextmenu`, `scroll` or `pointercancel:touch`. */
export type IncidentKind = string;

export interface IncidentSnapshot {
  protectionsOn: Record<IncidentKind, number>;
  protectionsOff: Record<IncidentKind, number>;
}

export interface IncidentCounter {
  /** Counts one incident under the protection state active when it happened. */
  record(kind: IncidentKind, protectionsOn: boolean): void;
  total(protectionsOn: boolean): number;
  snapshot(): IncidentSnapshot;
  reset(): void;
}

/** Counts system-gesture incidents separately with protections on and off. */
export function createIncidentCounter(): IncidentCounter {
  let on = new Map<IncidentKind, number>();
  let off = new Map<IncidentKind, number>();

  return {
    record(kind, protectionsOn) {
      const counts = protectionsOn ? on : off;
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    },
    total(protectionsOn) {
      let sum = 0;
      for (const count of (protectionsOn ? on : off).values()) sum += count;
      return sum;
    },
    snapshot: () => ({
      protectionsOn: Object.fromEntries(on),
      protectionsOff: Object.fromEntries(off),
    }),
    reset() {
      on = new Map();
      off = new Map();
    },
  };
}
