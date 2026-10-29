import { writeFileSync } from 'node:fs';
import { World } from '../src/engine.ts';
import { courseCapacity, coursePeriods } from '../src/core/enrollment.ts';
import { ENGINE_VERSION } from '../src/core/config.ts';

interface PersonMetrics {
  id: number;
  name: string;
  courses: string[];
  classPeriods: number;
  labPeriods: number;
  homeworkPeriods: number;
  reportPeriods: number;
  examsAttended: number;
  restPeriods: number;
  crises: number;
}
const results: {
  seed: string;
  courseOccupancy: Record<string, { enrolled: number; capacity: number }>;
  noTimetable: number;
  fewerThanTwoCourses: number;
  people: PersonMetrics[];
  replay: boolean;
}[] = [];
for (let i = 0; i < 30; i++) {
  const seed = `research-quality-${i}`;
  const world = new World(seed);
  const people: PersonMetrics[] = world.enrollments.map(e => ({
    id: e.owner, name: world.npcs[e.owner].name, courses: [...e.courseIds],
    classPeriods: 0, labPeriods: 0, homeworkPeriods: 0, reportPeriods: 0,
    examsAttended: 0, restPeriods: 0, crises: 0,
  }));
  const courseOccupancy = Object.fromEntries(Object.keys(coursePeriods).map(id => [id, {
    enrolled: world.enrollments.filter(e => e.courseIds.includes(id)).length,
    capacity: courseCapacity[id],
  }]));
  while (world.tick < 168) {
    const previousEventCount = world.events.length;
    world.step();
    const events = world.events.slice(previousEventCount);
    for (const metric of people) {
      const person = world.npcs[metric.id];
      const action = events.find(e => e.type === 'action' && e.people[0] === metric.id);
      if (action?.data.courseId && person.loc === 1) metric.classPeriods++;
      if (action?.data.labCourseId && [8, 14, 18].includes(person.loc)) metric.labPeriods++;
      if (events.some(e => ['homework_progress', 'homework_completed'].includes(e.type) && e.people.includes(metric.id))) metric.homeworkPeriods++;
      if (events.some(e => e.type === 'task_progress' && String(e.data.taskId).startsWith('report-') && e.people.includes(metric.id))) metric.reportPeriods++;
      if (events.some(e => e.type === 'exam_taken' && e.people.includes(metric.id))) metric.examsAttended++;
      if (person.action === '休息') metric.restPeriods++;
      if (person.energy < 10 || person.hunger > 95) metric.crises++;
    }
  }
  results.push({
    seed, courseOccupancy,
    noTimetable: world.enrollments.filter(e => !e.courseIds.some(id => coursePeriods[id]?.length)).length,
    fewerThanTwoCourses: world.enrollments.filter(e => e.courseIds.length < 2).length,
    people, replay: World.fromSave(world.toSave()).checksum() === world.checksum(),
  });
}
const allPeople = results.flatMap(result => result.people);
const distribution = (values: number[]) => ({
  min: Math.min(...values), max: Math.max(...values),
  mean: values.reduce((sum, value) => sum + value, 0) / values.length,
});
const summary = {
  classPeriods: distribution(allPeople.map(person => person.classPeriods)),
  labPeriods: distribution(allPeople.map(person => person.labPeriods)),
  homeworkPeriods: distribution(allPeople.map(person => person.homeworkPeriods)),
  reportPeriods: distribution(allPeople.map(person => person.reportPeriods)),
  examsAttended: distribution(allPeople.map(person => person.examsAttended)),
  restPeriods: distribution(allPeople.map(person => person.restPeriods)),
  crises: distribution(allPeople.map(person => person.crises)),
  seeds: results.length,
  students: results.reduce((n, r) => n + r.people.length, 0),
  capacityViolations: results.flatMap(r => Object.entries(r.courseOccupancy).filter(([, c]) => c.enrolled > c.capacity).map(([course]) => ({ seed: r.seed, course }))),
  noTimetable: results.reduce((n, r) => n + r.noTimetable, 0),
  fewerThanTwoCourses: results.reduce((n, r) => n + r.fewerThanTwoCourses, 0),
  replayFailures: results.filter(r => !r.replay).map(r => r.seed),
};
writeFileSync('internal-docs/reports/enrollment-distribution-v0.16.0.json', JSON.stringify({
  engineVersion: ENGINE_VERSION,
  scenario: '30 fixed seeds research-quality-0 through research-quality-29; six weeks (168 periods) each',
  definitions: 'Per undergraduate: class and lab are chosen actions at their actual location; homework and group report are actual progress events; exams are actual exam_taken events; rest is an actual rest action; crisis is energy < 10 or hunger > 95 after a period. Course capacity is the public limit. No timetable means no enrolled course has any scheduled period.',
  baseline: 'A matching v0.15.1 baseline cannot be reconstructed reliably from the initial checkout with existing uncommitted changes.',
  summary, results,
}, null, 2) + '\n');
console.log(JSON.stringify(summary));
