import { expect, it } from 'vitest';
import { World } from '../src/engine.ts';
import { courseCapacity, coursePeriods } from '../src/core/enrollment.ts';
import { courseAt, labAt } from '../src/core/academics.ts';

it('enrolls only undergraduates without capacity overflow or timetable clashes', () => {
  const w = new World('enrollment-competition');
  expect(w.enrollments).toHaveLength(w.npcs.filter(n => n.education === 'undergraduate').length);
  for (const id of Object.keys(coursePeriods)) expect(w.enrollments.filter(e => e.courseIds.includes(id)).length).toBeLessThanOrEqual(courseCapacity[id]);
  for (const e of w.enrollments) {
    expect(new Set(e.courseIds).size).toBe(e.courseIds.length);
    const times = e.courseIds.flatMap(id => coursePeriods[id]);
    expect(new Set(times).size).toBe(times.length);
    expect(w.assessments.filter(a => a.owner === e.owner).map(a => a.courseId).sort()).toEqual([...e.courseIds].sort());
    for (let tick = 0; tick < 28; tick++) expect([courseAt(tick, e.owner, e.courseIds), labAt(tick, e.owner, e.courseIds)].filter(Boolean).length).toBeLessThanOrEqual(1);
  }
  expect(w.enrollments.every(e => e.events.every(id => w.events[id - 1].people.includes(e.owner)))).toBe(true);
});

it('assigns homework only to enrolled students and survives a replay', () => {
  const w = new World('enrollment-replay');
  w.step();
  expect(w.homework.every(h => w.enrollments.find(e => e.owner === h.owner)?.courseIds.includes(h.courseId))).toBe(true);
  expect(World.fromSave(w.toSave()).checksum()).toBe(w.checksum());
});

it('does not advance homework without actual presence or after its deadline', async () => {
  const { workHomework } = await import('../src/core/homework.ts');
  const w = new World('homework-presence'); w.step();
  const homework = w.homework[0]; const n = w.npcs[homework.owner];
  n.intent = { kind: 'homework', homeworkId: homework.id, evidence: [] };
  n.loc = n.id % 2 ? 3 : 8; const before = homework.progress;
  workHomework(w); expect(homework.progress).toBe(before);
  n.loc = n.id % 2 ? 8 : 3; w.tick = homework.deadline + 1;
  workHomework(w); expect(homework.progress).toBe(before);
});
