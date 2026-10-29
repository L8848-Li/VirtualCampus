import { expect, test } from 'vitest';
import { World } from '../src/engine.ts';
import { weatherAt } from '../src/core/weather.ts';
import { chooseAction } from '../src/core/decision.ts';
import { courseAt } from '../src/core/academics.ts';
import { resolveExams } from '../src/core/assessment.ts';
import { examFor } from '../src/core/assessment.ts';

test('fictional daily weather is seeded, stable within a day and reproducible after reload', () => {
  const world = new World('weather-test');
  const days = Array.from({ length: 42 }, (_, day) => {
    const weather = weatherAt(world.seed, day * 4);
    for (let slot = 1; slot < 4; slot++) expect(weatherAt(world.seed, day * 4 + slot)).toBe(weather);
    return weather;
  });
  expect(new Set(days)).toEqual(new Set(['晴', '多云', '小雨']));
  for (let i = 0; i < 7; i++) world.step();
  const restored = World.fromSave(world.toSave());
  expect(weatherAt(restored.seed, restored.tick)).toBe(weatherAt(world.seed, world.tick));
});

test.each(['scheduled', 'deferred'] as const)('a %s missed exam leads to a fictional retake, not an automatic makeup', (status) => {
  const world = new World(`missed-${status}`);
  const record = world.assessments.find((item) => item.courseId === 'math')!;
  const person = world.npcs[record.owner];
  record.status = status;
  world.tick = status === 'scheduled' ? record.examTick : record.makeupTick;
  person.loc = 0;
  person.intent = null;
  resolveExams(world);
  expect(record.status).toBe('missed');
  expect(record.earnedCredits).toBe(0);
  expect(examFor([record], record.makeupTick, person.id)).toBeUndefined();
  world.tick = record.retakeTick - 1;
  person.loc = 3;
  person.intent = { kind: 'retake_study', courseId: record.courseId, evidence: [] };
  resolveExams(world);
  expect(record.retakeWork).toBe(1);
  expect(examFor([record], record.retakeTick, person.id)).toBe(record);
  world.tick = record.retakeTick;
  person.loc = 1;
  person.intent = { kind: 'exam', courseId: record.courseId, evidence: [] };
  resolveExams(world);
  expect(record.status).toBe('retake_pending');
  world.tick++;
  resolveExams(world);
  expect(['passed', 'retake_needed']).toContain(record.status);
});

test('rain lowers the outdoor sports option and explains the decision', () => {
  const person = new World('rain-decision').npcs[0];
  const context = { tick: 1, slot: 2, party: false, memories: [], roommates: [person.id] };
  const sunny = chooseAction(person, { ...context, weather: '晴' }, () => 0).options.find((option) => option.loc === 7)!;
  const rainy = chooseAction(person, { ...context, weather: '小雨' }, () => 0).options.find((option) => option.loc === 7)!;
  expect(rainy.score).toBe(sunny.score - 18);
  expect(rainy.reason).toContain('下雨');
});

test('late arrival counts as partial attendance when an actual exam is assessed', () => {
  function evaluate(late: boolean) {
    const world = new World('late-grade');
    const person = world.npcs[world.assessments.find(item => item.courseId === 'english')!.owner];
    const selected = world.enrollments.find(e => e.owner === person.id)!.courseIds;
    let changed = false;
    for (let tick = 0; tick < 112; tick++) {
      if (courseAt(tick, person.id, selected)?.id !== 'english') continue;
      world.tick = tick;
      world.log('上课', 'action', [person.id], [], { courseId: 'english', lateMinutes: late && !changed ? 5 : 0 });
      changed = true;
    }
    world.tick = 124;
    person.loc = 1;
    person.intent = { kind: 'exam', courseId: 'english', evidence: [] };
    resolveExams(world);
    return world.assessments.find((item) => item.owner === person.id && item.courseId === 'english')!;
  }
  const onTime = evaluate(false);
  const late = evaluate(true);
  expect(onTime.status).toBe('pending');
  expect(late.status).toBe('pending');
  expect(onTime.processScore).toBe(100);
  expect(late.processScore).toBeLessThan(onTime.processScore!);
  expect(late.examScore).toBe(onTime.examScore);
  expect(late.score).toBeLessThanOrEqual(onTime.score!);
});
