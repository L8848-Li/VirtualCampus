import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { holiday } from '../src/core/holiday.ts';

const onSiteEvents = new Set([
  'friendship','crush','misunderstanding','repair','rivalry','invitation','accepted','declined','brief_reply','explanation',
  'dorm_borrow','dorm_return','dorm_routine_agreed','dorm_routine_declined',
  'delivery_collected','parcel_collected','laundry_collected','laundry_started',
  'library_borrow','library_return','library_room_used','library_print',
  'task_progress','task_completed','homework_progress','homework_completed',
  'activity_progress','activity_held','club_meeting','exam_taken','living_work','living_meal','living_support_accepted',
  'between_classes','restaurant_wait','restaurant_alternative','festival_visit',
]);

test('short break excludes absent people from campus events and deterministic replay', () => {
  const world = new World('holiday-regression');
  let departed = 0, returned = 0;
  while (world.tick < 168) {
    if (world.tick === 157) { world.intervene('rooms'); world.intervene('groups'); world.intervene('party'); }
    const tick = world.tick, start = world.events.length;
    world.step();
    if (world.tick === 159) expect(World.fromSave(world.toSave())).toEqual(world);
    const absent = new Set(world.npcs.filter(n => n.loc === holiday.offCampusLocation).map(n => n.id));
    const events = world.events.slice(start);
    departed += events.filter(e => e.type === 'holiday_departed').length;
    returned += events.filter(e => e.type === 'holiday_returned').length;
    for (const e of events) {
      if (onSiteEvents.has(e.type)) expect(e.people.filter(id => absent.has(id)), `${tick}: ${e.type}`).toEqual([]);
      if (e.type === 'action' && absent.has(e.people[0])) expect(e.data.observedPeople).toEqual([]);
      if (e.type === 'action' && !absent.has(e.people[0])) expect((e.data.observedPeople ?? []).filter(id => absent.has(id))).toEqual([]);
    }
  }
  expect(departed).toBeGreaterThan(0);
  expect(returned).toBe(departed);
  expect(world.events.some(e => e.tick === holiday.announceTick && e.type === 'system' && e.text.includes('短假期'))).toBe(true);
  expect(world.events.filter(e => e.type === 'holiday_departed').every(e => e.tick === holiday.departTick)).toBe(true);
  expect(world.npcs.every(n => n.loc !== holiday.offCampusLocation && n.holidayReturnTick === undefined)).toBe(true);
  expect(World.fromSave(world.toSave())).toEqual(world);
});

test('absent owners cannot collect orders or library loans, and expiry still runs', () => {
  const world = new World('holiday-resources');
  while (world.tick < holiday.departTick) world.step();
  const sample = world.sample.bind(world);
  world.sample = (purpose, ...keys) => purpose === 'holiday-leave' ? 0 : purpose === 'holiday-return' ? 0.9 : sample(purpose, ...keys);
  const person = world.npcs[0];
  world.deliveries.push({ id: 'holiday-order', owner: person.id, dorm: 0, orderedTick: 155, dueTick: 155, expiresTick: 156, estimatedMinutes: 30, simulatedPrice: 15, status: 'ready' });
  world.library.loans.push({ owner: person.id, bookId: 'math-notes', borrowedTick: 155, dueTick: 156, returnedTick: null, lastEvent: person.last! });
  world.step();
  expect(person.loc).toBe(holiday.offCampusLocation);
  expect(world.deliveries.find(d => d.id === 'holiday-order')?.status).toBe('ready');
  world.step();
  expect(world.deliveries.find(d => d.id === 'holiday-order')?.status).toBe('expired');
  expect(world.library.loans.find(l => l.owner === person.id && l.borrowedTick === 155)?.returnedTick).toBeNull();
});
