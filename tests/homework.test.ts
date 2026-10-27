import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';

test('homework is assigned after the first class and only progresses through its owner’s actions', () => {
  const world = new World('homework');
  expect(world.homework).toHaveLength(0);
  world.step();
  expect(world.homework).toHaveLength(10);
  while (world.step()) {
    for (const item of world.homework) {
      const work = world.events.filter((event) => event.type === 'action' && event.data.homeworkId === item.id && event.people[0] === item.owner);
      expect(item.progress).toBe(work.length);
      expect(item.progress).toBeLessThanOrEqual(item.required);
    }
  }
  expect(World.fromSave(world.toSave())).toEqual(world);
});

test('work can be submitted on time or remain unfinished at the deadline', () => {
  const outcomes = new Set<string>();
  for (let seed = 0; seed < 8; seed++) {
    const world = new World(seed);
    while (world.step());
    for (const item of world.homework) {
      outcomes.add(item.status);
      const finalEvent = world.events[item.lastEvent - 1];
      expect(finalEvent.people).toEqual([item.owner]);
      if (item.status === 'completed') {
        expect(finalEvent.type).toBe('homework_completed');
        expect(finalEvent.tick).toBeLessThanOrEqual(item.deadline);
        expect(item.progress).toBe(item.required);
      } else {
        expect(item.status).toBe('expired');
        expect(finalEvent.type).toBe('homework_expired');
        expect(finalEvent.tick).toBeGreaterThan(item.deadline);
        expect(item.progress).toBeLessThan(item.required);
      }
    }
  }
  expect(outcomes).toEqual(new Set(['completed', 'expired']));
});
