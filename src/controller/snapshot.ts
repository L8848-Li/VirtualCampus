import type { World } from '../engine.ts';
import type { CampusEvent, WorldSnapshot } from '../core/types.ts';

// Cached event copies are shared by successive snapshots. Freeze their full
// JSON tree before publishing so consumers cannot corrupt later snapshots.
function freezeEventTree(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const child of Object.values(value)) freezeEventTree(child);
  Object.freeze(value);
}

/** The engine only appends events after a step has been published. Copy each
 * finished event once; mutable character and task state is still copied on
 * every publication. A new event array (load/replay/reset) resets the cache. */
export function createSnapshotCapture() {
  let source: CampusEvent[] | undefined;
  let events: CampusEvent[] = [];
  return (world: World): WorldSnapshot => {
    if (source !== world.events || world.events.length < events.length) {
      source = world.events;
      events = [];
    }
    const added = world.events.slice(events.length);
    if (added.length) {
      const copies: CampusEvent[] = JSON.parse(JSON.stringify(added));
      for (const event of copies) {
        freezeEventTree(event);
        events.push(event);
      }
    }
    const snapshot: WorldSnapshot = JSON.parse(JSON.stringify({
      version: world.version, seed: world.seed, tick: world.tick,
      npcs: world.npcs, events: [], rooms: world.rooms, groups: world.groups,
      party: world.party, inputs: world.inputs, tasks: world.tasks,
      homework: world.homework, library: world.library, assessments: world.assessments,
      deliveries: world.deliveries, parcels: world.parcels, laundry: world.laundry, activities: world.activities, clubs: world.clubs, enrollments: world.enrollments,
      livingEnabled: world.livingEnabled, living: world.living,
    }));
    snapshot.events = events.slice();
    return snapshot;
  };
}
