import { test, expect } from 'vitest';
import { World } from '../src/engine.ts';
import { attendance, courseAt } from '../src/core/academics.ts';

test('the teaching week schedules two fictional courses on weekday mornings only', () => {
  expect([0, 4, 8, 12, 16].map((tick) => courseAt(tick)?.id)).toEqual(['math', 'programming', 'math', 'programming', 'math']);
  expect(courseAt(1)).toBeUndefined();
  expect(courseAt(20)).toBeUndefined();
});

test('attendance follows recorded decisions rather than scheduled classes', () => {
  const world = new World('campus-2026');
  world.step();
  for (const person of world.npcs) {
    const record = attendance(world.events, person.id, world.tick);
    const action = world.events.find((event) => event.tick === 0 && event.type === 'action' && event.people[0] === person.id)!;
    expect(record).toHaveLength(1);
    expect(record[0].attended).toBe(action.data.courseId === 'math');
    if (record[0].attended) expect(action.data.location).toBe(1);
  }
  expect(World.fromSave(world.toSave())).toEqual(world);
});

test('the added places can actually be reached in simulated weeks', () => {
  const visited = new Set<number>();
  for (let seed = 0; seed < 50; seed++) {
    const world = new World(seed);
    while (world.step()) world.npcs.forEach((person) => visited.add(person.loc));
  }
  for (const id of [6, 7, 8, 9, 10, 11]) expect(visited.has(id)).toBe(true);
});
