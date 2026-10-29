import { expect, test } from 'vitest';
import { World, TOTAL_TICKS } from '../src/engine.ts';
import { travelMinutes } from '../src/core/campusLife.ts';

test('the six-week calendar generates recurring teaching, activity and actual life events', () => {
  const world = new World('campus-2026');
  while (world.step());
  expect(world.tick).toBe(TOTAL_TICKS);
  expect(world.tasks.filter(t => t.id.startsWith('report-'))).toHaveLength(12);
  expect(world.tasks.filter(t => t.id.startsWith('research-'))).toHaveLength(8);
  expect(world.homework.length).toBe(4 * world.enrollments.filter(e => e.courseIds.includes("math")).length);
  expect(world.events.some((event) => event.type === 'quiz_result')).toBe(true);
  expect(world.events.some((event) => event.type === 'system' && event.tick === 82 && event.text.includes('春日校园开放午后'))).toBe(true);
  expect(world.events.some((event) => event.type === 'action' && /洗衣|取快递/.test(event.text))).toBe(true);
  expect(world.events.some((event) => typeof event.data.mealWindow === 'string')).toBe(true);
  expect(World.fromSave(world.toSave())).toEqual(world);
});

test('walking estimates are nonnegative and do not invent travel within one place', () => {
  expect(travelMinutes(3, 3)).toBe(0);
  expect(travelMinutes(0, 3)).toBeGreaterThan(0);
  expect(travelMinutes(0, 3)).toBe(travelMinutes(3, 0));
});
