import type { CampusEvent, EventType } from './types.ts';

export interface EventQuery {
  type?: EventType; person?: number; tick?: number;
  taskId?: string; planId?: string; activityId?: string; beliefId?: string;
  linked?: boolean;
}
const links = ['taskId', 'planId', 'activityId', 'beliefId'] as const;
class EventIndex {
  length = 0;
  all: number[] = [];
  linked: number[] = [];
  buckets = new Map<string, number[]>();
  add(event: CampusEvent) {
    const keys = [`type:${event.type}`, `tick:${event.tick}`, ...new Set(event.people.map(id => `person:${id}`))];
    let linked = false;
    for (const field of links) if (typeof event.data[field] === 'string') { keys.push(`${field}:${event.data[field]}`); linked = true; }
    for (const key of keys) {
      let bucket = this.buckets.get(key);
      if (!bucket) this.buckets.set(key, bucket = []);
      bucket.push(this.length + 1);
    }
    this.all.push(this.length + 1);
    if (linked) this.linked.push(this.length + 1);
    this.length++;
  }
}
const indexes = new WeakMap<readonly CampusEvent[], EventIndex>();

function indexFor(events: readonly CampusEvent[]): EventIndex {
  let index = indexes.get(events);
  if (!index || index.length < events.length) {
    if (!index) { index = new EventIndex(); indexes.set(events, index); }
    for (let i = index.length; i < events.length; i++) index.add(events[i]);
  }
  return index;
}

/** A snapshot owns its array and shares only append-only ID buckets. Querying
 * it always respects its own length, even after the live world advances. */
export function shareEventIndex(target: readonly CampusEvent[], source: readonly CampusEvent[]) {
  indexes.set(target, indexFor(source));
}

function queryPositions(events: readonly CampusEvent[], query: EventQuery): number[] {
  const index = indexFor(events);
  const candidates: (readonly number[])[] = [];
  for (const field of ['type', 'person', 'tick', ...links] as const) {
    if (query[field] !== undefined) candidates.push(index.buckets.get(`${field}:${query[field]}`) ?? []);
  }
  if (query.linked) candidates.push(index.linked);
  const ids = candidates.length ? candidates.reduce((a, b) => a.length <= b.length ? a : b) : index.all;
  return ids.filter(id => {
    if (id > events.length) return false;
    const event = events[id - 1];
    return (query.type === undefined || event.type === query.type)
      && (query.person === undefined || event.people.includes(query.person))
      && (query.tick === undefined || event.tick === query.tick)
      && links.every(key => query[key] === undefined || event.data[key] === query[key])
      && (!query.linked || links.some(key => typeof event.data[key] === 'string'));
  });
}

export const queryEventIds = (events: readonly CampusEvent[], query: EventQuery = {}) => queryPositions(events, query).map(position => events[position - 1].id);
export const queryEvents = (events: readonly CampusEvent[], query: EventQuery = {}) => queryPositions(events, query).map(position => events[position - 1]);
export function eventsDuring(events: readonly CampusEvent[], start: number, end: number): CampusEvent[] {
  const result: CampusEvent[] = [];
  for (let tick = start; tick < end; tick++) result.push(...queryEvents(events, { tick }));
  return result;
}
