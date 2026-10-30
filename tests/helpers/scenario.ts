import { createHash } from 'node:crypto';
import type { World } from '../../src/engine.ts';
import type { ActionScore, CampusEvent } from '../../src/core/types.ts';

export function interveneAt(world: World, tick = world.tick) {
  if (tick % 5 === 0) world.intervene('rooms');
  if (tick % 7 === 0) world.intervene('groups');
  if (tick % 6 === 0) world.intervene('party');
}

/** Canonical behaviour ignores only storage representation and version labels. */
export function behaviourState(world: World): Record<string, unknown> {
  const source = world as World & { getState?: () => object };
  const state = { ...(source.getState ? source.getState() : world) } as Record<string, unknown>;
  delete state.events;
  delete state.version;
  return state;
}

export function behaviourEvents(world: World, start = 0): CampusEvent[] {
  const source = world as World & { getActionScores?: (id: number) => readonly ActionScore[] | undefined };
  return world.events.slice(start).map(event => {
    const data = { ...event.data };
    delete data.engineVersion;
    const scores = source.getActionScores?.(event.id) ?? data.scores;
    if (scores) data.scores = [...scores];
    return { ...event, data };
  });
}

export function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item,
  )).digest('hex');
}
