import { coursePeriods, courses } from './courseCatalog.ts';
export { courses } from './courseCatalog.ts';
import { profiles } from './config.ts';
import { queryEvents } from './eventIndex.ts';
import type { ActionOption, CampusActivity, CampusEvent } from './types.ts';

export const TEACHING_TICKS = 112;

// Location alone is not evidence of study: someone may visit a classroom or
// research building to look for a friend. Only an actual learning action adds
// the person's general learning progress; formal grades remain separate.
export function isLearningAction(action: Pick<ActionOption, 'kind' | 'action' | 'activityId'>, activities: CampusActivity[]) {
  if (action.kind === 'seminar' || action.kind === 'lab' || action.kind === 'homework' || action.kind === 'task' || action.kind === 'retake_study') return true;
  if (action.kind === 'activity_prepare') return activities.some((item) => item.id === action.activityId && item.kind === 'project');
  if (action.kind) return false;
  return action.action.startsWith('上') || [
    '整理课堂笔记', '整理研究笔记', '自习', '在实验楼练习', '在智慧教学楼自习', '在理学楼学习',
    '在科研楼查阅资料', '在学院实验楼练习', '在研究生公寓公共空间学习',
    '在学生宿舍 IV 区公共空间学习', '在智能工程学院楼练习',
  ].includes(action.action);
}
export function courseAt(tick: number, person?: number, courseIds?: string[]) {
  if (person !== undefined && profiles[person]?.education === 'graduate') return undefined;
  if (tick < 0 || tick >= TEACHING_TICKS) return undefined;
  const day = Math.floor(tick / 4) % 7;
  const slot = tick % 4;
  if (courseIds) return courses.find(course => courseIds.includes(course.id) && coursePeriods[course.id].includes(tick % 28) && !(course.id === 'programming' && [6, 14].includes(tick % 28)));
  if (day >= 5 || (slot !== 0 && slot !== 2)) return undefined;
  const programming = person === undefined || person % 2 === 0;
  if (slot === 0) {
    if ([0, 2, 4].includes(day)) return courses[0];
    return day === 1 && programming ? courses[1] : courses[2];
  }
  if (day === 0) return courses[2];
  if (day === 1) return programming ? undefined : courses[3]; // Lab replaces a class for the programming cohort.
  if (day === 2) return undefined; // A deliberate free afternoon.
  if (day === 3) return programming ? courses[1] : courses[3];
  return courses[3];
}
export function attendance(events: readonly CampusEvent[], person: number, tick: number, courseIds?: string[]) {
  const attended = new Map(queryEvents(events, { type: 'action', person }).filter(event => event.people[0] === person && event.data.courseId).map(event => [`${event.tick}:${event.data.courseId}`, Number(event.data.lateMinutes || 0)]));
  return Array.from({ length: Math.min(tick, TEACHING_TICKS) }, (_, t) => ({ tick: t, course: courseAt(t, person, courseIds) }))
    .filter((item) => item.course)
    .map((item) => ({ ...item, attended: attended.has(`${item.tick}:${item.course?.id}`), lateMinutes: attended.get(`${item.tick}:${item.course?.id}`) || 0 }));
}
export function labAt(tick: number, person: number, courseIds?: string[]) {
  if (courseIds) return tick >= 0 && tick < TEACHING_TICKS && courseIds.includes("programming") && [6, 14].includes(tick % 28) ? courses[1] : undefined;
  if (profiles[person]?.education === 'graduate' || tick < 0 || tick >= TEACHING_TICKS || person % 2 !== 0 || tick % 4 !== 2) return undefined;
  const day = Math.floor(tick / 4) % 7;
  // Some students have an intentional conflict on Thursday; others have one lab on Tuesday.
  return day === 1 || (day === 3 && person % 4 === 0) ? courses[1] : undefined;
}
export function timetableWeek(person: number, tick: number, courseIds?: string[]) {
  if (tick >= TEACHING_TICKS) return [];
  const week = Math.max(0, Math.floor(tick / 28));
  return Array.from({ length: 5 }, (_, day) => ({
    day: week * 7 + day + 1,
    periods: [0, 2].map((slot) => {
      const at = (week * 7 + day) * 4 + slot;
      return { tick: at, course: courseAt(at, person, courseIds), lab: labAt(at, person, courseIds) };
    }),
  }));
}
