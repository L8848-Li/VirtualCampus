import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { dormLocation } from '../src/core/campusLife.ts';
import { chooseAction } from '../src/core/decision.ts';

test('room assignments put roommates in the same garden and personal rest targets that garden', () => {
  const world = new World('dorm-gardens');
  expect(new Set(world.npcs.map((n) => n.loc))).toEqual(new Set([0, 5, 20, 21]));
  for (const n of world.npcs) {
    const dorm = dormLocation(world.rooms[n.id]);
    expect(n.loc).toBe(dorm);
    const decision = chooseAction(n, { tick: 3, slot: 3, party: false, memories: [], roommates: [], dorm }, () => 0);
    expect(decision.options.find((option) => option.action === '休息')?.loc).toBe(dorm);
    for (const roommate of world.npcs.filter((p) => world.rooms[p.id] === world.rooms[n.id])) expect(roommate.loc).toBe(dorm);
  }
});

test('room reassignment moves only people already in dorms and preserves replay', () => {
  const world = new World('room-reassign');
  world.step();
  const before = world.npcs.map((n) => n.loc);
  expect(world.intervene('rooms')).toBe(true);
  for (const n of world.npcs) {
    if ([0, 5, 20, 21].includes(before[n.id])) {
      expect(n.loc).toBe(dormLocation(world.rooms[n.id]));
      expect(n.action).toBe('搬到新宿舍');
    } else expect(n.loc).toBe(before[n.id]);
  }
  expect(world.replay()).toEqual(world);
  while (world.step());
  expect(World.fromSave(world.toSave())).toEqual(world);
});

test('stale dorm sightings cannot direct a person to a former roommates room', () => {
  const world = new World('stale-room');
  const person = world.npcs[0];
  person.rel[1].aff = 50;
  person.known[1] = { loc: 0, tick: 0, event: 1, missed: false };
  const result = chooseAction(person, { tick: 1, slot: 1, party: false, memories: [], roommates: [1], dorm: 5 }, () => 0);
  expect(result.options.some((option) => option.kind === 'seek' && option.target === 1 && option.loc === 0)).toBe(false);
});
