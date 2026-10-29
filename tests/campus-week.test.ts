import { expect, test } from 'vitest';
import { World, TOTAL_TICKS } from '../src/engine.ts';
import { courseAt, labAt } from '../src/core/academics.ts';

test('a programming class and laboratory are limited to the enrolled cohort', () => {
  expect(courseAt(4, 0)?.id).toBe('programming');
  expect(courseAt(4, 1)?.id).toBe('english');
  expect(labAt(6, 0)?.id).toBe('programming');
  expect(labAt(6, 1)).toBeUndefined();
  expect(courseAt(14, 0)?.id).toBe('programming');
  expect(labAt(14, 0)?.id).toBe('programming');
  expect(labAt(14, 2)).toBeUndefined();
});

test('exam outcomes use actual attendance and award credits only once on passing', () => {
  const world = new World('exam-scenario');
  while (world.step()) {
    for (const record of world.assessments) {
      const events = world.events.filter((event) => event.people[0] === record.owner && event.data.courseId === record.courseId);
      const exams = events.filter((event) => event.type === 'exam_taken');
      if (['pending', 'makeup_pending', 'deferred_pending', 'retake_pending'].includes(record.status)) {
        expect(exams.length).toBeGreaterThan(0);
        expect(record.earnedCredits).toBe(0);
      }
      expect(record.earnedCredits).toBe(record.status === 'passed' ? record.credits : 0);
      expect(record.earnedCredits).toBeLessThanOrEqual(record.credits);
      if (record.status === 'missed') expect(events.some((event) => event.type === 'exam_missed')).toBe(true);
    }
  }
  expect(world.tick).toBe(TOTAL_TICKS);
  expect(World.fromSave(world.toSave())).toEqual(world);
});

test('queues never act as a seating cap and hungry people use alternatives', () => {
  const world = new World('campus-2026');
  let waits = 0, alternatives = 0;
  while (world.tick < 56) {
    const before = world.npcs.map((person) => person.hunger);
    const tick = world.tick;
    world.step();
    for (const event of world.events.filter((item) => item.tick === tick && ['restaurant_wait', 'restaurant_alternative'].includes(item.type))) {
      const person = world.npcs[event.people[0]];
      expect(person.hunger).toBe(Math.max(0, Math.min(100, before[person.id] + 17) - 65));
      if (event.type === 'restaurant_wait') { waits++; expect(event.text).toContain('吃上了饭'); }
      else { alternatives++; expect(event.data.location).toBe(person.loc); }
    }
  }
  expect(waits).toBeGreaterThan(0);
  expect(alternatives).toBeGreaterThan(0);
});

test('projects depend on actual choices at their designated workspace and showcase', () => {
  const kinds = new Set<string>();
  for (let seed = 0; seed < 50; seed++) {
    const world = new World(seed);
    while (world.step());
    for (const project of world.activities.filter((activity) => activity.kind === 'project')) {
      kinds.add(project.status);
      for (const [person, contribution] of Object.entries(project.contributions)) {
        const works = world.events.filter((event) => event.type === 'activity_progress' && event.people.includes(Number(person)) && event.data.activityId === project.id && event.data.location === project.preparationLocation);
        expect(contribution).toBe(works.length * 2);
      }
      if (project.status === 'held') expect(project.attendees.length).toBeGreaterThanOrEqual(2);
    }
  }
  expect(kinds.has('held')).toBe(true);
  expect(kinds.has('cancelled')).toBe(true);
});

test('deferral requires an actual application, and retake credits are not awarded twice', async () => {
  const { resolveExams } = await import('../src/core/assessment.ts');
  const world = new World('academic-flow');
  const record = world.assessments.find((entry) => entry.courseId === 'math')!;
  const person = world.npcs[record.owner];
  world.tick = record.examTick;
  person.loc = 0;
  person.intent = { kind: 'defer_exam', courseId: 'math', evidence: [] };
  resolveExams(world);
  expect(record.status).toBe('deferred');
  expect(record.earnedCredits).toBe(0);
  world.tick = record.makeupTick;
  person.loc = 1;
  person.intent = { kind: 'exam', courseId: 'math', evidence: [] };
  resolveExams(world);
  expect(record.status).toBe('deferred_pending');
  world.tick++;
  resolveExams(world);
  expect(['passed', 'retake_needed']).toContain(record.status);
  expect(record.earnedCredits).toBe(record.status === 'passed' ? record.credits : 0);
  const credits = record.earnedCredits;
  resolveExams(world);
  expect(record.earnedCredits).toBe(credits);
});

test('a new retake counts only actual study and cannot duplicate a passed course', async () => {
  const { resolveExams } = await import('../src/core/assessment.ts');
  const world = new World('retake-flow');
  const record = world.assessments.find((entry) => entry.courseId === 'math')!;
  const person = world.npcs[record.owner];
  record.status = 'retake_needed';
  world.tick = 152;
  person.loc = 3;
  person.intent = { kind: 'retake_study', courseId: 'math', evidence: [] };
  resolveExams(world);
  expect(record.retakeWork).toBe(1);
  world.tick = record.retakeTick;
  person.loc = 1;
  person.intent = { kind: 'exam', courseId: 'math', evidence: [] };
  resolveExams(world);
  expect(record.status).toBe('retake_pending');
  expect(record.earnedCredits).toBe(0);
  world.tick++;
  resolveExams(world);
  expect(['passed', 'retake_needed']).toContain(record.status);
  expect(record.earnedCredits).toBeLessThanOrEqual(record.credits);
});
