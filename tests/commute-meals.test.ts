import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { lateness, preferredMealWindow, travelMinutes } from '../src/core/campusLife.ts';
import { attendance } from '../src/core/academics.ts';
import type { AgentPlan } from '../src/core/types.ts';

test('a student may change a familiar window after personally experiencing a long queue', () => {
  const person = { id: 4, interest: '甜点与食谱' };
  expect(preferredMealWindow(person, false)).toBe('家常饭');
  expect(preferredMealWindow(person, true)).not.toBe(preferredMealWindow(person, false));
});

test('late arrival requires a lunch-period time deficit', () => {
  expect(lateness(8, 18, true)).toBe(6);
  expect(lateness(8, 0, true)).toBe(0);
  expect(lateness(8, 30, false)).toBe(0);
  expect(travelMinutes(1, 1)).toBe(0);
});

test('a long queue keeps committed diners at the agreed restaurant while solo diners may switch', () => {
  const world = new World('appointment-queue');
  world.tick = 1;
  // The forced random value makes every eligible solo diner willing to switch.
  world.rand = () => 0;
  world.sample = () => 0;
  for (const person of world.npcs) Object.assign(person, {
    hunger: 95, energy: 95, social: 10, ambition: 0.1, ext: 0, home: 2, habit: 0, interest: '机器人制作', loc: 0, previousLoc: 0,
  });
  const plan = (target: number): AgentPlan => ({ id: 'queue-meal', kind: 'appointment', target, location: 2,
    createdTick: 0, dueTick: 1, untilTick: 2, stage: 'pending', attempts: 0, worked: 0, lastEvent: 1 });
  world.npcs[0].plan = plan(1);
  world.npcs[1].plan = plan(0);
  world.step();
  const actions = world.events.filter((e) => e.tick === 1 && e.type === 'action');
  expect(actions.filter((e) => e.data.location === 2)).toHaveLength(world.npcs.length);
  expect(world.events.some((e) => e.type === 'restaurant_alternative' && ![0, 1].includes(e.people[0]))).toBe(true);
  expect(world.events.some((e) => e.type === 'restaurant_alternative' && [0, 1].includes(e.people[0]))).toBe(false);
  expect(world.npcs[0].loc).toBe(2);
  expect(world.npcs[1].loc).toBe(2);
  expect(world.events.some((e) => e.type === 'restaurant_wait' && e.people[0] === 0)).toBe(true);
  expect(world.events.some((e) => e.type === 'plan_fulfilled' && e.data.planId === 'queue-meal')).toBe(true);
});

test('switching restaurants joins the destination window queue after existing arrivals', () => {
  let checked = 0;
  for (let seed = 0; seed < 12 && !checked; seed++) {
    const world = new World(seed);
    while (world.tick < 56) world.step();
    const switches = world.events.filter((event) => event.type === 'restaurant_alternative');
    for (const change of switches) {
      const person = change.people[0];
      const meals = world.events.filter((event) => event.tick === change.tick && event.data.mealWindow && event.people.length === 1);
      const meal = meals.find((event) => event.people[0] === person);
      if (!meal) continue;
      const queue = meals.filter((event) => event.data.location === change.data.location && event.data.mealWindow === meal.data.mealWindow);
      if (queue.length < 2) continue;
      const moved = new Set(switches.filter((event) => event.tick === change.tick).map((event) => event.people[0]));
      queue.sort((a, b) => Number(moved.has(a.people[0])) - Number(moved.has(b.people[0])) ||
        ((a.people[0] - change.tick % world.npcs.length + world.npcs.length) % world.npcs.length) - ((b.people[0] - change.tick % world.npcs.length + world.npcs.length) % world.npcs.length));
      const position = queue.findIndex((event) => event.people[0] === person);
      const expectedWait = 4 + position * 8;
      expect(meal.data.location).toBe(change.data.location);
      if (expectedWait >= 12) {
        expect(meal.type).toBe('restaurant_wait');
        expect(meal.data.waitMinutes).toBe(expectedWait);
        expect(meal.parents).toContain(change.id);
        checked++;
      }
    }
  }
  expect(checked).toBeGreaterThan(0);
});

test('late classes retain attendance and use only their own prior queue and errand records', () => {
  let observed = 0;
  for (let seed = 0; seed < 8; seed++) {
    const world = new World(seed);
    while (world.step());
    for (const event of world.events.filter((e) => e.type === 'action' && Number(e.data.lateMinutes) > 0)) {
      observed++;
      const wait = world.events.find((e) => e.type === 'restaurant_wait' && e.tick === event.tick - 1 && e.people[0] === event.people[0]);
      const intermission = world.events.find((e) => e.type === 'between_classes' && e.tick === event.tick - 1 && e.people[0] === event.people[0]);
      expect(event.tick % 4).toBe(2);
      expect(wait || Number(intermission?.data.errandMinutes)).toBeTruthy();
      expect(event.data.lateMinutes).toBe(lateness(Number(event.data.travelMinutes), Number(wait?.data.waitMinutes || 0), true, Number(intermission?.data.errandMinutes || 0)));
      const item = attendance(world.events, event.people[0], world.tick, world.enrollments.find(e => e.owner === event.people[0])?.courseIds || []).find((row) => row.tick === event.tick);
      expect(item?.attended).toBe(true);
      expect(item?.lateMinutes).toBe(event.data.lateMinutes);
    }
    expect(World.fromSave(world.toSave())).toEqual(world);
  }
  expect(observed).toBeGreaterThan(0);
});


test('queue priority rotates across complete cycles without negative ranks', async () => {
  const { queueRank } = await import('../src/core/campusLife.ts');
  for (const tick of [0, 12, 25, 167]) {
    const ids = Array.from({ length: 12 }, (_, i) => i).sort((a, b) => queueRank(a, tick, 12) - queueRank(b, tick, 12));
    expect(ids).toEqual(Array.from({ length: 12 }, (_, i) => (tick + i) % 12));
  }
});
