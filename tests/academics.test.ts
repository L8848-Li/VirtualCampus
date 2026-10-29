import { test, expect } from 'vitest';
import { World } from '../src/engine.ts';
import { attendance, courseAt } from '../src/core/academics.ts';

test('the teaching week schedules two fictional courses on weekday mornings only', () => {
  expect([0, 4, 8, 14, 16].map((tick) => courseAt(tick)?.id)).toEqual(['math', 'programming', 'math', 'programming', 'math']);
  expect(courseAt(1)).toBeUndefined();
  expect(courseAt(20)).toBeUndefined();
});

test('attendance follows recorded decisions rather than scheduled classes', () => {
  const world = new World('campus-2026');
  world.step();
  for (const person of world.npcs.filter((n) => n.education === 'undergraduate')) {
    const selected = world.enrollments.find(e => e.owner === person.id)!.courseIds;
    const record = attendance(world.events, person.id, world.tick, selected);
    const action = world.events.find((event) => event.tick === 0 && event.type === 'action' && event.people[0] === person.id)!;
    expect(record).toHaveLength(selected.includes("math") ? 1 : 0);
    if (record.length) {
      expect(record[0].attended).toBe(action.data.courseId === "math");
      if (record[0].attended) expect(action.data.location).toBe(1);
    }
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

test('two fictional teaching weeks have balanced two-lesson blocks and weekend breaks', async () => {
  const { timetableWeek, TEACHING_TICKS, labAt } = await import('../src/core/academics.ts');
  expect(TEACHING_TICKS).toBe(112);
  for (const person of [0, 1]) for (const start of [0, 28]) {
    const week = timetableWeek(person, start);
    expect(week).toHaveLength(5);
    for (const day of week) {
      const occupied = day.periods.filter((period) => period.course || period.lab).length;
      expect(occupied).toBeGreaterThanOrEqual(1);
      expect(occupied).toBeLessThanOrEqual(2);
    }
    expect(courseAt(start + 20, person)).toBeUndefined();
    expect(labAt(start + 22, person)).toBeUndefined();
  }
  expect(timetableWeek(0, 112)).toEqual([]);
});

test('a second teaching week introduces its own group work and homework', () => {
  const world = new World('second-week');
  while (world.tick < 29) world.step();
  expect(world.tasks.filter(task => task.id.startsWith("report-"))).toHaveLength(6);
  expect(world.tasks.filter(task => task.id.startsWith("research-"))).toHaveLength(4);
  expect(new Set(world.tasks.map((task) => task.id)).size).toBe(world.tasks.length);
  const mathStudents = world.enrollments.filter(e => e.courseIds.includes("math")).length;
  expect(world.homework).toHaveLength(2 * mathStudents);
  expect(new Set(world.homework.map((item) => item.id)).size).toBe(2 * mathStudents);
  expect(World.fromSave(world.toSave())).toEqual(world);
});
