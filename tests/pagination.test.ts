import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { filterEvents } from '../src/ui/format.ts';
import { EVENT_PAGE_SIZE, HISTORY_PAGE_SIZE, STORY_PAGE_SIZE, pageContaining, pageItems } from '../src/ui/pagination.ts';

test('all late-semester events remain reachable in bounded pages, including causal parents', () => {
  const world = new World('pagination'); while (world.step());
  const events = filterEvents([...world.events], 'all', 0, []);
  const ids = events.map(e => e.id), collected: number[] = [];
  for (let page = 0; page < Math.ceil(events.length / EVENT_PAGE_SIZE); page++) {
    const items = pageItems(events, page, EVENT_PAGE_SIZE);
    expect(items.length).toBeLessThanOrEqual(100);
    collected.push(...items.map(e => e.id));
  }
  expect(collected).toEqual(ids);
  for (const id of world.events.at(-1)!.parents) {
    const page = pageContaining(ids, id, EVENT_PAGE_SIZE)!;
    expect(pageItems(ids, page, EVENT_PAGE_SIZE)).toContain(id);
  }
  expect(pageItems(ids, -9, EVENT_PAGE_SIZE)).toEqual(ids.slice(0, 100));
  expect(pageItems([], 100, HISTORY_PAGE_SIZE)).toEqual([]);
  expect(pageItems(ids, 0, STORY_PAGE_SIZE)).toHaveLength(6);
  expect(pageItems(ids, 0, HISTORY_PAGE_SIZE)).toHaveLength(50);
});
