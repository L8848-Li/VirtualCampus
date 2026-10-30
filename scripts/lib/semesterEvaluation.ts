import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { World, ENGINE_VERSION } from '../../src/engine.ts';
import { courseCapacity, coursePeriods } from '../../src/core/courseCatalog.ts';

interface PersonMetrics {
  id: number; name: string; courses: string[]; classPeriods: number; labPeriods: number;
  homeworkPeriods: number; reportPeriods: number; examsAttended: number; restPeriods: number; crises: number;
}
interface ClubCounts { memberships: number; proposed: number; held: number; cancelled: number; meetings: number; missedMeetings: number }
interface ResearchRow {
  seed: string; enrollments: { owner: number; courses: string[] }[];
  people: { id: number; name: string; researchWork: number; rest: number; crisis: number }[];
  clubPeople: { id: number; rest: number; clubActions: number }[];
  club: ClubCounts; completed: number; expired: number; failures: number; missed: number; replay: boolean;
}
interface EnrollmentRow {
  seed: string; courseOccupancy: Record<string, { enrolled: number; capacity: number }>;
  noTimetable: number; fewerThanTwoCourses: number; people: PersonMetrics[]; replay: boolean;
}
const distribution = (values: number[]) => ({ min: Math.min(...values), max: Math.max(...values), mean: values.reduce((a, b) => a + b, 0) / values.length });
const count = (world: World, type: string) => world.events.filter(event => event.type === type).length;
function replayMatches(world: World) {
  const restored = World.fromSave(world.toSave());
  assert.equal(restored.checksum(), world.checksum());
  return true;
}
function write(name: string, report: object) {
  mkdirSync('internal-docs/reports', { recursive: true });
  writeFileSync(`internal-docs/reports/${name}.json`, JSON.stringify(report, null, 2) + '\n');
}

