import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { resolveLibrary } from '../src/core/library.ts';

test('only an actual visit for one’s own open assignment can print, once per assignment', () => {
  const world = new World('print-test');
  world.step();
  const person = world.npcs.find((n) => {
    const work = world.homework.find((h) => h.owner === n.id);
    return !!work && world.sample('library-print', work.id, n.id) < 0.45;
  })!;
  const homework = world.homework.find((h) => h.owner === person.id)!;
  const progress = homework.progress;
  person.loc = 8;
  person.intent = { kind: 'homework', homeworkId: homework.id, evidence: [] };
  resolveLibrary(world);
  expect(world.events.filter((event) => event.type === 'library_print')).toHaveLength(0);
  person.loc = 3;
  resolveLibrary(world);
  const printed = world.events.filter((event) => event.type === 'library_print');
  expect(printed).toHaveLength(1);
  expect(printed[0].people).toEqual([person.id]);
  expect(printed[0].data.homeworkId).toBe(homework.id);
  expect(printed[0].data.floor).toBe(2);
  expect(printed[0].data.pages).toBeGreaterThanOrEqual(2);
  expect(printed[0].data.minutes).toBeGreaterThanOrEqual(2);
  expect(person.memory).toContain(printed[0].id);
  expect(world.npcs.filter((other) => other.id !== person.id).every((other) => !other.memory.includes(printed[0].id))).toBe(true);
  expect(homework.progress).toBe(progress);
  resolveLibrary(world);
  expect(world.events.filter((event) => event.type === 'library_print')).toHaveLength(1);
});
