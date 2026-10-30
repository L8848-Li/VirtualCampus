import type { World } from '../engine.ts';
import type { WorldSnapshot } from '../core/types.ts';
import { shareEventIndex } from '../core/eventIndex.ts';

/** Mutable state is copied for each publication. The engine already detached
 * and froze committed events, so snapshots share them without duplicating the
 * history. Each snapshot still owns its event array and query boundary. */
export function createSnapshotCapture() {
  return (world: World): WorldSnapshot => {
    const snapshot: WorldSnapshot = JSON.parse(JSON.stringify({
      version: world.version, seed: world.seed, tick: world.tick,
      npcs: world.npcs, events: [], rooms: world.rooms, groups: world.groups,
      party: world.party, inputs: world.inputs, tasks: world.tasks,
      homework: world.homework, library: world.library, assessments: world.assessments,
      deliveries: world.deliveries, parcels: world.parcels, laundry: world.laundry, activities: world.activities, clubs: world.clubs, enrollments: world.enrollments,
      livingEnabled: world.livingEnabled, living: world.living,
    }));
    snapshot.events = world.getCommittedEvents();
    shareEventIndex(snapshot.events, world.events);
    return snapshot;
  };
}