/** Research, clubs, enrollment and distribution observe the same 30 worlds. */
export function evaluateAcademicSemesters() {
  const research: ResearchRow[] = [], enrollment: EnrollmentRow[] = [];
  for (let seed = 0; seed < 30; seed++) {
    const world = new World(`research-quality-${seed}`);
    const people = world.npcs.filter(n => n.education === 'graduate').map(n => ({ id: n.id, name: n.name, researchWork: 0, rest: 0, crisis: 0 }));
    const clubPeople = world.npcs.map(n => ({ id: n.id, rest: 0, clubActions: 0 }));
    const students: PersonMetrics[] = world.enrollments.map(e => ({ id: e.owner, name: world.npcs[e.owner].name, courses: [...e.courseIds], classPeriods: 0, labPeriods: 0, homeworkPeriods: 0, reportPeriods: 0, examsAttended: 0, restPeriods: 0, crises: 0 }));
    const courseOccupancy = Object.fromEntries(Object.keys(coursePeriods).map(id => [id, { enrolled: world.enrollments.filter(e => e.courseIds.includes(id)).length, capacity: courseCapacity[id] }]));
    while (world.tick < 168) {
      const cursor = world.events.length;
      world.step();
      const events = world.events.slice(cursor);
      for (const metric of clubPeople) {
        const n = world.npcs[metric.id];
        if (n.action === '休息') metric.rest++;
        if (n.intent?.kind.startsWith('club_')) metric.clubActions++;
      }
      for (const metric of people) {
        const n = world.npcs[metric.id];
        if (events.some(e => ['task_progress', 'research_experiment_failed'].includes(e.type) && e.people.includes(n.id) && String(e.data.taskId).startsWith('research-'))) metric.researchWork++;
        if (n.action === '休息') metric.rest++;
        if (n.energy < 10 || n.hunger > 95) metric.crisis++;
      }
      for (const metric of students) {
        const n = world.npcs[metric.id], action = events.find(e => e.type === 'action' && e.people[0] === n.id);
        if (action?.data.courseId && n.loc === 1) metric.classPeriods++;
        if (action?.data.labCourseId && [8, 14, 18].includes(n.loc)) metric.labPeriods++;
        if (events.some(e => ['homework_progress', 'homework_completed'].includes(e.type) && e.people.includes(n.id))) metric.homeworkPeriods++;
        if (events.some(e => e.type === 'task_progress' && String(e.data.taskId).startsWith('report-') && e.people.includes(n.id))) metric.reportPeriods++;
        if (events.some(e => e.type === 'exam_taken' && e.people.includes(n.id))) metric.examsAttended++;
        if (n.action === '休息') metric.restPeriods++;
        if (n.energy < 10 || n.hunger > 95) metric.crises++;
      }
    }
    const replay = replayMatches(world);
    research.push({ seed: world.seed, enrollments: world.enrollments.map(e => ({ owner: e.owner, courses: e.courseIds })), people, clubPeople,
      club: { memberships: world.clubs.clubs.reduce((n, c) => n + c.members.length, 0), proposed: world.activities.filter(a => a.clubId).length, held: world.activities.filter(a => a.clubId && a.status === 'held').length, cancelled: world.activities.filter(a => a.clubId && a.status === 'cancelled').length, meetings: count(world, 'club_meeting'), missedMeetings: count(world, 'club_meeting_cancelled') },
      completed: world.tasks.filter(t => t.research && t.status === 'completed').length, expired: world.tasks.filter(t => t.research && t.status === 'expired').length,
      failures: count(world, 'research_experiment_failed'), missed: count(world, 'research_meeting_missed'), replay });
    enrollment.push({ seed: world.seed, courseOccupancy, noTimetable: world.enrollments.filter(e => !e.courseIds.some(id => coursePeriods[id]?.length)).length,
      fewerThanTwoCourses: world.enrollments.filter(e => e.courseIds.length < 2).length, people: students, replay });
  }
  const sum = (field: 'completed' | 'expired' | 'failures' | 'missed') => research.reduce((n, row) => n + row[field], 0);
  const researchPeople = research.flatMap(row => row.people), personSteps = 30 * 2 * 168;
  const researchSummary = { seeds: 30, personSteps, crisisRate: researchPeople.reduce((n, p) => n + p.crisis, 0) / personSteps,
    restRate: researchPeople.reduce((n, p) => n + p.rest, 0) / personSteps, workActions: researchPeople.reduce((n, p) => n + p.researchWork, 0),
    completed: sum('completed'), expired: sum('expired'), experimentFailures: sum('failures'), missedMeetings: sum('missed'), replayFailures: research.filter(r => !r.replay).map(r => r.seed) };
  const clubSum = (key: keyof ClubCounts) => research.reduce((n, row) => n + row.club[key], 0);
  const clubSummary = { seeds: 30, memberships: clubSum('memberships'), proposed: clubSum('proposed'), held: clubSum('held'), cancelled: clubSum('cancelled'), meetings: clubSum('meetings'), cancelledMeetings: clubSum('missedMeetings'),
    peopleWithoutRest: research.flatMap(row => row.clubPeople.filter(p => !p.rest).map(p => ({ seed: row.seed, id: p.id }))), replayFailures: researchSummary.replayFailures };
  const enrollmentSummary = { seeds: 30, students: research.reduce((n, row) => n + row.enrollments.length, 0),
    courseCounts: Object.fromEntries(Object.keys(coursePeriods).map(id => [id, research.reduce((n, row) => n + row.enrollments.filter(e => e.courses.includes(id)).length, 0)])),
    fewerThanTwo: research.flatMap(row => row.enrollments.filter(e => e.courses.length < 2).map(e => ({ seed: row.seed, owner: e.owner, courses: e.courses }))), replayFailures: researchSummary.replayFailures };
  const students = enrollment.flatMap(row => row.people);
  const enrollmentDistribution = {
    ...Object.fromEntries((['classPeriods', 'labPeriods', 'homeworkPeriods', 'reportPeriods', 'examsAttended', 'restPeriods', 'crises'] as const).map(key => [key, distribution(students.map(p => p[key]))])),
    seeds: 30, students: students.length,
    capacityViolations: enrollment.flatMap(row => Object.entries(row.courseOccupancy).filter(([, c]) => c.enrolled > c.capacity).map(([course]) => ({ seed: row.seed, course }))),
    noTimetable: enrollment.reduce((n, row) => n + row.noTimetable, 0), fewerThanTwoCourses: enrollment.reduce((n, row) => n + row.fewerThanTwoCourses, 0), replayFailures: researchSummary.replayFailures,
  };
  assert.equal(enrollmentDistribution.capacityViolations.length, 0);
  const common = { engineVersion: ENGINE_VERSION, definition: '30 fixed research-quality-0..29 seeds, 168 periods. Actual choices, work, attendance and rest; no forced completion. Research, clubs and enrollment share one simulation and one replay per seed.' };
  write(`research-v${ENGINE_VERSION}`, { ...common, summary: researchSummary, results: research });
  write(`clubs-v${ENGINE_VERSION}`, { ...common, summary: clubSummary, results: research.map(r => ({ seed: r.seed, people: r.clubPeople, ...r.club })) });
  write(`enrollment-v${ENGINE_VERSION}`, { ...common, summary: enrollmentSummary, results: research.map(r => ({ seed: r.seed, enrollments: r.enrollments })) });
  write(`enrollment-distribution-v${ENGINE_VERSION}`, { ...common, definitions: 'Per undergraduate: chosen class/lab actions at the relevant place, actual homework/report progress, exam_taken events, actual rest, and post-step energy <10 or hunger >95 crises.', summary: enrollmentDistribution, results: enrollment });
  return { research: researchSummary, clubs: clubSummary, enrollment: enrollmentSummary, distribution: enrollmentDistribution };
}

export function writeLivingReport(report: { summary: unknown }) {
  write('living-experiment', { engineVersion: ENGINE_VERSION, ...report });
  return report.summary;
}
